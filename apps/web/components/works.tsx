"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { IMAGE_LIMITS, type StudentWork } from "@lhhp/shared";
import { Confirm, Empty, Field, Loading, LoadError, toast } from "@/components/ui";
import { api, del, post } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { resizeImage } from "@/lib/image";
import { useApi } from "@/lib/use-api";

/**
 * "SẢN PHẨM CỦA EM" (brief 4, item 5). She photographs a marked test or something a child made; it hangs on that
 * child's page, and the family looks at it under Kết quả under the same name.
 *
 * "PH k tải đc tài liệu do gv upload mà chỉ xem": nothing here offers a copy. There is no download link, the image
 * is served `content-disposition: inline`, dragging it out is off and the right-click menu is suppressed. None of
 * that can stop a screenshot, and it is not meant to — it is meant to stop a marked test being passed around by
 * accident.
 */

export const WORKS_TITLE = "Sản phẩm của em";

function WorkImage({ work, onOpen }: { work: StudentWork; onOpen(): void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full overflow-hidden rounded-xl ring-1 ring-line"
      aria-label={`Xem ${work.title || `sản phẩm ngày ${formatDate(work.createdAt)}`}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={work.url}
        alt={work.title || `Sản phẩm ngày ${formatDate(work.createdAt)}`}
        loading="lazy"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        className="aspect-square w-full select-none bg-page object-cover transition-transform group-hover:scale-[1.03]"
      />
    </button>
  );
}

function Viewer({ work, onClose }: { work: StudentWork | null; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (work && !d.open) d.showModal();
    if (!work && d.open) d.close();
  }, [work]);
  return (
    <dialog ref={ref} className="sheet !w-[min(920px,calc(100vw-24px))] p-0" onClose={onClose} onCancel={onClose}>
      {work ? (
        <div className="grid gap-3 p-4">
          <p className="font-display text-xl font-extrabold">{work.title || `Sản phẩm ngày ${formatDate(work.createdAt)}`}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={work.url}
            alt={work.title || "Sản phẩm của em"}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="max-h-[70vh] w-full select-none rounded-xl object-contain"
          />
          <button type="button" className="btn btn-primary justify-self-end" onClick={onClose}>
            Đóng
          </button>
        </div>
      ) : null}
    </dialog>
  );
}

/** The teacher's side: she puts work up and takes it down. */
export function WorksEditor({ studentId, fullName }: { studentId: number; fullName: string }) {
  const { data, setData, error, reload } = useApi<StudentWork[]>(`/api/t/students/${studentId}/works`);
  const file = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<StudentWork | null>(null);
  const [removing, setRemoving] = useState<StudentWork | null>(null);

  async function upload(f: File) {
    setBusy(true);
    try {
      const dataUrl = await resizeImage(f, IMAGE_LIMITS.work);
      const r = await post<StudentWork>(`/api/t/students/${studentId}/works`, { title: title.trim(), dataUrl });
      if (!r.ok) throw new Error(r.message);
      setData((list) => [r.data, ...(list ?? [])]);
      setTitle("");
      toast(`Đã thêm sản phẩm của ${fullName}.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Không tải được ảnh.", "error");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <fieldset className="rounded-2xl bg-page p-3">
      <legend className="px-1 font-semibold">🎒 {WORKS_TITLE}</legend>
      <p className="text-sm text-ink-soft">
        Ảnh bài kiểm tra, bài làm hay sản phẩm của con. Phụ huynh xem được ở mục Kết quả, chỉ xem chứ không tải về được.
        Ảnh được lưu ngay khi thêm, không cần bấm Lưu.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field
          label="Tên sản phẩm"
          hint="Không bắt buộc. Ví dụ: Bài kiểm tra Toán tuần 5."
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => file.current?.click()}>
          {busy ? "Đang tải ảnh…" : "📷 Thêm ảnh sản phẩm"}
        </button>
      </div>

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : data.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Chưa có sản phẩm nào.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.map((w) => (
            <li key={w.id} className="relative">
              <WorkImage work={w} onOpen={() => setOpen(w)} />
              <p className="mt-1 truncate text-xs font-semibold" title={w.title}>
                {w.title || formatDate(w.createdAt)}
              </p>
              <button
                type="button"
                className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-red-pen shadow"
                aria-label={`Xoá ${w.title || `sản phẩm ngày ${formatDate(w.createdAt)}`}`}
                onClick={() => setRemoving(w)}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Viewer work={open} onClose={() => setOpen(null)} />
      <Confirm
        open={!!removing}
        title="Xoá sản phẩm này?"
        body={removing ? `“${removing.title || formatDate(removing.createdAt)}” sẽ không còn hiện với gia đình nữa.` : ""}
        action="Xoá"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const w = removing;
          setRemoving(null);
          if (!w) return;
          const r = await del(`/api/t/works/${w.id}`);
          if (!r.ok) return toast(r.message, "error");
          setData((list) => (list ?? []).filter((x) => x.id !== w.id));
        }}
      />
    </fieldset>
  );
}

/** The family's side: the same name, and nothing to press but the picture. */
export function WorksGallery() {
  const [works, setWorks] = useState<StudentWork[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<StudentWork | null>(null);

  useEffect(() => {
    void api<StudentWork[]>("/api/s/works").then((r) => (r.ok ? setWorks(r.data) : setError(r.message)));
  }, []);

  return (
    <section className="paper p-4">
      <h2 className="text-xl font-extrabold">🎒 {WORKS_TITLE}</h2>
      {error ? (
        <LoadError message={error} />
      ) : !works ? (
        <Loading />
      ) : works.length === 0 ? (
        <Empty emoji="🎒" title="Chưa có sản phẩm nào">Khi cô đăng bài kiểm tra hay sản phẩm của con, ảnh sẽ hiện ở đây.</Empty>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">Bấm vào ảnh để xem to hơn.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {works.map((w) => (
              <li key={w.id}>
                <WorkImage work={w} onOpen={() => setOpen(w)} />
                <p className="mt-1 truncate text-xs font-semibold" title={w.title}>
                  {w.title || formatDate(w.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
      <Viewer work={open} onClose={() => setOpen(null)} />
    </section>
  );
}
