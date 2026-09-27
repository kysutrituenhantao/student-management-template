"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { IMAGE_LIMITS, type ClassOverview, type ClassDetail } from "@lhhp/shared";
import { toast } from "@/components/ui";
import { put } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { resizeImage } from "@/lib/image";

/** The class cover: a class photo the teacher uploads, or the green board until she does. */
export function ClassCover({ overview, onChange }: { overview: ClassOverview; onChange(c: ClassDetail): void }) {
  const c = overview.class;
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(f: File) {
    setBusy(true);
    try {
      const dataUrl = await resizeImage(f, IMAGE_LIMITS.cover);
      const r = await put<ClassDetail>(`/api/t/classes/${c.id}/cover`, { dataUrl });
      if (!r.ok) throw new Error(r.message);
      onChange(r.data);
      toast("Đã đổi ảnh bìa.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Không tải được ảnh.", "error");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  const facts = (
    <ul className="mt-3 flex flex-wrap gap-2 text-[0.9rem] font-semibold">
      <li className="rounded-full bg-white/90 px-3 py-1 text-ink">🧑‍🏫 {c.teacherName}</li>
      <li className="rounded-full bg-white/90 px-3 py-1 text-ink">👧👦 {overview.stats.students} học sinh</li>
      {overview.schoolWeek > 0 ? (
        <li className="rounded-full bg-white/90 px-3 py-1 text-ink">
          📅 Tuần {overview.schoolWeek}, học kỳ {overview.semester === 1 ? "I" : "II"}
        </li>
      ) : null}
      <li className="rounded-full bg-gold px-3 py-1 text-ink">💧 {formatNumber(overview.stats.totalPoints)} giọt nước cả lớp</li>
    </ul>
  );

  return (
    <section className="relative overflow-hidden rounded-[18px] border-4 border-white shadow-[0_0_0_2px_#ffc2d8,0_6px_0_1px_#ffa9c7]">
      {c.coverUrl ? (
        <div className="relative h-[240px] sm:h-[320px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.coverUrl} alt={`Ảnh cả lớp ${c.name}`} className="absolute inset-0 h-full w-full object-cover" />
          <div
            className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-16 text-white sm:px-8"
            style={{ background: `linear-gradient(to top, rgba(40,22,52,${c.coverShade + 0.25}), rgba(40,22,52,${c.coverShade * 0.6}) 60%, transparent)` }}
          >
            <h1 className="font-display text-[2.2rem] font-extrabold leading-none drop-shadow sm:text-[3rem]">🌸 {c.name}</h1>
            {c.motto ? <p className="mt-1 font-hand text-[1.05rem] drop-shadow">❤️ {c.motto}</p> : null}
            {facts}
          </div>
        </div>
      ) : (
        <div className="chalkboard !rounded-none !border-0 px-5 py-8 sm:px-10 sm:py-10">
          <p aria-hidden className="text-2xl">
            🌸 💧 📚 ☁️ 🌈
          </p>
          <h1 className="mt-2 font-display text-[2.4rem] font-extrabold leading-none sm:text-[3.2rem]">{c.name}</h1>
          {c.motto ? <p className="mt-2 font-hand text-[1.1rem] text-[#dff3e8]">{c.motto}</p> : null}
          {facts}
        </div>
      )}
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button
        type="button"
        className="no-print btn btn-sm absolute right-3 top-3 bg-white/90 text-ink hover:bg-white"
        onClick={() => file.current?.click()}
        disabled={busy}
      >
        <ImagePlus size={16} /> {busy ? "Đang tải ảnh…" : c.coverUrl ? "Đổi ảnh bìa" : "Tải ảnh cả lớp"}
      </button>
    </section>
  );
}
