"use client";

import { useState, type FormEvent } from "react";
import type { ClassDetail } from "@lhhp/shared";
import { Field, FormError, TextArea, toast } from "@/components/ui";
import { patch, post } from "@/lib/api";
import { todayLocal } from "@/lib/format";

function currentSchoolYear(): string {
  const [y, m] = todayLocal().split("-").map(Number);
  const start = m! >= 7 ? y! : y! - 1;
  return `${start}-${start + 1}`;
}

/** Create a class, or edit one (with its semester dates and leaderboard setting). */
export function ClassForm({ initial, submitLabel, onSaved }: { initial?: ClassDetail; submitLabel: string; onSaved(c: ClassDetail): void }) {
  const sy = initial?.schoolYear ?? currentSchoolYear();
  const [f, setF] = useState({
    name: initial?.name ?? "",
    grade: String(initial?.grade ?? 4),
    schoolYear: sy,
    motto: initial?.motto ?? "Học vui mỗi ngày – Tiến bộ từng giờ – Tràn ngập yêu thương",
    groupCount: String(initial?.groupCount ?? 4),
    showLeaderboard: initial?.showLeaderboard ?? true,
    hk1Start: initial?.semesters.hk1Start ?? "",
    hk1End: initial?.semesters.hk1End ?? "",
    hk2Start: initial?.semesters.hk2Start ?? "",
    hk2End: initial?.semesters.hk2End ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    const body: Record<string, unknown> = {
      name: f.name,
      grade: Number(f.grade),
      schoolYear: f.schoolYear,
      motto: f.motto,
      groupCount: Number(f.groupCount),
      showLeaderboard: f.showLeaderboard,
    };
    if (initial) Object.assign(body, { hk1Start: f.hk1Start, hk1End: f.hk1End, hk2Start: f.hk2Start, hk2End: f.hk2End });
    const r = initial ? await patch<ClassDetail>(`/api/t/classes/${initial.id}`, body) : await post<ClassDetail>("/api/t/classes", body);
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      setError(r.message);
      return;
    }
    if (initial) toast("Đã lưu thông tin lớp.");
    onSaved(r.data);
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Field label="Tên lớp" placeholder="Ví dụ: Lớp 4A" value={f.name} onChange={set("name")} error={errors.name} required />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="field">
          <span>Khối</span>
          <select className="input" value={f.grade} onChange={set("grade")}>
            {[1, 2, 3, 4, 5].map((g) => (
              <option key={g} value={g}>
                Lớp {g}
              </option>
            ))}
          </select>
        </label>
        <Field label="Năm học" value={f.schoolYear} onChange={set("schoolYear")} error={errors.schoolYear} placeholder="2026-2027" />
        <label className="field">
          <span>Số tổ</span>
          <select className="input" value={f.groupCount} onChange={set("groupCount")}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
              <option key={g} value={g}>
                {g} tổ
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="rounded-xl bg-pink-soft px-4 py-3 text-sm">
        🔑 Mỗi bạn được ứng dụng tạo <strong>tên đăng nhập và mật khẩu riêng</strong> (ví dụ: <code>an.k7m4</code> và{" "}
        <code>k9mp42</code>). Cô xem lại được bất cứ lúc nào ở mục <strong>Học sinh → Tài khoản cả lớp</strong> để gửi
        cho phụ huynh.
      </p>
      <TextArea label="Khẩu hiệu của lớp" value={f.motto} onChange={set("motto")} error={errors.motto} rows={2} className="[&_textarea]:min-h-[64px]" />
      {initial ? (
        <>
          <fieldset className="grid gap-3 rounded-xl border border-line p-4">
            <legend className="px-1 font-semibold">Học kỳ</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field type="date" label="Học kỳ I bắt đầu" value={f.hk1Start} onChange={set("hk1Start")} error={errors.hk1Start} />
              <Field type="date" label="Học kỳ I kết thúc" value={f.hk1End} onChange={set("hk1End")} error={errors.hk1End} />
              <Field type="date" label="Học kỳ II bắt đầu" value={f.hk2Start} onChange={set("hk2Start")} error={errors.hk2Start} />
              <Field type="date" label="Học kỳ II kết thúc" value={f.hk2End} onChange={set("hk2End")} error={errors.hk2End} />
            </div>
          </fieldset>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-[var(--pink-ink)]"
              checked={f.showLeaderboard}
              onChange={(e) => setF((x) => ({ ...x, showLeaderboard: e.target.checked }))}
            />
            <span>
              <span className="font-semibold">Cho học sinh và phụ huynh xem Top 10 của tuần</span>
              <br />
              <small className="text-ink-soft">Tắt nếu cô chỉ muốn mỗi gia đình thấy kết quả của con mình.</small>
            </span>
          </label>
        </>
      ) : null}
      <FormError message={error && !Object.values(errors).includes(error) ? error : null} />
      <button type="submit" className="btn btn-primary" disabled={busy || !f.name}>
        {busy ? "Đang lưu…" : submitLabel}
      </button>
    </form>
  );
}
