"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, ImagePlus, MessageCircle, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import {
  IMAGE_LIMITS,
  MAX_POST_PHOTOS,
  MONTH_THEMES,
  POST_COLORS,
  POST_COLOR_LABEL,
  POST_KINDS,
  POST_KIND_INFO,
  POST_LAYOUTS,
  POST_LAYOUT_INFO,
  POST_STICKERS,
  monthLabel,
  shiftMonth,
  type BoardView,
  type Post,
  type PostColor,
  type PostComment,
  type PostKind,
  type PostLayout,
  type PostLiker,
} from "@lhhp/shared";
import { Avatar, Confirm, Empty, Field, Loading, LoadError, Sheet, TextArea, toast } from "@/components/ui";
import { api, del, patch, post as postJson, put } from "@/lib/api";
import { formatLocalDate, timeAgo, todayLocal } from "@/lib/format";
import { resizeImage } from "@/lib/image";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const BOARD_EMOJIS = ["🌼", "🌸", "🍁", "🎄", "🎋", "🏮", "🎏", "📚", "🌞", "🌱", "❤️", "🎨"];

type Role = "teacher" | "family";

/**
 * Bảng tin lớp học. The teacher pins the month's theme and a wall of notes — photos of the class, the work to do at
 * home, a word to the parents — and the families read it from their child's account, leave a heart and write back.
 */
export function ClassBoard(props: { role: "teacher"; classId: number } | { role: "family" }) {
  const role: Role = props.role;
  const base = props.role === "teacher" ? `/api/t/classes/${props.classId}` : "/api/s";
  const postBase = props.role === "teacher" ? "/api/t" : "/api/s";
  const [month, setMonth] = useState<string | null>(null);
  const path = `${base}/board${month ? `?month=${month}` : ""}`;
  const { data, setData, error, reload } = useApi<BoardView>(path);

  const [themeOpen, setThemeOpen] = useState(false);
  const [editing, setEditing] = useState<Post | "new" | null>(null);
  const [commenting, setCommenting] = useState<Post | null>(null);
  const [peopleFor, setPeopleFor] = useState<Post | null>(null);
  const [removing, setRemoving] = useState<Post | null>(null);

  const shown = data?.month.month ?? month ?? "";
  const replacePost = useCallback(
    (p: Post) => setData((v) => (v ? { ...v, posts: v.posts.map((x) => (x.id === p.id ? p : x)) } : v)),
    [setData],
  );

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const isTeacher = role === "teacher";
  const months = data.months.includes(shown) ? data.months : [shown, ...data.months];

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl bg-pink-soft px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm bg-white/70"
            onClick={() => setMonth(shiftMonth(shown, -1))}
            aria-label="Tháng trước"
          >
            ←
          </button>
          <label className="sr-only" htmlFor="board-month">
            Chọn tháng
          </label>
          <select
            id="board-month"
            className="input !h-11 !w-auto !py-0 font-semibold"
            value={shown}
            onChange={(e) => setMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm bg-white/70"
            onClick={() => setMonth(shiftMonth(shown, 1))}
            aria-label="Tháng sau"
          >
            →
          </button>
        </div>

        <h1 className="mt-3 font-display text-[2rem] font-extrabold leading-tight text-pink-ink">
          <span aria-hidden>{data.month.emoji} </span>
          {data.month.theme || "Chưa có chủ đề tháng này"}
        </h1>
        {data.month.note ? <p className="mt-1 text-ink-soft">{data.month.note}</p> : null}

        {isTeacher ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
              <Plus size={18} aria-hidden /> Thêm ô tin
            </button>
            <button type="button" className="btn btn-ghost bg-white/70" onClick={() => setThemeOpen(true)}>
              <Pencil size={16} aria-hidden /> Chủ đề tháng
            </button>
          </div>
        ) : null}
      </section>

      {data.posts.length === 0 ? (
        <Empty emoji="📌" title="Bảng tin còn trống">
          {isTeacher ? "Cô thêm ô tin đầu tiên: một tấm ảnh của lớp, việc ở nhà, hay lời nhắn tới phụ huynh." : "Cô chưa đăng gì trong tháng này. Con quay lại sau nhé!"}
        </Empty>
      ) : (
        <div className="wall">
          {data.posts.map((p) => (
            <PostNote
              key={p.id}
              post={p}
              role={role}
              postBase={postBase}
              onChange={replacePost}
              onEdit={() => setEditing(p)}
              onRemove={() => setRemoving(p)}
              onComments={() => setCommenting(p)}
              onPeople={() => setPeopleFor(p)}
            />
          ))}
        </div>
      )}

      {isTeacher ? (
        <>
          <ThemeSheet
            open={themeOpen}
            month={data.month}
            onClose={() => setThemeOpen(false)}
            onSaved={(v) => {
              setData(() => v);
              setThemeOpen(false);
            }}
            base={base}
          />
          <PostSheet
            open={editing !== null}
            post={editing === "new" ? null : editing}
            month={shown}
            base={base}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              void reload();
            }}
          />
          <Confirm
            open={removing !== null}
            title="Xoá ô tin này?"
            body={
              <p>
                Xoá <strong>{removing?.title}</strong> cùng ảnh, tim và bình luận của ô. Không hoàn tác được.
              </p>
            }
            action="Xoá ô tin"
            danger
            onClose={() => setRemoving(null)}
            onConfirm={async () => {
              const p = removing;
              setRemoving(null);
              if (!p) return;
              const r = await del(`${postBase}/posts/${p.id}`);
              if (!r.ok) return toast(r.message, "error");
              setData((v) => (v ? { ...v, posts: v.posts.filter((x) => x.id !== p.id) } : v));
              toast("Đã xoá ô tin.");
            }}
          />
        </>
      ) : null}

      {isTeacher && peopleFor ? <PeopleSheet post={peopleFor} onClose={() => setPeopleFor(null)} /> : null}
      <CommentsSheet
        post={commenting}
        role={role}
        postBase={postBase}
        onClose={() => setCommenting(null)}
        onCount={(id, n) => setData((v) => (v ? { ...v, posts: v.posts.map((x) => (x.id === id ? { ...x, comments: n } : x)) } : v))}
      />
    </div>
  );
}

