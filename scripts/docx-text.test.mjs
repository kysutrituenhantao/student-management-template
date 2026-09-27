import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { docxToText, unzip } from "./docx-text.mjs";

/** The smallest zip this needs: one entry per file, deflated, CRCs left at zero (nothing here checks them). */
function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name, "utf8");
    const data = deflateRawSync(Buffer.from(text, "utf8"));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(Buffer.byteLength(text), 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(Buffer.byteLength(text), 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const body = Buffer.concat(locals);
  const dirBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(dirBuf.length, 12);
  end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, dirBuf, end]);
}

const run = (text, rPr = "") => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const para = (inner, pPr = "") => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${inner}</w:p>`;

const NUMBERING = `<w:numbering><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl>
  <w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

const docx = (body, extra = {}) =>
  zip({
    "word/document.xml": `<?xml version="1.0"?><w:document><w:body>${body}</w:body></w:document>`,
    "word/numbering.xml": NUMBERING,
    ...extra,
  });

test("a red run is marked and a black one is not — this is how 'still to do' is told from 'done'", () => {
  const out = docxToText(
    docx(para(run("Đã xong rồi")) + para(run("Cần sửa", '<w:color w:val="FF0000"/>'))),
  );
  assert.equal(out, "Đã xong rồi\n{c:FF0000}Cần sửa{/}");
});

test("black is left unmarked however Word spells it", () => {
  for (const val of ["000000", "auto", "windowtext"]) {
    assert.equal(docxToText(docx(para(run("Ổn", `<w:color w:val="${val}"/>`)))), "Ổn");
  }
});

test("a real strikethrough is reported, and w:val='0' turns one off", () => {
  assert.equal(docxToText(docx(para(run("Bỏ", "<w:strike/>")))), "{STRIKE}Bỏ{/}");
  assert.equal(docxToText(docx(para(run("Giữ", '<w:strike w:val="0"/>')))), "Giữ");
});

test("numbered items are counted and bullets are indented", () => {
  const numPr = (ilvl) => `<w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="1"/></w:numPr>`;
  const out = docxToText(
    docx(
      para(run("Một"), numPr(0)) +
        para(run("Hai"), numPr(0)) +
        para(run("chi tiết"), numPr(1)) +
        para(run("Ba"), numPr(0)),
    ),
  );
  assert.equal(out, "1. Một\n2. Hai\n  - chi tiết\n3. Ba");
});

test("a paragraph's own colour is not read as a run's", () => {
  const out = docxToText(docx(para(run("Tiêu đề"), '<w:rPr><w:color w:val="FF0000"/></w:rPr>')));
  assert.equal(out, "Tiêu đề");
});

test("tables keep their shape and empty paragraphs are dropped", () => {
  const out = docxToText(docx(`<w:tbl><w:tr><w:tc>${para(run("Tên"))}${para("")}</w:tc></w:tr></w:tbl>`));
  assert.equal(out, "<<TABLE>>\n  <<ROW>>\n  Tên");
});

test("an image is named by what it points at, so a screenshot is never silently lost", () => {
  const out = docxToText(
    docx(`<w:p><w:r><w:drawing><a:blip r:embed="rId5"/></w:drawing></w:r></w:p>`, {
      "word/_rels/document.xml.rels": `<Relationships><Relationship Id="rId5" Target="media/image1.jpeg"/></Relationships>`,
    }),
  );
  assert.equal(out, "[[IMAGE rel=rId5 src=media/image1.jpeg]]");
});

test("runs keep their order, and entities and breaks survive", () => {
  const out = docxToText(
    docx(para(run("Cô &amp; trò") + `<w:r><w:br/></w:r>` + run("tiếp", '<w:b/><w:color w:val="FF0000"/>'))),
  );
  assert.equal(out, "Cô & trò\n{c:FF0000|b}tiếp{/}");
});

test("unzip reads every entry back", () => {
  const files = unzip(zip({ "a.txt": "một", "b/c.txt": "hai" }));
  assert.equal(files.get("a.txt").toString("utf8"), "một");
  assert.equal(files.get("b/c.txt").toString("utf8"), "hai");
});

test("something that is not a .docx says so", () => {
  assert.throws(() => docxToText(Buffer.from("không phải zip")), /docx/);
});
