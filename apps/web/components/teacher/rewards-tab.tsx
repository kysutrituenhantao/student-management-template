"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { ClassOverview, Redemption, Reward } from "@lhhp/shared";
import { Empty, Field, FormError, Loading, LoadError, Sheet, toast } from "@/components/ui";
import { del, patch, post } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const STATUS = { pending: "Đang chờ", approved: "Đã trao", rejected: "Cô chưa đồng ý", cancelled: "Con đã huỷ" } as const;

export function RewardsTab({ overview, reload: reloadClass }: { overview: ClassOverview; reload(): void }) {
  const classId = overview.class.id;
  const rewards = useApi<Reward[]>(`/api/t/classes/${classId}/rewards`);
  const reds = useApi<Redemption[]>(`/api/t/classes/${classId}/redemptions`);
  const [editing, setEditing] = useState<Reward | "new" | null>(null);
  const [giving, setGiving] = useState(false);
  const pending = (reds.data ?? []).filter((r) => r.status === "pending");
  const history = (reds.data ?? []).filter((r) => r.status !== "pending").slice(0, 30);

  const refresh = () => {
    void reds.reload();
    reloadClass();
  };

  async function decide(r: Redemption, status: "approved" | "rejected") {
    const res = await patch(`/api/t/redemptions/${r.id}`, { status });
    if (!res.ok) return toast(res.message, "error");
    toast(status === "approved" ? `Đã trao “${r.rewardName}” cho ${r.fullName}.` : "Đã trả lại giọt nước cho con.");
    refresh();
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-[2rem] font-extrabold">🎁 Đổi thưởng</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          <Plus size={18} /> Thêm phần quà
        </button>
      </div>

      <section className="paper flex flex-wrap items-center gap-4 p-4">
        <span className="text-4xl" aria-hidden>
          🎁
        </span>
        <div className="min-w-[240px] flex-1">
          <h2 className="text-xl font-extrabold">Trao quà cho một bạn</h2>
          <p className="text-ink-soft">
            Cô chọn bạn và phần quà, giọt nước sẽ được trừ ngay. <strong>Cây của con không nhỏ lại</strong> — con chỉ cần
            cố gắng thêm để cây lớn tiếp.
          </p>
        </div>
        <button type="button" className="btn btn-gold text-lg" onClick={() => setGiving(true)}>
          Trao quà
        </button>
      </section>

      {/* Nothing new can land here: a family no longer asks. Left in so a request from before can still be settled. */}
      {pending.length ? (
        <section className="paper p-4">
          <h2 className="text-xl font-extrabold">Yêu cầu đổi quà còn lại từ trước</h2>
          <ul className="mt-3 grid gap-2">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-gold-soft px-3 py-2">
                <span className="text-2xl" aria-hidden>
                  {r.emoji}
                </span>
                <span className="min-w-[180px] flex-1">
                  <strong>{r.fullName}</strong> muốn đổi <strong>{r.rewardName}</strong>
                  <span className="block text-sm text-ink-soft">
                    {r.cost} 💧, {timeAgo(r.requestedAt)}
                  </span>
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => decide(r, "rejected")}>
                  Chưa đồng ý
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => decide(r, "approved")}>
                  Trao quà
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-xl font-extrabold">Các phần quà của lớp</h2>
        <p className="text-ink-soft">Chạm vào một phần quà để sửa tên hoặc số giọt nước cần đổi.</p>
        {rewards.error ? (
          <LoadError message={rewards.error} onRetry={rewards.reload} />
        ) : !rewards.data ? (
          <Loading />
        ) : rewards.data.length === 0 ? (
          <Empty emoji="🎁" title="Chưa có phần quà nào" />
        ) : (
          <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5">
            {rewards.data.map((r, i) => (
              <li key={r.id}>
                <button type="button" onClick={() => setEditing(r)} className={cn("sticker block w-full p-4 text-center", `group-${(i % 8) + 1}`, !r.active && "opacity-50")}>
                  <span className="text-4xl" aria-hidden>
                    {r.emoji}
                  </span>
                  <span className="mt-1 block font-bold leading-tight">{r.name}</span>
                  <span className="point-count mt-1 justify-center">💧 {r.cost}</span>
                  {!r.active ? <span className="block text-xs text-ink-soft">Đang ẩn</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {history.length ? (
        <section className="paper p-4">
          <h2 className="text-xl font-extrabold">Đã xử lý gần đây</h2>
          <ul className="mt-2 grid gap-1 text-[0.95rem]">
            {history.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-2">
                <span>
                  {r.emoji} <strong>{r.fullName}</strong>: {r.rewardName} ({r.cost} 💧)
                </span>
                <span className="text-ink-soft">
                  {STATUS[r.status]}, {timeAgo(r.decidedAt ?? r.requestedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <RewardEditor
        open={editing !== null}
        reward={editing === "new" ? null : editing}
        classId={classId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void rewards.reload();
        }}
      />
      <GiveReward open={giving} overview={overview} rewards={(rewards.data ?? []).filter((r) => r.active)} onClose={() => setGiving(false)} onGiven={refresh} />
    </div>
  );
}

const REWARD_EMOJIS = ["🎁", "🦄", "✏️", "🪑", "🧑‍🏫", "🎟️", "📒", "🍭", "🎈", "🏅", "📚", "🧸", "⚽", "🎨", "🌟", "🍀"];

function RewardEditor({ open, reward, classId, onClose, onSaved }: { open: boolean; reward: Reward | null; classId: number; onClose(): void; onSaved(): void }) {
  const [f, setF] = useState({ name: "", emoji: "🎁", cost: "20", active: true });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (open && !lastOpen) {
    setLastOpen(true);
    setF(reward ? { name: reward.name, emoji: reward.emoji, cost: String(reward.cost), active: reward.active } : { name: "", emoji: "🎁", cost: "20", active: true });
    setError(null);
  }
  if (!open && lastOpen) setLastOpen(false);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={reward ? "Sửa phần quà" : "Thêm phần quà"}
      footer={
        <>
          {reward ? (
            <button
              type="button"
              className="btn btn-danger mr-auto"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm(`Xoá phần quà “${reward.name}”?`)) return;
                const r = await del(`/api/t/rewards/${reward.id}`);
                if (!r.ok) return setError(r.message);
                toast("Đã xoá phần quà.");
                onSaved();
              }}
            >
              Xoá
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              const body = { name: f.name, emoji: f.emoji, cost: Number(f.cost), active: f.active };
              setBusy(true);
              const r = reward ? await patch(`/api/t/rewards/${reward.id}`, body) : await post(`/api/t/classes/${classId}/rewards`, body);
              setBusy(false);
              if (!r.ok) return setError(r.message);
              toast("Đã lưu phần quà.");
              onSaved();
            }}
          >
            Lưu
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Tên phần quà" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ví dụ: Được làm lớp trưởng 1 ngày" />
        <fieldset>
          <legend className="mb-2 font-semibold">Biểu tượng</legend>
          <div className="flex flex-wrap gap-1.5">
            {REWARD_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={f.emoji === e}
                onClick={() => setF({ ...f, emoji: e })}
                className={cn("grid h-11 w-11 place-items-center rounded-xl text-2xl", f.emoji === e ? "bg-pink-soft ring-2 ring-pink-ink" : "bg-page")}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>
        <Field type="number" min={1} max={1000} label="Cần bao nhiêu giọt nước" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-[var(--pink-ink)]" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          Còn dùng (hiện trong danh sách trao quà)
        </label>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}

function GiveReward({ open, overview, rewards, onClose, onGiven }: { open: boolean; overview: ClassOverview; rewards: Reward[]; onClose(): void; onGiven(): void }) {
  const [studentId, setStudentId] = useState("");
  const [rewardId, setRewardId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  // A fresh form each time the sheet opens: never the last child and reward.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStudentId("");
      setRewardId("");
      setError(null);
    }
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Trao quà tại lớp"
      footer={
        <button
          type="button"
          className="btn btn-primary"
          disabled={!studentId || !rewardId || busy}
          onClick={async () => {
            setBusy(true);
            const r = await post<Redemption>(`/api/t/classes/${overview.class.id}/redemptions`, { studentId: Number(studentId), rewardId: Number(rewardId) });
            setBusy(false);
            if (!r.ok) return setError(r.message);
            toast(`Đã trao “${r.data.rewardName}” cho ${r.data.fullName}.`);
            setError(null);
            onGiven();
            onClose();
          }}
        >
          Trao quà và trừ giọt nước
        </button>
      }
    >
      <div className="grid gap-4">
        <p className="text-ink-soft">
          Giọt nước được trừ ngay khi cô trao quà. Cây của con vẫn giữ nguyên — nước mất đi không làm cây nhỏ lại.
        </p>
        <label className="field">
          <span>Học sinh</span>
          <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Chọn học sinh…</option>
            {overview.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} (💧 {s.points})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Phần quà</span>
          <select className="input" value={rewardId} onChange={(e) => setRewardId(e.target.value)}>
            <option value="">Chọn phần quà…</option>
            {rewards.map((r) => (
              <option key={r.id} value={r.id}>
                {r.emoji} {r.name} ({r.cost} 💧)
              </option>
            ))}
          </select>
        </label>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
