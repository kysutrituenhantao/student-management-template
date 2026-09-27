#!/usr/bin/env node
/**
 * Print a .docx as text, keeping the formatting that carries meaning in her briefs.
 *
 * She sends one Word file an evening and colours it: red is still to do, black is already fine. In a screenshot the
 * two are easy to confuse with Word's red spell-check squiggle, so the colour is read here from the run properties
 * (`w:color`) instead of off the screen. Strikethrough, bold, highlight, list numbering, tables and the images are
 * kept in place too, so nothing in the file is lost before anyone reads it.
 *
 *   node scripts/docx-text.mjs conversation-with-teacher/3.docx
 *
 * Marks: {c:FF0000}…{/} coloured · {STRIKE} · {b} · {hl:yellow} · [[IMAGE rel=… src=…]] · <<TABLE>> <<ROW>>
 * No dependencies: a .docx is a zip, and this reads the zip itself.
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** The entries of a zip, by name. Only the two methods Word uses: stored and deflate. */
export function unzip(buf) {
  // The central directory is found from the end, because the comment at the very end is variable length.
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Không phải tệp .docx (thiếu zip end-of-central-directory).");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Zip hỏng ở central directory.");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    // The local header repeats the name and extra field, with lengths of its own.
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + size);
    files.set(name, method === 0 ? raw : inflateRawSync(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const attr = (tag, name) => tag.match(new RegExp(`\\sw:${name}="([^"]*)"`))?.[1] ?? null;
const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

/** `<w:numId w:val="3"/>` → the list marker to print, counting as Word would. */
function numbering(numXml) {
  if (!numXml) return () => "";
  const abstract = new Map();
  for (const block of numXml.split("<w:abstractNum ").slice(1)) {
    const id = block.match(/^[^>]*w:abstractNumId="(\d+)"/)?.[1];
    const levels = new Map();
    for (const lvl of block.split("<w:lvl ").slice(1)) {
      const ilvl = lvl.match(/^[^>]*w:ilvl="(\d+)"/)?.[1] ?? "0";
      levels.set(ilvl, lvl.match(/<w:numFmt w:val="([^"]*)"/)?.[1] ?? "bullet");
    }
    if (id) abstract.set(id, levels);
  }
  const byNum = new Map();
  for (const block of numXml.split("<w:num ").slice(1)) {
    const id = block.match(/^[^>]*w:numId="(\d+)"/)?.[1];
    const aid = block.match(/<w:abstractNumId w:val="(\d+)"/)?.[1];
    if (id && aid) byNum.set(id, abstract.get(aid) ?? new Map());
  }
  const counters = new Map();
  return (numId, ilvl) => {
    const fmt = byNum.get(numId)?.get(ilvl) ?? "bullet";
    const pad = "  ".repeat(Number(ilvl));
    if (fmt === "bullet") return `${pad}- `;
    const key = `${numId}/${ilvl}`;
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    return `${pad}${n}. `;
  };
}

export function docxToText(buf) {
  const files = unzip(buf);
  const read = (name) => (files.has(name) ? files.get(name).toString("utf8") : null);
  const document = read("word/document.xml");
  if (!document) throw new Error("Không tìm thấy word/document.xml.");
  const marker = numbering(read("word/numbering.xml"));

  const rels = new Map();
  for (const m of (read("word/_rels/document.xml.rels") ?? "").matchAll(/<Relationship\b[^>]*>/g)) {
    const id = m[0].match(/\sId="([^"]*)"/)?.[1];
    const target = m[0].match(/\sTarget="([^"]*)"/)?.[1];
    if (id && target) rels.set(id, target);
  }

  const body = document.slice(document.indexOf("<w:body>"));
  const out = [];
  let depth = 0;

  // Paragraphs and table edges arrive in document order; everything else is read inside a paragraph.
  for (const m of body.matchAll(/<w:p\b[^>]*(?:\/>|>[\s\S]*?<\/w:p>)|<w:tbl>|<\/w:tbl>|<w:tr\b[^>]*>/g)) {
    const chunk = m[0];
    if (chunk === "<w:tbl>") {
      out.push(`${"  ".repeat(depth)}<<TABLE>>`);
      depth++;
      continue;
    }
    if (chunk === "</w:tbl>") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (chunk.startsWith("<w:tr")) {
      out.push(`${"  ".repeat(depth)}<<ROW>>`);
      continue;
    }
    const line = paragraph(chunk, rels);
    if (!line) continue;
    const numPr = chunk.match(/<w:numPr>[\s\S]*?<\/w:numPr>/)?.[0];
    const numId = numPr ? attr(numPr.match(/<w:numId\b[^>]*>/)?.[0] ?? "", "val") : null;
    const ilvl = numPr ? (attr(numPr.match(/<w:ilvl\b[^>]*>/)?.[0] ?? "", "val") ?? "0") : "0";
    out.push(`${"  ".repeat(depth)}${numId ? marker(numId, ilvl) : ""}${line}`);
  }
  return out.join("\n");
}

function paragraph(xml, rels) {
  // A paragraph's own properties would otherwise be read as a run's: drop them first.
  const runs = xml.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, "").matchAll(/<w:r\b[^>]*(?:\/>|>[\s\S]*?<\/w:r>)/g);
  let line = "";
  for (const r of runs) {
    const run = r[0];
    let text = "";
    for (const piece of run.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?>|<w:br\b[^>]*\/?>|<a:blip\b[^>]*\/?>/g)) {
      if (piece[1] !== undefined) text += decode(piece[1]);
      else if (piece[0].startsWith("<w:tab")) text += "\t";
      else if (piece[0].startsWith("<w:br")) text += "\n";
      else {
        const id = piece[0].match(/r:embed="([^"]*)"/)?.[1] ?? "?";
        text += `[[IMAGE rel=${id} src=${rels.get(id) ?? "?"}]]`;
      }
    }
    if (!text) continue;
    const rPr = run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
    const on = (tag) => {
      const t = rPr.match(new RegExp(`<w:${tag}\\b[^>]*/?>`))?.[0];
      return t !== undefined && attr(t, "val") !== "0" && attr(t, "val") !== "false";
    };
    const colour = attr(rPr.match(/<w:color\b[^>]*\/?>/)?.[0] ?? "", "val");
    const marks = [];
    if (colour && !["000000", "auto", "windowtext"].includes(colour.toLowerCase())) marks.push(`c:${colour}`);
    if (on("strike") || on("dstrike")) marks.push("STRIKE");
    if (on("b")) marks.push("b");
    const hl = attr(rPr.match(/<w:highlight\b[^>]*\/?>/)?.[0] ?? "", "val");
    if (hl && hl !== "none") marks.push(`hl:${hl}`);
    line += marks.length ? `{${marks.join("|")}}${text}{/}` : text;
  }
  return line;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error("Cách dùng: node scripts/docx-text.mjs <tệp.docx>");
    process.exit(2);
  }
  console.log(docxToText(readFileSync(file)));
}
