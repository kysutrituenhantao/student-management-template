"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ClassDetail, ClassOverview } from "@lhhp/shared";
import { Confirm, Field, toast } from "@/components/ui";
import { del, patch } from "@/lib/api";
import { ClassForm } from "./class-form";

export function SettingsTab({
  overview,
  setOverview,
  reload,
}: {
  overview: ClassOverview;
  setOverview(fn: (o: ClassOverview) => ClassOverview): void;
  reload(): void;
}) {
  const router = useRouter();
  const cls = overview.class;
  const [shade, setShade] = useState(cls.coverShade);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");

  return (
    <div className="grid gap-8">
      <h1 className="text-[2rem] font-extrabold">⚙️ Cài đặt lớp</h1>
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section className="paper p-5">
          <h2 className="mb-4 text-xl font-extrabold">Thông tin lớp</h2>
          <ClassForm
            initial={cls}
            submitLabel="Lưu thông tin lớp"
            onSaved={(c: ClassDetail) => {
              setOverview((o) => ({ ...o, class: c }));
              // Fewer groups or another password mode changes the students too.
              reload();
            }}
          />
        </section>
        <div className="grid gap-8">
          <section className="paper p-5">
            <h2 className="text-xl font-extrabold">Ảnh bìa</h2>
            <p className="text-sm text-ink-soft">Đổi ảnh ở Trang chủ, bấm nút “Đổi ảnh bìa” trên ảnh.</p>
            <label className="mt-3 grid gap-1">
              <span className="font-semibold">Độ tối của dải chữ trên ảnh: {Math.round(shade * 100)}%</span>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={shade}
                onChange={(e) => setShade(Number(e.target.value))}
                onPointerUp={async () => {
                  const r = await patch<ClassDetail>(`/api/t/classes/${cls.id}`, { coverShade: shade });
                  if (r.ok) setOverview((o) => ({ ...o, class: r.data }));
                }}
                onKeyUp={async () => {
                  const r = await patch<ClassDetail>(`/api/t/classes/${cls.id}`, { coverShade: shade });
                  if (r.ok) setOverview((o) => ({ ...o, class: r.data }));
                }}
                className="accent-[var(--pink-ink)]"
              />
              <small className="text-ink-soft">Tăng lên nếu chữ khó đọc, giảm xuống để thấy rõ ảnh cả lớp.</small>
            </label>
            {cls.coverUrl ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-3"
                onClick={async () => {
                  const r = await del(`/api/t/classes/${cls.id}/cover`);
                  if (!r.ok) return toast(r.message, "error");
                  setOverview((o) => ({ ...o, class: { ...o.class, coverUrl: null } }));
                  toast("Đã bỏ ảnh bìa.");
                }}
              >
                Bỏ ảnh bìa, dùng bảng xanh
              </button>
            ) : null}
          </section>
          {/* The criteria moved to Đổi thưởng → Điểm cộng / Điểm trừ, with their drops (brief 7). */}
        </div>
      </div>

      <section className="rounded-2xl border-2 border-[#f3b3bc] bg-white p-5">
        <h2 className="text-xl font-extrabold text-red-pen">Xoá lớp</h2>
        <p className="mt-1">Xoá lớp cùng toàn bộ học sinh, tài khoản, giọt nước, nhiệm vụ và tin nhắn. Không hoàn tác được.</p>
        <button type="button" className="btn btn-danger mt-3" onClick={() => setDeleting(true)}>
          Xoá lớp {cls.name}
        </button>
      </section>
      <Confirm
        open={deleting}
        danger
        title={`Xoá lớp ${cls.name}?`}
        action="Xoá vĩnh viễn"
        onClose={() => {
          setDeleting(false);
          setTyped("");
        }}
        body={
          <div className="grid gap-3">
            <p>{overview.stats.students} học sinh sẽ không đăng nhập được nữa. Gõ tên lớp để xác nhận.</p>
            <Field label="Tên lớp" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={cls.name} />
          </div>
        }
        onConfirm={async () => {
          if (typed.trim() !== cls.name) return toast("Tên lớp chưa khớp.", "error");
          const r = await del(`/api/t/classes/${cls.id}`);
          if (!r.ok) return toast(r.message, "error");
          toast("Đã xoá lớp.");
          router.replace("/giao-vien/");
        }}
      />
    </div>
  );
}
