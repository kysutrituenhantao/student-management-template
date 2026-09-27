"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Pencil, Search } from "lucide-react";
import { AVATAR_EMOJIS, DUTIES, GENDERS, GENDER_INFO, IMAGE_LIMITS, stripDiacritics, type Gender, type MangNonRow } from "@lhhp/shared";
import { WorksEditor } from "@/components/works";
import { Avatar, Empty, Field, FormError, Loading, LoadError, Sheet, TextArea, toast } from "@/components/ui";
import { del, patch, put } from "@/lib/api";
import { resizeImage } from "@/lib/image";
import { formatLocalDate, todayLocal } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { cn, groupClass } from "@/lib/utils";

/**
 * Hồ sơ Măng non: the class profile book. The teacher writes every page; a child writes their own, except the
 * chức vụ, which stays hers to give. Classmates see the day and month of a birthday, never the year.
 */

const MAX_TEXT = 120;
const MAX_DUTY = 60;

// The child's picture --------------------------------------------------------------------------

/**
 * The avatar sits at the top of a child's page, so this is where she reached for it: "ảnh đại diện của HS k thể
 * thay đổi" (brief 3, item 1). `base` is whose account is doing it — hers for any child, or the child's own.
 */
function AvatarPicker({
  row,
  base,
  onChanged,
}: {
  row: MangNonRow;
  /** "/api/t/students/<id>" when the teacher is editing, "/api/s" when the child is. */
  base: string;
  onChanged(next: { avatarEmoji: string; avatarUrl: string | null }): void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  /** Both sides answer with the child's row, but shaped differently; this reads either. */
  const readBack = (data: unknown): { avatarEmoji: string; avatarUrl: string | null } | null => {
    const r = (data as { me?: Record<string, unknown> })?.me ?? (data as Record<string, unknown>);
    if (!r || typeof r !== "object" || !("avatarEmoji" in r)) return null;
    return { avatarEmoji: String(r.avatarEmoji), avatarUrl: (r.avatarUrl as string | null) ?? null };
  };

  async function upload(f: File) {
    setBusy(true);
    try {
      const dataUrl = await resizeImage(f, IMAGE_LIMITS.avatar);
      const r = await put<unknown>(`${base}/avatar`, { dataUrl });
      if (!r.ok) throw new Error(r.message);
      const next = readBack(r.data);
      if (next) onChanged(next);
      toast("Đã đổi ảnh đại diện.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Không tải được ảnh.", "error");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  /** Returns false when the server refused, so a caller can stop. */
  async function dropPhoto(): Promise<boolean> {
    const r = await del<unknown>(`${base}/avatar`);
    if (!r.ok) {
      toast(r.message, "error");
      return false;
    }
    return true;
  }

  async function removePhoto() {
    if (await dropPhoto()) onChanged({ avatarEmoji: row.avatarEmoji, avatarUrl: null });
  }

  async function chooseSticker(emoji: string) {
    if (row.avatarUrl && !(await dropPhoto())) return;
    // The teacher patches the child's row; a child has its own little route for the sticker.
    const r = base === "/api/s" ? await put<unknown>("/api/s/avatar-emoji", { avatarEmoji: emoji }) : await patch<unknown>(base, { avatarEmoji: emoji });
    if (!r.ok) return toast(r.message, "error");
    onChanged({ avatarEmoji: emoji, avatarUrl: null });
  }

  return (
    <fieldset className="rounded-2xl bg-page p-3">
      <legend className="px-1 font-semibold">Ảnh đại diện</legend>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar emoji={row.avatarEmoji} url={row.avatarUrl} name={row.fullName} size={64} />
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => file.current?.click()}>
          {busy ? "Đang tải ảnh…" : row.avatarUrl ? "📷 Đổi ảnh khác" : "📷 Tải ảnh lên"}
        </button>
        {row.avatarUrl ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={removePhoto}>
            Bỏ ảnh, dùng sticker
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-ink-soft">Hoặc chọn một sticker{row.avatarUrl ? " (ảnh đang dùng sẽ bị bỏ)" : ""}:</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {AVATAR_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={`Chọn sticker ${e}`}
            aria-pressed={!row.avatarUrl && row.avatarEmoji === e}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-xl text-2xl",
              !row.avatarUrl && row.avatarEmoji === e ? "bg-pink-soft ring-2 ring-pink-ink" : "bg-white",
            )}
            onClick={() => chooseSticker(e)}
          >
            {e}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// Reading the rows ------------------------------------------------------------------------------

/** "08/11": what the whole class may see of a birthday. */
function dayMonth(row: MangNonRow): string | null {
  if (row.birthdayDm) return row.birthdayDm;
  // A row the server sent with the full date but no day/month (it always sends both; belt and braces).
  if (row.birthday) return `${row.birthday.slice(8, 10)}/${row.birthday.slice(5, 7)}`;
  return null;
}

function birthMonth(row: MangNonRow): number | null {
  const dm = dayMonth(row);
  if (!dm) return null;
  const m = Number(dm.slice(3, 5));
  return m >= 1 && m <= 12 ? m : null;
}

const birthDay = (row: MangNonRow) => Number(dayMonth(row)?.slice(0, 2) ?? 99);

const currentMonth = () => Number(todayLocal().slice(5, 7));

/** A page counts as written once there is at least one thing on it. */
const written = (row: MangNonRow) => Boolean(dayMonth(row) || row.gender || row.hobby.trim() || row.dream.trim());

/** Lowercased and without diacritics, so "Đào" is found by typing "dao". */
const searchKey = (s: string) => stripDiacritics(s).toLocaleLowerCase("vi");

function byBirthday(rows: MangNonRow[], month: number): MangNonRow[] {
  return rows.filter((r) => birthMonth(r) === month).sort((a, b) => birthDay(a) - birthDay(b));
}

// Pieces of a page -------------------------------------------------------------------------------

function CardHead({ row, size = 56 }: { row: MangNonRow; size?: number }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar emoji={row.avatarEmoji} url={row.avatarUrl} name={row.fullName} size={size} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-extrabold leading-tight break-words">{row.fullName}</p>
        <p className="text-sm text-ink-soft break-words">
          {row.group ? (
            <>
              <span aria-hidden>{row.teamEmoji ?? "🪑"}</span> Tổ {row.group}
              {row.teamName ? ` · ${row.teamName}` : ""}
            </>
          ) : (
            "Chưa xếp tổ"
          )}
        </p>
        {row.duty ? (
          <p className="mt-1.5">
            <span className="chip !min-h-[28px] !px-2.5 !py-0.5 border-gold bg-gold-soft text-[0.82rem] text-gold-ink">
              <span aria-hidden>🎖️</span> {row.duty}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Facts({ row, birthday }: { row: MangNonRow; birthday: string | null }) {
  const g = row.gender ? GENDER_INFO[row.gender] : null;
  return (
    <div className="mt-3 grid gap-1.5 text-[0.95rem]">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-ink-soft">🎂 Ngày sinh</span>
        {birthday ? <span className="font-semibold">{birthday}</span> : <span className="text-ink-soft">chưa ghi</span>}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-ink-soft">🙂 Giới tính</span>
        {g ? (
          <span className="font-semibold">
            <span aria-hidden>{g.emoji}</span> {g.label}
          </span>
        ) : (
          <span className="text-ink-soft">chưa ghi</span>
        )}
      </p>
      <p className="break-words">
        <span className="text-ink-soft">🎈 Sở thích: </span>
        {row.hobby ? <span className="font-hand text-[1.05rem]">{row.hobby}</span> : <span className="text-ink-soft">chưa ghi</span>}
      </p>
      <p className="break-words">
        <span className="text-ink-soft">🌟 Ước mơ: </span>
        {row.dream ? <span className="font-hand text-[1.05rem]">{row.dream}</span> : <span className="text-ink-soft">chưa ghi</span>}
      </p>
    </div>
  );
}

function BirthdayCard({ rows, title, empty }: { rows: MangNonRow[]; title: string; empty: string }) {
  const month = currentMonth();
  const list = byBirthday(rows, month);
  return (
    <section className="sticker group-3 p-4">
      <h2 className="text-xl font-extrabold">🎂 {title}</h2>
      {list.length === 0 ? (
        <p className="mt-1 text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {list.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 ring-1 ring-line">
              <Avatar emoji={r.avatarEmoji} url={r.avatarUrl} name={r.fullName} size={32} />
              <span className="min-w-0">
                <span className="block max-w-[9.5rem] truncate font-semibold leading-tight">{r.fullName}</span>
                <span className="block text-xs text-ink-soft">Ngày {dayMonth(r)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// The edit form ------------------------------------------------------------------------------------

interface Form {
  birthday: string;
  gender: Gender | null;
  hobby: string;
  dream: string;
  duty: string;
}

const EMPTY_FORM: Form = { birthday: "", gender: null, hobby: "", dream: "", duty: "" };

const formOf = (r: MangNonRow): Form => ({
  birthday: r.birthday ?? "",
  gender: r.gender,
  hobby: r.hobby,
  dream: r.dream,
  duty: r.duty,
});

const counter = (value: string, max: number) => `${value.length}/${max} ký tự`;

function ProfileFields({
  f,
  setF,
  errors,
  child,
}: {
  f: Form;
  setF: Dispatch<SetStateAction<Form>>;
  errors: Record<string, string>;
  /** The child's own page: warmer copy, and no chức vụ. */
  child?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <Field
        label={child ? "Ngày sinh của con" : "Ngày sinh"}
        type="date"
        value={f.birthday}
        max={todayLocal()}
        onChange={(e) => setF((x) => ({ ...x, birthday: e.target.value }))}
        error={errors.birthday}
        hint={child ? "Cả lớp chỉ nhìn thấy ngày và tháng thôi." : "Các bạn trong lớp chỉ nhìn thấy ngày và tháng."}
        data-autofocus
      />

      <fieldset>
        <legend className="mb-2 text-[0.9375rem] font-semibold">{child ? "Con là bạn nữ hay bạn nam?" : "Giới tính"}</legend>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => (
            <button
              key={g}
              type="button"
              className="chip !min-h-[44px]"
              aria-pressed={f.gender === g}
              onClick={() => setF((x) => ({ ...x, gender: x.gender === g ? null : g }))}
            >
              <span aria-hidden>{GENDER_INFO[g].emoji}</span> {GENDER_INFO[g].label}
            </button>
          ))}
        </div>
        <small className="mt-1 block text-ink-soft">Bấm lại ô đang chọn để bỏ trống.</small>
        {errors.gender ? <small className="field-error">{errors.gender}</small> : null}
      </fieldset>

      <TextArea
        label={child ? "Con thích gì nhất?" : "Sở thích"}
        value={f.hobby}
        maxLength={MAX_TEXT}
        rows={2}
        placeholder={child ? "Ví dụ: con thích vẽ và đá bóng" : "Ví dụ: vẽ tranh, đá bóng"}
        onChange={(e) => setF((x) => ({ ...x, hobby: e.target.value }))}
        error={errors.hobby}
        hint={counter(f.hobby, MAX_TEXT)}
      />

      <TextArea
        label={child ? "Lớn lên con muốn làm gì?" : "Ước mơ"}
        value={f.dream}
        maxLength={MAX_TEXT}
        rows={2}
        placeholder={child ? "Ví dụ: con muốn làm bác sĩ" : "Ví dụ: làm bác sĩ"}
        onChange={(e) => setF((x) => ({ ...x, dream: e.target.value }))}
        error={errors.dream}
        hint={counter(f.dream, MAX_TEXT)}
      />

      {child ? (
        <p className="rounded-xl bg-page px-3 py-2 text-[0.95rem] text-ink-soft">🎖️ Chức vụ do cô giáo ghi.</p>
      ) : (
        <fieldset>
          <legend className="mb-2 text-[0.9375rem] font-semibold">Chức vụ</legend>
          <div className="flex flex-wrap gap-2">
            {DUTIES.map((d) => (
              <button
                key={d}
                type="button"
                className="chip !min-h-[44px]"
                aria-pressed={f.duty === d}
                onClick={() => setF((x) => ({ ...x, duty: x.duty === d ? "" : d }))}
              >
                {d}
              </button>
            ))}
          </div>
          <Field
            label="Hoặc cô tự ghi chức vụ khác"
            className="mt-3"
            value={f.duty}
            maxLength={MAX_DUTY}
            placeholder="Ví dụ: Phụ trách cây xanh"
            onChange={(e) => setF((x) => ({ ...x, duty: e.target.value }))}
            error={errors.duty}
            hint="Để trống nếu con chưa nhận chức vụ nào."
          />
        </fieldset>
      )}
    </div>
  );
}

// Teacher ------------------------------------------------------------------------------------------

export function MangNonBook({ classId, teams }: { classId: number; teams: { name: string; emoji: string }[] }) {
  const { data, setData, error, reload } = useApi<MangNonRow[]>(`/api/t/classes/${classId}/mang-non`);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<number | "all">("all");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [editing, setEditing] = useState<MangNonRow | null>(null);

  const rows = useMemo(() => data ?? [], [data]);
  const doneCount = useMemo(() => rows.filter(written).length, [rows]);
  const shown = useMemo(() => {
    const q = searchKey(query.trim());
    return rows.filter(
      (r) =>
        (group === "all" || r.group === group) &&
        (!onlyEmpty || !written(r)) &&
        (q === "" || searchKey(r.fullName).includes(q)),
    );
  }, [rows, query, group, onlyEmpty]);

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const missing = rows.length - doneCount;

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[2rem] font-extrabold">🌱 Hồ sơ Măng non</h1>
        <p className="text-ink-soft">Trang riêng của từng bạn: ngày sinh, sở thích, ước mơ và chức vụ. Bấm vào thẻ để ghi giúp con.</p>
      </div>

      {rows.length === 0 ? (
        <Empty emoji="🌱" title="Lớp chưa có bạn nào">
          Thêm học sinh ở mục Học sinh, rồi quay lại ghi trang Măng non cho từng bạn.
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="sticker group-2 p-4">
              <h2 className="text-xl font-extrabold">📖 Trang đã ghi</h2>
              <p className="mt-1 text-[1.05rem]">
                <strong>
                  {doneCount}/{rows.length}
                </strong>{" "}
                bạn đã có trang riêng.
              </p>
              {missing > 0 ? (
                <p className="text-ink-soft">Còn {missing} bạn chưa ghi gì.</p>
              ) : (
                <p className="text-ink-soft">Cả lớp đã ghi xong rồi, cô ơi! 🎉</p>
              )}
            </section>
            <BirthdayCard rows={rows} title="Sinh nhật tháng này" empty="Tháng này lớp mình không có bạn nào sinh nhật." />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Lọc theo tổ" className="flex flex-wrap gap-1.5">
              <button type="button" role="tab" className="chip !min-h-[44px]" aria-selected={group === "all"} onClick={() => setGroup("all")}>
                Tất cả
              </button>
              {teams.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  className="chip !min-h-[44px]"
                  aria-selected={group === i + 1}
                  onClick={() => setGroup(i + 1)}
                >
                  <span aria-hidden>{t.emoji}</span> Tổ {i + 1}
                </button>
              ))}
            </div>
            {missing > 0 ? (
              <button type="button" className="chip !min-h-[44px]" aria-pressed={onlyEmpty} onClick={() => setOnlyEmpty((v) => !v)}>
                Chưa ghi gì ({missing})
              </button>
            ) : null}
            <label className="relative w-full min-w-[180px] sm:ml-auto sm:w-auto sm:max-w-[240px] sm:flex-1">
              <span className="sr-only">Tìm học sinh</span>
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden />
              <input
                className="input !rounded-full pl-9"
                type="search"
                placeholder="Tìm học sinh…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          {shown.length === 0 ? (
            <Empty emoji="🔎" title="Không tìm thấy bạn nào">
              Thử xoá bớt chữ trong ô tìm kiếm, hoặc chọn lại tổ.
            </Empty>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((r) => (
                <li key={r.id} className={cn("sticker relative p-4", groupClass(r.group))}>
                  <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-page text-ink-soft" aria-hidden>
                    <Pencil size={15} />
                  </span>
                  <div className="pr-9">
                    <CardHead row={r} />
                  </div>
                  <Facts row={r} birthday={r.birthday ? formatLocalDate(r.birthday) : dayMonth(r)} />
                  {/* The whole card is the tap target: nothing else inside it is clickable. */}
                  <button
                    type="button"
                    className="absolute inset-0 rounded-[22px]"
                    onClick={() => setEditing(r)}
                    aria-label={`Sửa trang Măng non của ${r.fullName}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <TeacherSheet
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setData((xs) => (xs ? xs.map((x) => (x.id === updated.id ? updated : x)) : xs));
          setEditing(null);
        }}
        // A new picture saves on its own; the sheet stays open so nothing she has typed is lost.
        onAvatar={(updated) => {
          setData((xs) => (xs ? xs.map((x) => (x.id === updated.id ? updated : x)) : xs));
          setEditing(updated);
        }}
      />
    </div>
  );
}

function TeacherSheet({ row, onClose, onSaved, onAvatar }: { row: MangNonRow | null; onClose(): void; onSaved(r: MangNonRow): void; onAvatar(r: MangNonRow): void }) {
  const [f, setF] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Keyed on the child, not the row object: a new picture updates the row, and must not wipe what is being typed.
  useEffect(() => {
    if (row) {
      setF(formOf(row));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  if (!row) {
    return (
      <Sheet open={false} onClose={onClose} title="">
        {null}
      </Sheet>
    );
  }

  async function save() {
    setBusy(true);
    setErrors({});
    const r = await patch<MangNonRow>(`/api/t/students/${row!.id}/profile`, {
      birthday: f.birthday || null,
      gender: f.gender,
      hobby: f.hobby.trim(),
      dream: f.dream.trim(),
      duty: f.duty.trim(),
    });
    setBusy(false);
    if (!r.ok) {
      if (r.fields) setErrors(r.fields);
      else setErrors({ _: r.message });
      return;
    }
    toast(`Đã lưu trang của ${row!.fullName}.`);
    onSaved(r.data);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Trang Măng non của ${row.fullName}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Thôi
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="min-w-0 break-words text-ink-soft">
          {row.group ? `${row.teamEmoji ?? ""} Tổ ${row.group}${row.teamName ? ` · ${row.teamName}` : ""}` : "Chưa xếp tổ"}
        </p>
        <AvatarPicker row={row} base={`/api/t/students/${row.id}`} onChanged={(a) => onAvatar({ ...row, ...a })} />
        <ProfileFields f={f} setF={setF} errors={errors} />
        {/* "Thêm mục SẢN PHẨM CỦA EM ở phần hồ sơ măng non (mỗi HS có 1 mục này)" — brief 4, item 5. */}
        <WorksEditor studentId={row.id} fullName={row.fullName} />
        <FormError message={errors._ ?? null} />
      </div>
    </Sheet>
  );
}

// Family and child ------------------------------------------------------------------------------------

export function MangNonClass({ meId }: { meId: number }) {
  const { data, setData, error, reload } = useApi<MangNonRow[]>("/api/s/mang-non");
  const [editing, setEditing] = useState(false);

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const me = data.find((r) => r.id === meId) ?? null;
  const others = data.filter((r) => r.id !== meId);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[2rem] font-extrabold">🌱 Hồ sơ Măng non</h1>
        <p className="text-ink-soft">Trang của cả lớp mình. Con ghi trang của con, còn trang các bạn thì mình chỉ đọc thôi nhé.</p>
      </div>

      {data.length === 0 ? (
        <Empty emoji="🌱" title="Lớp mình chưa có trang nào">
          Khi cô thêm các bạn vào lớp, trang của cả lớp sẽ hiện ở đây.
        </Empty>
      ) : null}

      {me ? (
        <section className="sticker group-1 relative p-4 sm:p-5" data-selected="true">
          <span className="absolute -top-3 left-4 rounded-full bg-gold px-2 py-0.5 text-sm font-bold shadow-[0_2px_0_#d9ad16]">🌟 Trang của con</span>
          <div className="mt-2">
            <CardHead row={me} size={72} />
          </div>
          <Facts row={me} birthday={me.birthday ? formatLocalDate(me.birthday) : dayMonth(me)} />
          <button type="button" className="btn btn-primary mt-4 w-full sm:w-auto" onClick={() => setEditing(true)}>
            <Pencil size={18} aria-hidden /> Sửa trang của con
          </button>
        </section>
      ) : null}

      <BirthdayCard rows={data} title="Sinh nhật tháng này" empty="Tháng này lớp mình không có bạn nào sinh nhật." />

      {others.length ? (
        <section>
          <h2 className="mb-3 text-xl font-extrabold">👫 Các bạn trong lớp</h2>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((r) => (
              <li key={r.id} className={cn("sticker p-4", groupClass(r.group))}>
                <CardHead row={r} />
                {/* A classmate's birthday: the day and month, never the year. */}
                <Facts row={r} birthday={dayMonth(r)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ChildSheet
        row={editing ? me : null}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          setData((xs) => (xs ? xs.map((x) => (x.id === updated.id ? updated : x)) : xs));
          setEditing(false);
        }}
        // A new picture saves on its own; the sheet stays open so nothing the child has typed is lost.
        onAvatar={(updated) => setData((xs) => (xs ? xs.map((x) => (x.id === updated.id ? updated : x)) : xs))}
      />
    </div>
  );
}

function ChildSheet({ row, onClose, onSaved, onAvatar }: { row: MangNonRow | null; onClose(): void; onSaved(r: MangNonRow): void; onAvatar(r: MangNonRow): void }) {
  const [f, setF] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Keyed on the child, not the row object: a new picture updates the row, and must not wipe what is being typed.
  useEffect(() => {
    if (row) {
      setF(formOf(row));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  if (!row) {
    return (
      <Sheet open={false} onClose={onClose} title="">
        {null}
      </Sheet>
    );
  }

  async function save() {
    setBusy(true);
    setErrors({});
    const r = await patch<MangNonRow>("/api/s/profile", {
      birthday: f.birthday || null,
      gender: f.gender,
      hobby: f.hobby.trim(),
      dream: f.dream.trim(),
    });
    setBusy(false);
    if (!r.ok) {
      if (r.fields) setErrors(r.fields);
      else setErrors({ _: r.message });
      return;
    }
    toast("Đã lưu trang của con rồi!");
    onSaved(r.data);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Trang của con"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Thôi
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? "Đang lưu…" : "Lưu trang của con"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="min-w-0 break-words font-display text-lg font-extrabold leading-tight">{row.fullName}</p>
        <AvatarPicker row={row} base="/api/s" onChanged={(a) => onAvatar({ ...row, ...a })} />
        <ProfileFields f={f} setF={setF} errors={errors} child />
        <FormError message={errors._ ?? null} />
      </div>
    </Sheet>
  );
}