// One note on the wall ------------------------------------------------------------------------

function PostNote({
  post,
  role,
  postBase,
  onChange,
  onEdit,
  onRemove,
  onComments,
  onPeople,
}: {
  post: Post;
  role: Role;
  postBase: string;
  onChange(p: Post): void;
  onEdit(): void;
  onRemove(): void;
  onComments(): void;
  /** Hers only: who hearted it and who wrote on it (brief 13). */
  onPeople(): void;
}) {
  const kind = POST_KIND_INFO[post.kind];
  const [busy, setBusy] = useState(false);

  async function like() {
    if (role !== "family" || busy) return;
    setBusy(true);
    // The heart fills under the finger; the count follows from the server.
    const wanted = !post.likedByMe;
    onChange({ ...post, likedByMe: wanted, likes: post.likes + (wanted ? 1 : -1) });
    const path = `${postBase}/posts/${post.id}/like`;
    const r = wanted ? await postJson<{ likes: number; likedByMe: boolean }>(path) : await del<{ likes: number; likedByMe: boolean }>(path);
    setBusy(false);
    if (!r.ok) {
      onChange(post);
      return toast(r.message, "error");
    }
    onChange({ ...post, ...r.data });
  }

  return (
    <article className={cn("note p-4", `note-${post.color}`, `note-${post.layout}`)} data-pinned={post.pinned}>
      {post.sticker ? (
        <span className="note-sticker" aria-hidden>
          {post.sticker}
        </span>
      ) : null}
      {post.pinned ? (
        <span className="absolute -top-2.5 right-4 grid h-7 w-7 place-items-center rounded-full bg-pink text-white shadow" aria-label="Ô tin được ghim">
          <Pin size={14} aria-hidden />
        </span>
      ) : null}

      {/* Brief 13: "khi nhấn vào bài viết có thể xem được HS nào like hay bình luận". The whole tile opens it for her. */}
      {role === "teacher" ? (
        <button type="button" className="absolute inset-0 z-0 cursor-pointer rounded-[inherit]" aria-label={`Xem ai đã thích và bình luận: ${post.title}`} onClick={onPeople} />
      ) : null}
      <p className="text-sm font-semibold text-ink-soft">
        <span aria-hidden>{kind.emoji} </span>
        {kind.label}
      </p>
      <h2 className="mt-0.5 font-display text-xl font-extrabold leading-tight break-words">{post.title}</h2>
      {post.dueDate ? (
        <p className="mt-1 inline-block rounded-full bg-white/70 px-2.5 py-0.5 text-sm font-semibold">
          🗓️ {formatLocalDate(post.dueDate)}
        </p>
      ) : null}
      {post.body ? <p className="mt-2 whitespace-pre-line break-words">{post.body}</p> : null}

      {post.photos.length > 0 ? (
        <ul className={cn("mt-3 grid gap-1.5", post.photos.length > 1 && "grid-cols-2")}>
          {post.photos.map((url, i) => (
            <li key={url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Ảnh ${i + 1} của ô tin ${post.title}`}
                loading="lazy"
                className="h-full w-full rounded-xl object-cover"
                style={{ aspectRatio: post.photos.length === 1 ? "4 / 3" : "1 / 1" }}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-white/60 pt-2 text-sm">
        {role === "family" ? (
          <button
            type="button"
            onClick={like}
            className={cn("btn btn-sm !min-h-9 !px-2.5", post.likedByMe ? "text-pink-ink" : "text-ink-soft")}
            aria-pressed={post.likedByMe}
            aria-label={post.likedByMe ? `Bỏ thích ${post.title}` : `Thích ${post.title}`}
          >
            <Heart size={18} fill={post.likedByMe ? "currentColor" : "none"} aria-hidden /> {post.likes}
          </button>
        ) : (
          <button type="button" className="btn btn-sm relative z-10 !min-h-9 !px-2.5 text-ink-soft" aria-label={`${post.likes} lượt thích — xem ai đã thích`} onClick={onPeople}>
            <Heart size={18} aria-hidden /> {post.likes}
          </button>
        )}
        <button type="button" className="btn btn-sm relative z-10 !min-h-9 !px-2.5 text-ink-soft" onClick={onComments}>
          <MessageCircle size={18} aria-hidden /> {post.comments > 0 ? post.comments : "Bình luận"}
        </button>
        <span className="ml-auto text-xs text-ink-soft">{timeAgo(post.createdAt)}</span>
        {role === "teacher" ? (
          <span className="relative z-10 flex w-full justify-end gap-1 pt-1">
            <button type="button" className="btn btn-ghost btn-sm !min-h-9 bg-white/60" onClick={onEdit}>
              <Pencil size={15} aria-hidden /> Sửa
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm !min-h-9 bg-white/60 text-red-pen"
              onClick={onRemove}
              aria-label={`Xoá ô tin ${post.title}`}
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </span>
        ) : null}
      </div>
    </article>
  );
}

// Who hearted it, who wrote on it ---------------------------------------------------------------------

/** "Xem được HS nào like hay bình luận bài" (brief 13): the teacher's view of one tile's hearts and comments. */
function PeopleSheet({ post, onClose }: { post: Post; onClose(): void }) {
  const likes = useApi<PostLiker[]>(`/api/t/posts/${post.id}/likes`);
  const comments = useApi<PostComment[]>(`/api/t/posts/${post.id}/comments`);
  const said = (comments.data ?? []).filter((c) => c.author === "family");
  return (
    <Sheet open onClose={onClose} title={post.title}>
      {likes.error || comments.error ? (
        <LoadError
          message={likes.error ?? comments.error!}
          onRetry={() => {
            void likes.reload();
            void comments.reload();
          }}
        />
      ) : !likes.data || !comments.data ? (
        <Loading />
      ) : (
        <div className="grid gap-5">
          <section>
            <h3 className="font-display text-lg font-bold">❤️ Đã thích ({likes.data.length})</h3>
            {likes.data.length === 0 ? (
              <p className="mt-1 text-sm text-ink-soft">Chưa bạn nào thích ô tin này.</p>
            ) : (
              <ul aria-label="Đã thích" className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {likes.data.map((l) => (
                  <li key={l.studentId} className="flex items-center gap-2 rounded-xl bg-page px-2 py-1.5">
                    <Avatar emoji={l.avatarEmoji} url={l.avatarUrl} name={l.fullName} size={30} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{l.fullName}</span>
                    <span className="text-xs text-ink-soft">{timeAgo(l.likedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="font-display text-lg font-bold">💬 Đã bình luận ({new Set(said.map((c) => c.studentId)).size} bạn)</h3>
            {said.length === 0 ? (
              <p className="mt-1 text-sm text-ink-soft">Chưa gia đình nào bình luận.</p>
            ) : (
              <ul aria-label="Đã bình luận" className="mt-2 grid gap-2">
                {said.map((c) => (
                  <li key={c.id} className="flex gap-2 rounded-xl bg-page px-2 py-2">
                    <Avatar emoji={c.avatarEmoji ?? "🙂"} url={c.avatarUrl} name={c.authorName} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{c.authorName}</span>
                      <span className="block whitespace-pre-line break-words">{c.body}</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-soft">{timeAgo(c.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}

// The month's theme ---------------------------------------------------------------------------

function ThemeSheet({
  open,
  month,
  base,
  onClose,
  onSaved,
}: {
  open: boolean;
  month: BoardView["month"];
  base: string;
  onClose(): void;
  onSaved(v: BoardView): void;
}) {
  const [f, setF] = useState({ theme: month.theme, note: month.note, emoji: month.emoji });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF({ theme: month.theme, note: month.note, emoji: month.emoji });
  }, [open, month]);

  const suggested = MONTH_THEMES[Number(month.month.slice(5, 7))];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`🌼 Chủ đề ${monthLabel(month.month)}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Để sau
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !f.theme.trim()}
            onClick={async () => {
              setBusy(true);
              const r = await put<BoardView>(`${base}/board/${month.month}`, f);
              setBusy(false);
              if (!r.ok) return toast(r.message, "error");
              toast("Đã lưu chủ đề tháng.");
              onSaved(r.data);
            }}
          >
            Lưu chủ đề
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field
          label="Chủ đề của tháng"
          value={f.theme}
          maxLength={120}
          data-autofocus
          hint={suggested ? `Gợi ý: ${suggested}` : undefined}
          onChange={(e) => setF({ ...f, theme: e.target.value })}
        />
        <TextArea
          label="Ghi chú thêm"
          rows={2}
          maxLength={300}
          value={f.note}
          hint="Không bắt buộc. Ví dụ: Tuần 3 lớp mình rước đèn."
          onChange={(e) => setF({ ...f, note: e.target.value })}
        />
        <fieldset>
          <legend className="mb-1 font-semibold">Biểu tượng</legend>
          <div className="flex flex-wrap gap-1.5">
            {BOARD_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setF({ ...f, emoji: e })}
                aria-pressed={f.emoji === e}
                aria-label={`Chọn biểu tượng ${e}`}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-2xl text-2xl",
                  f.emoji === e ? "bg-pink-soft ring-2 ring-pink-ink" : "bg-page ring-1 ring-line",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </Sheet>
  );
}

// Writing a note ------------------------------------------------------------------------------

const BLANK = {
  kind: "hoat_dong" as PostKind,
  title: "",
  body: "",
  color: "vang" as PostColor,
  sticker: "" as string,
  layout: "ghim" as PostLayout,
  pinned: false,
  dueDate: "",
};

function PostSheet({
  open,
  post,
  month,
  base,
  onClose,
  onSaved,
}: {
  open: boolean;
  post: Post | null;
  month: string;
  base: string;
  onClose(): void;
  onSaved(): void;
}) {
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [saved, setSaved] = useState<Post | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSaved(post);
    setPhotos(post?.photos ?? []);
    setF(
      post
        ? {
            kind: post.kind,
            title: post.title,
            body: post.body,
            color: post.color,
            sticker: post.sticker,
            layout: post.layout,
            pinned: post.pinned,
            dueDate: post.dueDate ?? "",
          }
        : BLANK,
    );
  }, [open, post]);

  /** The tile has to exist before a photo can hang on it, so saving comes first and stays available. */
  async function save(): Promise<Post | null> {
    setBusy(true);
    const body = { ...f, dueDate: f.kind === "viec_nha" && f.dueDate ? f.dueDate : null, month };
    const r = saved ? await patch<Post>(`/api/t/posts/${saved.id}`, body) : await postJson<Post>(`${base}/posts`, body);
    setBusy(false);
    if (!r.ok) {
      toast(r.message, "error");
      return null;
    }
    setSaved(r.data);
    return r.data;
  }

  async function addPhoto(file: File) {
    let target = saved;
    if (!target) {
      if (!f.title.trim()) return toast("Cô nhập tiêu đề trước khi thêm ảnh nhé.", "error");
      target = await save();
      if (!target) return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeImage(file, IMAGE_LIMITS.post, "contain");
      const r = await postJson<{ id: number; url: string }>(`/api/t/posts/${target.id}/photos`, { dataUrl });
      if (!r.ok) throw new Error(r.message);
      setPhotos((v) => [...v, r.data.url]);
      toast("Đã thêm ảnh.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Không tải được ảnh.", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto(url: string) {
    const id = Number(url.split("/").pop());
    if (!saved || !Number.isFinite(id)) return;
    const r = await del(`/api/t/posts/${saved.id}/photos/${id}`);
    if (!r.ok) return toast(r.message, "error");
    setPhotos((v) => v.filter((u) => u !== url));
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={post ? "✏️ Sửa ô tin" : "📌 Ô tin mới"}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !f.title.trim()}
            onClick={async () => {
              if (await save()) {
                toast(post ? "Đã lưu ô tin." : "Đã thêm ô tin lên bảng.");
                onSaved();
              }
            }}
          >
            {post ? "Lưu" : "Đăng lên bảng"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <fieldset>
          <legend className="mb-1 font-semibold">Loại ô tin</legend>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {POST_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setF({ ...f, kind: k })}
                aria-pressed={f.kind === k}
                className={cn(
                  "rounded-2xl px-3 py-2 text-left ring-1",
                  f.kind === k ? "bg-pink-soft ring-2 ring-pink-ink" : "bg-page ring-line",
                )}
              >
                <span className="font-semibold">
                  <span aria-hidden>{POST_KIND_INFO[k].emoji} </span>
                  {POST_KIND_INFO[k].label}
                </span>
                <span className="block text-xs text-ink-soft">{POST_KIND_INFO[k].hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Tiêu đề" value={f.title} maxLength={120} data-autofocus onChange={(e) => setF({ ...f, title: e.target.value })} />
        <TextArea label="Nội dung" rows={4} maxLength={2000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />

        {f.kind === "viec_nha" ? (
          <Field
            type="date"
            label="Làm cho ngày"
            value={f.dueDate}
            min={todayLocal()}
            hint="Không bắt buộc."
            onChange={(e) => setF({ ...f, dueDate: e.target.value })}
          />
        ) : null}

        <fieldset>
          <legend className="mb-1 font-semibold">Màu giấy</legend>
          <div className="flex flex-wrap gap-1.5">
            {POST_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setF({ ...f, color: c })}
                aria-pressed={f.color === c}
                aria-label={`Màu ${POST_COLOR_LABEL[c]}`}
                className={cn("note h-11 w-14", `note-${c}`, f.color === c && "ring-2 ring-pink-ink")}
              />
            ))}
          </div>
        </fieldset>

        {/* "Giao diện các bảng tin đa dạng hơn" (brief 4, item 6). */}
        <fieldset>
          <legend className="mb-1 font-semibold">Kiểu ô</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {POST_LAYOUTS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setF({ ...f, layout: l })}
                aria-pressed={f.layout === l}
                className={cn("rounded-2xl px-3 py-2 text-left ring-1", f.layout === l ? "bg-pink-soft ring-2 ring-pink-ink" : "bg-page ring-line")}
              >
                <span className="font-semibold">{POST_LAYOUT_INFO[l].label}</span>
                <span className="block text-xs text-ink-soft">{POST_LAYOUT_INFO[l].hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* "Có các sticker trong mỗi ô padlet" (brief 4, item 6). */}
        <fieldset>
          <legend className="mb-1 font-semibold">Sticker dán lên ô</legend>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setF({ ...f, sticker: "" })}
              aria-pressed={f.sticker === ""}
              className={cn(
                "grid h-11 min-w-11 place-items-center rounded-xl px-2 text-sm font-semibold",
                f.sticker === "" ? "bg-pink-soft ring-2 ring-pink-ink" : "bg-page ring-1 ring-line",
              )}
            >
              Không
            </button>
            {POST_STICKERS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setF({ ...f, sticker: k })}
                aria-pressed={f.sticker === k}
                aria-label={`Sticker ${k}`}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-xl text-2xl",
                  f.sticker === k ? "bg-pink-soft ring-2 ring-pink-ink" : "bg-page ring-1 ring-line",
                )}
              >
                {k}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" className="h-5 w-5" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} />
          Ghim lên đầu bảng
        </label>

        <fieldset>
          <legend className="mb-1 font-semibold">Ảnh của lớp</legend>
          <p className="mb-2 text-sm text-ink-soft">Tối đa {MAX_POST_PHOTOS} ảnh. Ảnh được thu nhỏ ngay trên máy cô trước khi gửi.</p>
          {photos.length ? (
            <ul className="mb-2 grid grid-cols-3 gap-2">
              {photos.map((url, i) => (
                <li key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Ảnh ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    aria-label={`Xoá ảnh ${i + 1}`}
                    className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full bg-red-pen text-white shadow"
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void addPhoto(file);
            }}
          />
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || photos.length >= MAX_POST_PHOTOS}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={18} aria-hidden /> Thêm ảnh
          </button>
        </fieldset>
      </div>
    </Sheet>
  );
}

// Talking under a note ------------------------------------------------------------------------

function CommentsSheet({
  post,
  role,
  postBase,
  onClose,
  onCount,
}: {
  post: Post | null;
  role: Role;
  postBase: string;
  onClose(): void;
  onCount(postId: number, n: number): void;
}) {
  const [list, setList] = useState<PostComment[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = post?.id ?? null;

  useEffect(() => {
    let live = true;
    setList(null);
    setBody("");
    setError(null);
    if (id === null) return;
    void api<PostComment[]>(`${postBase}/posts/${id}/comments`).then((r) => {
      if (!live) return;
      if (r.ok) setList(r.data);
      else setError(r.message);
    });
    return () => {
      live = false;
    };
  }, [id, postBase]);

  async function send() {
    if (id === null || !body.trim()) return;
    setBusy(true);
    const r = await postJson<PostComment[]>(`${postBase}/posts/${id}/comments`, { body });
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setBody("");
    setList(r.data);
    onCount(id, r.data.length);
  }

  async function remove(c: PostComment) {
    if (id === null) return;
    const r = await del(`${postBase}/posts/${id}/comments/${c.id}`);
    if (!r.ok) return toast(r.message, "error");
    setList((v) => {
      const next = (v ?? []).filter((x) => x.id !== c.id);
      onCount(id, next.length);
      return next;
    });
  }

  return (
    <Sheet
      open={post !== null}
      onClose={onClose}
      title={<span className="break-words">💬 {post?.title}</span>}
      footer={
        <div className="flex w-full items-end gap-2">
          <div className="flex-1">
            <TextArea
              label={role === "teacher" ? "Trả lời phụ huynh" : "Viết cho cô và cả lớp"}
              rows={2}
              maxLength={500}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-primary" disabled={busy || !body.trim()} onClick={send}>
            Gửi
          </button>
        </div>
      }
    >
      {error ? (
        <LoadError message={error} />
      ) : !list ? (
        <Loading />
      ) : list.length === 0 ? (
        <p className="py-6 text-center text-ink-soft">Chưa có bình luận nào. Hãy là người đầu tiên nhé!</p>
      ) : (
        <ul className="grid gap-3">
          {list.map((c) => (
            <li key={c.id} className="flex gap-2">
              {c.author === "teacher" ? (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pink-soft text-lg" aria-hidden>
                  🧑‍🏫
                </span>
              ) : (
                <Avatar emoji={c.avatarEmoji ?? "🐰"} url={c.avatarUrl} name={c.authorName} size={36} />
              )}
              <div className={cn("min-w-0 flex-1 rounded-2xl px-3 py-2", c.author === "teacher" ? "bg-pink-soft" : "bg-page ring-1 ring-line")}>
                <p className="text-sm font-semibold break-words">
                  {c.authorName}
                  <span className="ml-2 font-normal text-ink-soft">{timeAgo(c.createdAt)}</span>
                </p>
                <p className="whitespace-pre-line break-words">{c.body}</p>
                {role === "teacher" || c.mine ? (
                  <button
                    type="button"
                    className="mt-1 text-sm font-semibold text-red-pen underline"
                    onClick={() => remove(c)}
                    aria-label={`Xoá bình luận của ${c.authorName}`}
                  >
                    Xoá
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
