"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { POINT_CATEGORIES, POINT_CATEGORY_INFO, type ClassOverview, type PointCategory, type Reason } from "@lhhp/shared";
import { Confirm, Empty, Field, FormError, Sheet, toast } from "@/components/ui";
import { del, patch, post } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * "Điểm cộng" and "Điểm trừ" (brief 7): the criteria she scores by, each worth a number of drops — "Chăm chỉ cộng 2
 * giọt nước; Không làm BT trừ 2 giọt nước". Two little tabs under Đổi thưởng. On Trang chủ, a criterion in the scoring
 * sheet gives exactly its drops in one tap.
 */

type Kind = Reason["kind"];
type Draft = { label: string; emoji: string; category: PointCategory; drops: number };

const COPY: Record<Kind, { title: string; emoji: string; intro: string; example: string; add: string }> = {
  plus: {
    title: "Điểm cộng",
    emoji: "💧",
    intro: "Những việc tốt được cộng giọt nước. Ở Trang chủ, cô bấm vào tên con rồi bấm tiêu chí là con được cộng đúng số giọt ấy.",
    example: "Ví dụ: Chăm chỉ",
    add: "Thêm điểm cộng",
  },
  minus: {
    title: "Điểm trừ",
    emoji: "🔔",
    intro: "Những điều cần nhắc nhở, trừ giọt nước. Giọt nước bị trừ không làm cây của con nhỏ lại.",
    example: "Ví dụ: Không làm BT",
    add: "Thêm điểm trừ",
  },
};

const signed = (kind: Kind, n: number) => `${kind === "plus" ? "+" : "−"}${n} 💧`;

export function CriteriaTab({ overview, kind, reload }: { overview: ClassOverview; kind: Kind; reload(): void }) {
  const copy = COPY[kind];
  const list = overview.reasons.filter((r) => r.kind === kind);
  const [editing, setEditing] = useState<Reason | "new" | null>(null);
  const [removing, setRemoving] = useState<Reason | null>(null);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-[2rem] font-extrabold">
          {copy.emoji} {copy.title}
        </h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          <Plus size={18} /> {copy.add}
        </button>
      </div>
      <p className="-mt-3 text-ink-soft">{copy.intro}</p>

      {list.length === 0 ? (
        <Empty emoji={copy.emoji} title={`Chưa có tiêu chí ${copy.title.toLowerCase()} nào`}>
          Bấm “{copy.add}” để thêm tiêu chí đầu tiên.
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={`Tiêu chí ${copy.title.toLowerCase()}`}>
          {list.map((r) => (
            <li key={r.id} className={cn("paper flex items-center gap-3 p-3", kind === "minus" && "!border-[#f3b3bc]")}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-page text-2xl" aria-hidden>
                {r.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-bold">{r.label}</p>
                <p className="text-sm text-ink-soft">{POINT_CATEGORY_INFO[r.category].label}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-lg font-extrabold",
                  kind === "plus" ? "bg-gold-soft text-gold-ink" : "bg-pink-soft text-red-pen",
                )}
              >
                {signed(kind, r.drops)}
              </span>
              <span className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-full hover:bg-pink-soft"
                  aria-label={`Sửa ${r.label}`}
                  onClick={() => setEditing(r)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-full text-red-pen hover:bg-pink-soft"
                  aria-label={`Xoá ${r.label}`}
                  onClick={() => setRemoving(r)}
                >
                  <Trash2 size={15} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <CriterionSheet
        kind={kind}
        classId={overview.class.id}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <Confirm
        open={removing !== null}
        title={`Xoá “${removing?.label ?? ""}”?`}
        body={<p>Tiêu chí này không còn hiện khi chấm điểm. Những giọt nước đã cho theo tiêu chí này vẫn giữ nguyên trong lịch sử.</p>}
        action="Xoá"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const r = removing;
          setRemoving(null);
          if (!r) return;
          const res = await del(`/api/t/reasons/${r.id}`);
          if (!res.ok) return toast(res.message, "error");
          toast(`Đã xoá “${r.label}”.`);
          reload();
        }}
      />
    </div>
  );
}

function CriterionSheet({
  kind,
  classId,
  editing,
  onClose,
  onSaved,
}: {
  kind: Kind;
  classId: number;
  editing: Reason | "new" | null;
  onClose(): void;
  onSaved(): void;
}) {
  const copy = COPY[kind];
  const blank: Draft = { label: "", emoji: kind === "plus" ? "⭐" : "📝", category: "hoc_tap", drops: 1 };
  const [f, setF] = useState<Draft>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<Reason | "new" | null>(null);
  // Fill the form each time the sheet opens, from the criterion or blank.
  if (editing !== openedFor) {
    setOpenedFor(editing);
    setErrors({});
    setF(editing && editing !== "new" ? { label: editing.label, emoji: editing.emoji, category: editing.category, drops: editing.drops } : blank);
  }

  async function save() {
    setBusy(true);
    setErrors({});
    const body = { ...f, label: f.label.trim(), kind };
    const r = editing && editing !== "new" ? await patch(`/api/t/reasons/${editing.id}`, body) : await post(`/api/t/classes/${classId}/reasons`, body);
    setBusy(false);
    if (!r.ok) return setErrors(r.fields ?? { _: r.message });
    toast(editing === "new" ? `Đã thêm “${body.label}”.` : `Đã lưu “${body.label}”.`);
    onSaved();
  }

  const step = (d: number) => setF((x) => ({ ...x, drops: Math.min(20, Math.max(1, x.drops + d)) }));

  return (
    <Sheet
      open={editing !== null}
      onClose={onClose}
      title={editing === "new" ? copy.add : `Sửa ${copy.title.toLowerCase()}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Thôi
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !f.label.trim()} onClick={save}>
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-[6.5rem_1fr] gap-2">
          <Field label="Biểu tượng" value={f.emoji} maxLength={4} onChange={(e) => setF({ ...f, emoji: e.target.value })} error={errors.emoji} />
          <Field
            label="Tiêu chí"
            value={f.label}
            maxLength={80}
            placeholder={copy.example}
            onChange={(e) => setF({ ...f, label: e.target.value })}
            error={errors.label}
            data-autofocus
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-[0.9375rem] font-semibold">Số giọt nước {kind === "plus" ? "được cộng" : "bị trừ"}</legend>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost !min-h-[48px] !w-12 !px-0 text-xl" aria-label="Bớt một giọt" onClick={() => step(-1)}>
              −
            </button>
            <input
              className="input !w-24 text-center text-xl font-extrabold"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              aria-label="Số giọt nước"
              value={f.drops}
              onChange={(e) => setF({ ...f, drops: Math.trunc(Number(e.target.value)) || 0 })}
            />
            <button type="button" className="btn btn-ghost !min-h-[48px] !w-12 !px-0 text-xl" aria-label="Thêm một giọt" onClick={() => step(1)}>
              +
            </button>
            <span className={cn("ml-2 text-xl font-extrabold", kind === "plus" ? "text-gold-ink" : "text-red-pen")}>{signed(kind, f.drops)}</span>
          </div>
          {errors.drops ? <small className="field-error">{errors.drops}</small> : null}
        </fieldset>
        <label className="field">
          <span>Nhóm (để xem trong Báo cáo)</span>
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as PointCategory })}>
            {POINT_CATEGORIES.filter((c) => c !== "chung").map((c) => (
              <option key={c} value={c}>
                {POINT_CATEGORY_INFO[c].label}
              </option>
            ))}
          </select>
        </label>
        <FormError message={errors._ ?? null} />
      </div>
    </Sheet>
  );
}
