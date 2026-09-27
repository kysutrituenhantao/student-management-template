"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { TASK_STATUS_INFO, type ClassOverview, type Task } from "@lhhp/shared";
import { TaskGrid } from "@/components/task-tile";
import { Confirm, Empty, Field, FormError, Loading, LoadError, Sheet, TextArea, toast } from "@/components/ui";
import { del, patch, post } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

/**
 * Nhiệm vụ: what the class is to do, written once and read by every family. Children hand nothing in here —
 * "k cần HS trả bài trên web, chỉ hiển thị nội dung GV giao việc" (brief 3, item 2). No subjects, and square pastel
 * tiles like Padlet (brief 9).
 */
export function TasksTab({ overview, reload: reloadClass }: { overview: ClassOverview; reload(): void }) {
  const classId = overview.class.id;
  const { data, error, reload } = useApi<Task[]>(`/api/t/classes/${classId}/tasks`);
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [removing, setRemoving] = useState<Task | null>(null);

  const list = data ?? [];
  const refresh = () => {
    void reload();
    reloadClass();
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-[2rem] font-extrabold">📚 Nhiệm vụ</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          <Plus size={18} /> Giao nhiệm vụ mới
        </button>
      </div>
      <p className="text-ink-soft">
        Cô viết việc cần làm, cả lớp và phụ huynh mở ứng dụng là đọc được. Các con làm vào vở như bình thường, không nộp
        bài trên ứng dụng.
      </p>
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty emoji="📝" title="Chưa có nhiệm vụ nào">
          <p>Giao việc cho cả lớp: làm gì, hạn ngày nào. Phụ huynh mở ứng dụng là thấy ngay.</p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => setEditing("new")}>
            Giao nhiệm vụ đầu tiên
          </button>
        </Empty>
      ) : (
        <TaskGrid
          tasks={list}
          label="Các nhiệm vụ"
          corner={(t) => (
            <>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/70" onClick={() => setEditing(t)} aria-label={`Sửa ${t.title}`} title="Sửa">
                <Pencil size={16} />
              </button>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-full text-red-pen hover:bg-white/70"
                onClick={() => setRemoving(t)}
                aria-label={`Xoá ${t.title}`}
                title="Xoá"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
          footer={(t) => (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 font-semibold",
                t.status === "published" ? "bg-white/70 text-mint-ink" : t.status === "draft" ? "bg-gold-soft text-gold-ink" : "bg-line text-ink-soft",
              )}
            >
              {TASK_STATUS_INFO[t.status].label}
            </span>
          )}
        />
      )}

      <TaskEditor
        open={editing !== null}
        task={editing === "new" ? null : editing}
        classId={classId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
      <Confirm
        open={removing !== null}
        title="Xoá nhiệm vụ?"
        danger
        body={<p>Xoá <strong>{removing?.title}</strong>. Cả lớp sẽ không còn thấy việc này nữa.</p>}
        action="Xoá nhiệm vụ"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const r = await del(`/api/t/tasks/${removing!.id}`);
          if (!r.ok) return toast(r.message, "error");
          toast("Đã xoá nhiệm vụ.");
          setRemoving(null);
          refresh();
        }}
      />
    </div>
  );
}

function TaskEditor({
  open,
  task,
  classId,
  onClose,
  onSaved,
}: {
  open: boolean;
  task: Task | null;
  classId: number;
  onClose(): void;
  onSaved(): void;
}) {
  const empty = { title: "", instructions: "", dueDate: "", status: "published" as Task["status"] };
  const [f, setF] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  // A fresh form each time it opens: the task being edited, or an empty one.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setF(
        task
          ? { title: task.title, instructions: task.instructions, dueDate: task.dueDate ?? "", status: task.status }
          : empty,
      );
      setError(null);
    }
  }

  async function save(status: Task["status"]) {
    // No subject: "Bỏ phân môn" (brief 9). An edited task keeps the one it had.
    const body = {
      title: f.title,
      instructions: f.instructions,
      dueDate: f.dueDate || null,
      status,
    };
    setBusy(true);
    const r = task ? await patch(`/api/t/tasks/${task.id}`, body) : await post(`/api/t/classes/${classId}/tasks`, body);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    toast(status === "draft" ? "Đã lưu nháp." : "Đã giao cho cả lớp.");
    onSaved();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={task ? "Sửa nhiệm vụ" : "Giao nhiệm vụ mới"}
      footer={
        <>
          <button type="button" className="btn btn-ghost" disabled={busy || !f.title.trim()} onClick={() => save("draft")}>
            Lưu nháp
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !f.title.trim()} onClick={() => save("published")}>
            {task ? "Lưu và giao" : "Giao cho cả lớp"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field
          label="Tên nhiệm vụ"
          value={f.title}
          maxLength={120}
          onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))}
          placeholder="Ví dụ: Ôn tập bảng nhân 7"
          data-autofocus
        />
        <TextArea
          label="Nội dung cô giao"
          value={f.instructions}
          maxLength={3000}
          rows={6}
          onChange={(e) => setF((x) => ({ ...x, instructions: e.target.value }))}
          placeholder="Ví dụ: Làm bài 3 và bài 4 trang 45 vào vở ô li. Học thuộc bảng nhân 7."
          hint="Phụ huynh và các con đọc đúng những dòng này."
        />
        <label className="field">
          <span>Hạn hoàn thành (không bắt buộc)</span>
          <input type="date" className="input" value={f.dueDate} onChange={(e) => setF((x) => ({ ...x, dueDate: e.target.value }))} />
        </label>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
