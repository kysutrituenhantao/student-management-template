"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import type { BadgeDef, ClassOverview } from "@lhhp/shared";
import { Avatar, Field, FormError, Loading, LoadError, Sheet, TextArea, toast } from "@/components/ui";
import { api, del, post } from "@/lib/api";
import { firstName } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

interface Held {
  studentId: number;
  key: string;
  source: string;
  note: string | null;
  awardedAt: string;
}

export function BadgesTab({ overview, reload: reloadClass }: { overview: ClassOverview; reload(): void }) {
  const { data, error, reload } = useApi<Held[]>(`/api/t/classes/${overview.class.id}/badges`);
  const [awarding, setAwarding] = useState<BadgeDef | null>(null);
  const [editing, setEditing] = useState<BadgeDef | null>(null);
  const holders = useMemo(() => {
    const m = new Map<string, Held[]>();
    for (const h of data ?? []) m.set(h.key, [...(m.get(h.key) ?? []), h]);
    return m;
  }, [data]);
  const name = (id: number) => overview.students.find((s) => s.id === id);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-[2rem] font-extrabold">🏅 Huy hiệu</h1>
        <p className="text-ink-soft">
          Huy hiệu có dấu ✨ do app tự trao khi con đạt mốc. Các huy hiệu còn lại cô trao khi muốn khen con. Bấm ✏️ để đổi biểu
          tượng, tên hay nội dung của huy hiệu.
        </p>
      </div>
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {/* In her words and icons where she changed them (brief 12). */}
          {overview.badgeDefs.map((b, i) => {
            const list = holders.get(b.key) ?? [];
            return (
              <li key={b.key} className={cn("sticker flex flex-col p-4", `group-${(i % 8) + 1}`)}>
                <div className="relative flex items-start gap-3 pr-9">
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 grid h-10 w-10 place-items-center rounded-full bg-white/70 hover:bg-white"
                    aria-label={`Sửa huy hiệu ${b.name}`}
                    onClick={() => setEditing(b)}
                  >
                    <Pencil size={16} />
                  </button>
                  <span className="text-4xl" aria-hidden>
                    {b.emoji}
                  </span>
                  <div className="flex-1">
                    <h2 className="text-lg font-extrabold leading-tight">
                      {b.name} {b.auto ? <span title="App tự trao">✨</span> : null}
                    </h2>
                    <p className="text-sm text-ink-soft">{b.description}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold">{list.length ? `${list.length} bạn đã có` : "Chưa bạn nào có"}</p>
                <ul className="mt-1 flex flex-wrap gap-1">
                  {list.map((h) => {
                    const s = name(h.studentId);
                    return s ? (
                      <li key={h.studentId}>
                        <button
                          type="button"
                          className="chip !min-h-[30px] !px-2 text-sm"
                          title={b.auto ? s.fullName : `Bấm để thu hồi huy hiệu của ${s.fullName}`}
                          disabled={b.auto}
                          onClick={async () => {
                            if (!confirm(`Thu hồi huy hiệu “${b.name}” của ${s.fullName}?`)) return;
                            const r = await del(`/api/t/students/${s.id}/badges/${b.key}`);
                            if (!r.ok) return toast(r.message, "error");
                            void reload();
                          }}
                        >
                          {s.avatarEmoji} {firstName(s.fullName)}
                        </button>
                      </li>
                    ) : null;
                  })}
                </ul>
                {!b.auto ? (
                  <button type="button" className="btn btn-primary btn-sm mt-auto self-start" style={{ marginTop: "0.9rem" }} onClick={() => setAwarding(b)}>
                    Trao huy hiệu
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {editing ? (
        <BadgeEditSheet
          classId={overview.class.id}
          badge={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reloadClass();
          }}
        />
      ) : null}
      <AwardSheet
        badge={awarding}
        overview={overview}
        held={awarding ? (holders.get(awarding.key) ?? []).map((h) => h.studentId) : []}
        onClose={() => setAwarding(null)}
        onDone={() => {
          void reload();
          reloadClass();
        }}
      />
    </div>
  );
}

function AwardSheet({ badge, overview, held, onClose, onDone }: { badge: BadgeDef | null; overview: ClassOverview; held: number[]; onClose(): void; onDone(): void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  if ((badge?.key ?? null) !== open) {
    setOpen(badge?.key ?? null);
    setPicked([]);
    setNote("");
  }
  return (
    <Sheet
      open={badge !== null}
      onClose={onClose}
      title={badge ? `${badge.emoji} Trao “${badge.name}”` : ""}
      footer={
        <button
          type="button"
          className="btn btn-primary"
          disabled={picked.length === 0}
          onClick={async () => {
            const r = await post<{ awarded: number }>(`/api/t/classes/${overview.class.id}/badges`, { studentIds: picked, badgeKey: badge!.key, ...(note ? { note } : {}) });
            if (!r.ok) return toast(r.message, "error");
            toast(`Đã trao huy hiệu cho ${r.data.awarded} bạn.`);
            onDone();
            onClose();
          }}
        >
          Trao cho {picked.length || ""} bạn
        </button>
      }
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-1.5">
          {overview.students.map((s) => {
            const has = held.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className="chip"
                disabled={has}
                aria-pressed={picked.includes(s.id)}
                onClick={() => setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                title={has ? "Đã có huy hiệu này" : undefined}
              >
                <Avatar emoji={s.avatarEmoji} url={null} name={s.fullName} size={22} /> {s.fullName}
                {has ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        <Field label="Lời khen kèm theo (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Đọc xong 5 cuốn sách trong tháng" />
      </div>
    </Sheet>
  );
}

/** "Icon huy hiệu và nội dung Huy hiệu GV có thể chỉnh sửa" (brief 12). The badge itself, and its milestone, stay. */
function BadgeEditSheet({ classId, badge, onClose, onSaved }: { classId: number; badge: BadgeDef; onClose(): void; onSaved(): void }) {
  const [f, setF] = useState({ emoji: badge.emoji, name: badge.name, description: badge.description });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await api<BadgeDef>(`/api/t/classes/${classId}/badge-defs/${badge.key}`, { method: "PUT", body: f });
    setBusy(false);
    if (!r.ok) return setErrors(r.fields ?? { _: r.message });
    toast(`Đã lưu huy hiệu “${r.data.name}”.`);
    onSaved();
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title="Sửa huy hiệu"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Thôi
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !f.name.trim() || !f.emoji.trim()} onClick={save}>
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="flex items-center gap-3 rounded-2xl bg-page p-3">
          <span className="text-5xl" aria-hidden>
            {f.emoji || "🏅"}
          </span>
          <span>
            <span className="block font-display text-xl font-extrabold leading-tight">{f.name || "…"}</span>
            <span className="block text-sm text-ink-soft">{f.description}</span>
          </span>
        </div>
        <div className="grid grid-cols-[6.5rem_1fr] gap-2">
          <Field label="Biểu tượng" value={f.emoji} maxLength={16} onChange={(e) => setF({ ...f, emoji: e.target.value })} error={errors.emoji} />
          <Field label="Tên huy hiệu" value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} data-autofocus />
        </div>
        <TextArea
          label="Nội dung"
          value={f.description}
          maxLength={120}
          rows={2}
          onChange={(e) => setF({ ...f, description: e.target.value })}
          error={errors.description}
          hint={badge.auto ? "Huy hiệu này ứng dụng tự trao khi con đạt mốc. Cô đổi chữ và biểu tượng, mốc vẫn giữ nguyên." : undefined}
        />
        <FormError message={errors._ ?? null} />
      </div>
    </Sheet>
  );
}
