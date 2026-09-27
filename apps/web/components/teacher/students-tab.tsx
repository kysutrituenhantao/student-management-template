"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, Pencil, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import {
  AVATAR_EMOJIS,
  DEFAULT_STUDENT_PASSWORD,
  IMAGE_LIMITS,
  MAX_STUDENTS_PER_CLASS,
  parseStudentList,
  usernameFor,
  type AccountSlip,
  type ClassOverview,
  type NewAccount,
  type StudentProfile,
  type StudentReport,
  type StudentRow,
  type TeacherNote,
} from "@lhhp/shared";
import { Plant } from "@/components/plant";
import { ReportView } from "@/components/report-view";
import { Avatar, Confirm, Field, FormError, Loading, Sheet, toast } from "@/components/ui";
import { api, del, patch, post, put } from "@/lib/api";
import { formatDate, signed, timeAgo } from "@/lib/format";
import { resizeImage } from "@/lib/image";
import { useApi } from "@/lib/use-api";
import { cn, groupClass } from "@/lib/utils";

/** Puts a child's account on the clipboard, ready to paste into a message to their family. */
async function copyAccount(fullName: string, username: string, password?: string) {
  const text = `${fullName}\nTên đăng nhập: ${username}\nMật khẩu: ${password ?? ""}`.trim();
  try {
    await navigator.clipboard.writeText(text);
    toast("Đã sao chép tài khoản. Cô dán vào Zalo gửi phụ huynh nhé.");
  } catch {
    toast("Trình duyệt không cho sao chép. Cô bấm giữ để chọn rồi sao chép nhé.", "error");
  }
}

export function StudentsTab({ overview, reload }: { overview: ClassOverview; reload(): void }) {
  const params = useSearchParams();
  const cls = overview.class;
  const [adding, setAdding] = useState(params.get("them") === "1");
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [profile, setProfile] = useState<StudentRow | null>(null);
  const [resetting, setResetting] = useState<StudentRow | null>(null);
  const [removing, setRemoving] = useState<StudentRow | null>(null);
  const [repattern, setRepattern] = useState(false);
  const [newPassword, setNewPassword] = useState<{ fullName: string; username: string; password: string } | null>(null);
  // Passwords are hidden until she asks: this screen goes on the classroom TV.
  const [showPasswords, setShowPasswords] = useState(false);
  const { data: slips, reload: reloadSlips } = useApi<AccountSlip[]>(`/api/t/classes/${cls.id}/accounts`);
  const passwordOf = new Map((slips ?? []).map((a) => [a.id, a]));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-[2rem] font-extrabold">🔑 Tài khoản học sinh</h1>
        <button type="button" className="btn btn-ghost" onClick={() => setShowPasswords((v) => !v)} aria-pressed={showPasswords}>
          {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />} {showPasswords ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        </button>
        <Link href={`/giao-vien/lop/in-tai-khoan/?id=${cls.id}`} target="_blank" className="btn btn-ghost">
          <Printer size={18} /> In phiếu tài khoản
        </Link>
        {overview.students.length ? (
          <button type="button" className="btn btn-ghost" onClick={() => setRepattern(true)}>
            <RefreshCw size={18} /> Tạo lại tài khoản cả lớp theo mẫu
          </button>
        ) : null}
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={18} /> Thêm học sinh
        </button>
      </div>

      <aside className="rounded-2xl border-2 border-dashed border-blue bg-blue-soft/50 p-4 text-[0.95rem]">
        <p>
          <strong>Tài khoản của học sinh:</strong> tên đăng nhập là tên lót, tên và ngày sinh của con, không dấu (ví dụ:{" "}
          <code>minhanh27</code>); mật khẩu ban đầu của cả lớp là <code>{DEFAULT_STUDENT_PASSWORD}</code>. Hai bạn trùng
          nhau thì bạn sau có thêm một chữ cái (<code>minhanh27b</code>).
        </p>
        <p className="mt-1 text-ink-soft">
          Lần đầu vào lớp, gia đình đặt một mật khẩu riêng — vì cả lớp dùng chung {DEFAULT_STUDENT_PASSWORD} — và cô vẫn
          xem được mật khẩu đó: bấm <em>Hiện mật khẩu</em> rồi <em>Sao chép</em> để gửi qua Zalo. Quên mật khẩu thì cô bấm{" "}
          <em>Đặt lại mật khẩu</em>, tài khoản về lại {DEFAULT_STUDENT_PASSWORD}.
        </p>
      </aside>

      {overview.students.length === 0 ? (
        <div className="paper grid place-items-center px-6 py-12 text-center">
          <p className="text-5xl" aria-hidden>
            📋
          </p>
          <p className="mt-2 font-display text-xl font-bold">Chưa có học sinh</p>
          <p className="mt-1 max-w-md text-ink-soft">Dán danh sách lớp từ Word, Excel hoặc Zalo: mỗi bạn một dòng. App tự tạo tài khoản cho từng bạn.</p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => setAdding(true)}>
            Thêm học sinh
          </button>
        </div>
      ) : (
        <div className="paper relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[0.95rem]">
            <thead className="text-sm text-ink-soft">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-semibold">Học sinh</th>
                <th className="px-2 py-3 font-semibold">Tên đăng nhập và mật khẩu</th>
                <th className="px-2 py-3 font-semibold">Tổ</th>
                <th className="px-2 py-3 font-semibold">Giọt nước</th>
                <th className="px-2 py-3 font-semibold">Tình trạng</th>
                <th className="px-4 py-3 text-right font-semibold">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {overview.students.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2">
                    <button type="button" className="flex items-center gap-3 text-left hover:text-pink-ink" onClick={() => setProfile(s)}>
                      <Avatar emoji={s.avatarEmoji} url={s.avatarUrl} name={s.fullName} size={40} />
                      <span className="font-semibold">{s.fullName}</span>
                    </button>
                  </td>
                  <td className="px-2">
                    <span className="block font-semibold">{s.username}</span>
                    <span className="flex items-center gap-1 text-sm">
                      <span className={cn("tracking-wider", showPasswords ? "font-bold" : "text-ink-soft")}>
                        {showPasswords ? (passwordOf.get(s.id)?.password ?? "…") : "••••••"}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm !min-h-8 !px-1.5"
                        title="Sao chép tài khoản để gửi phụ huynh"
                        aria-label={`Sao chép tài khoản của ${s.fullName}`}
                        onClick={() => copyAccount(s.fullName, s.username, passwordOf.get(s.id)?.password)}
                      >
                        <Copy size={14} />
                      </button>
                    </span>
                  </td>
                  <td className="px-2">Tổ {s.group}</td>
                  <td className="px-2">
                    <span className="point-count">💧 {s.points}</span>
                  </td>
                  <td className="px-2 text-sm">
                    <span className="text-ink-soft">{s.lastLoginAt ? `Vào lớp ${timeAgo(s.lastLoginAt)}` : "Chưa vào lớp"}</span>
                    {passwordOf.get(s.id)?.chosenByChild ? <span className="block text-xs text-ink-soft">Gia đình tự đổi</span> : null}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex justify-end gap-1">
                      <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={() => setEditing(s)} aria-label={`Sửa thông tin ${s.fullName}`} title="Sửa">
                        <Pencil size={16} />
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={() => setResetting(s)} aria-label={`Đặt lại mật khẩu cho ${s.fullName}`} title="Đặt lại mật khẩu">
                        <KeyRound size={16} />
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm !px-2.5 text-red-pen" onClick={() => setRemoving(s)} aria-label={`Xoá ${s.fullName}`} title="Xoá">
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BulkAddSheet
        open={adding}
        overview={overview}
        onClose={() => setAdding(false)}
        // The new children's passwords come with the account list, which has to be asked for again.
        onAdded={() => {
          reload();
          void reloadSlips();
        }}
      />
      <StudentEditSheet student={editing} overview={overview} onClose={() => setEditing(null)} onSaved={reload} />
      <StudentProfileSheet student={profile} overview={overview} onClose={() => setProfile(null)} />
      <Confirm
        open={resetting !== null}
        title="Đặt lại mật khẩu?"
        body={
          <p>
            Mật khẩu của <strong>{resetting?.fullName}</strong> về lại <strong>{DEFAULT_STUDENT_PASSWORD}</strong>, các thiết
            bị đang đăng nhập sẽ bị đăng xuất, và lần vào lớp tới gia đình đặt mật khẩu riêng mới. Tên đăng nhập vẫn là{" "}
            <strong>{resetting?.username}</strong>.
          </p>
        }
        action="Đặt lại mật khẩu"
        onClose={() => setResetting(null)}
        onConfirm={async () => {
          const r = await post<{ password: string }>(`/api/t/students/${resetting!.id}/reset-password`);
          if (!r.ok) return toast(r.message, "error");
          toast(`Đã đặt lại mật khẩu cho ${resetting!.fullName}.`);
          setNewPassword({ fullName: resetting!.fullName, username: resetting!.username, password: r.data.password });
          setResetting(null);
          reload();
          void reloadSlips();
        }}
      />
      <Sheet open={newPassword !== null} onClose={() => setNewPassword(null)} title="Mật khẩu mới">
        {newPassword ? (
          <div className="grid gap-3 text-[1.05rem]">
            <p>Gửi cho gia đình {newPassword.fullName}:</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-page p-4">
              <dt>Tên đăng nhập</dt>
              <dd className="font-bold">{newPassword.username}</dd>
              <dt>Mật khẩu</dt>
              <dd className="text-xl font-bold tracking-wider">{newPassword.password}</dd>
            </dl>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => copyAccount(newPassword.fullName, newPassword.username, newPassword.password)}
              >
                <Copy size={16} /> Sao chép
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setNewPassword(null)}>
                Xong
              </button>
            </div>
          </div>
        ) : null}
      </Sheet>
      <Confirm
        open={repattern}
        title="Tạo lại tài khoản cả lớp?"
        body={
          <div className="grid gap-2">
            <p>
              Cả {overview.students.length} bạn sẽ có tên đăng nhập mới theo mẫu <strong>tên lót + tên + ngày sinh</strong>{" "}
              (ví dụ <code>minhanh27</code>) và mật khẩu <strong>{DEFAULT_STUDENT_PASSWORD}</strong>.
            </p>
            <p>
              Gia đình nào đang đăng nhập sẽ bị đăng xuất và cần tài khoản mới, kể cả nhà đã tự đặt mật khẩu. Giọt nước, hồ
              sơ và mọi thứ khác của con <strong>giữ nguyên</strong>.
            </p>
            <p className="text-ink-soft">Bạn nào chưa có ngày sinh thì tên đăng nhập chỉ có tên — cô ghi ngày sinh ở Hồ sơ Măng non trước rồi bấm lại cũng được.</p>
          </div>
        }
        action="Tạo lại tài khoản"
        onClose={() => setRepattern(false)}
        onConfirm={async () => {
          const r = await post(`/api/t/classes/${cls.id}/accounts/pattern`);
          if (!r.ok) return toast(r.message, "error");
          toast("Đã tạo lại tài khoản cả lớp. Cô in phiếu mới gửi phụ huynh nhé.");
          setRepattern(false);
          setShowPasswords(true);
          reload();
          void reloadSlips();
        }}
      />
      <Confirm
        open={removing !== null}
        title="Xoá học sinh?"
        danger
        body={<p>Xoá <strong>{removing?.fullName}</strong> cùng toàn bộ giọt nước, bài làm, huy hiệu và tin nhắn của con. Không hoàn tác được.</p>}
        action="Xoá học sinh"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const r = await del(`/api/t/students/${removing!.id}`);
          if (!r.ok) return toast(r.message, "error");
          toast(`Đã xoá ${removing!.fullName}.`);
          setRemoving(null);
          reload();
        }}
      />
    </div>
  );
}

const EXAMPLE = `Nguyễn Thị Minh Anh, 27/03/2016, 1
Trần Hoài An, 22/11/2016, 2
Lê Thị Ngọc Ánh, 01/05/2016, 1`;

/** "2016-03-27" → "27/03/2016", the way she typed it. */
const dmy = (iso: string) => iso.split("-").reverse().join("/");

function BulkAddSheet({ open, overview, onClose, onAdded }: { open: boolean; overview: ClassOverview; onClose(): void; onAdded(): void }) {
  const cls = overview.class;
  const [text, setText] = useState("");
  const [created, setCreated] = useState<NewAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseStudentList(text), [text]);
  const room = MAX_STUDENTS_PER_CLASS - overview.students.length;
  const badGroup = parsed.students.find((s) => s.group && s.group > cls.groupCount);
  // Every child joins a tổ: it is what the class competes in, and what the register is sorted by.
  const noGroup = parsed.students.filter((s) => !s.group);

  /** Spreads the children with no tổ over the class's tổ, in list order, and writes it back into the box. */
  function shareOutGroups() {
    let n = 0;
    const lines = text.split(/\r?\n/);
    const byLine = new Map(parsed.students.map((s) => [s.line, s]));
    setText(
      lines
        .map((raw, i) => {
          const student = byLine.get(i + 1);
          if (!student || student.group) return raw;
          const born = student.birthday ? `, ${dmy(student.birthday)}` : "";
          return `${student.fullName}${born}, ${(n++ % cls.groupCount) + 1}`;
        })
        .join("\n"),
    );
  }

  useEffect(() => {
    if (open) {
      setText("");
      setCreated(null);
      setError(null);
    }
  }, [open]);

  async function create() {
    setBusy(true);
    setError(null);
    const r = await post<NewAccount[]>(`/api/t/classes/${cls.id}/students`, {
      students: parsed.students.map((s) => ({ fullName: s.fullName, group: s.group, birthday: s.birthday })),
    });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setCreated(r.data);
    onAdded();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={created ? `🎉 Đã tạo ${created.length} tài khoản` : "Thêm học sinh"}
      footer={
        created ? (
          <>
            <Link href={`/giao-vien/lop/in-tai-khoan/?id=${cls.id}`} target="_blank" className="btn btn-ghost">
              <Printer size={18} /> In phiếu tài khoản
            </Link>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Xong
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Thôi
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || parsed.students.length === 0 || parsed.students.length > room || !!badGroup || noGroup.length > 0}
              onClick={create}
            >
              {busy ? "Đang tạo…" : `Tạo ${parsed.students.length || ""} tài khoản`}
            </button>
          </>
        )
      }
    >
      {created ? (
        <div className="grid gap-3">
          <p>
            In phiếu để gửi phụ huynh, hoặc chụp màn hình gửi qua Zalo. Cô xem lại tài khoản của cả lớp bất cứ lúc nào ở
            mục Học sinh.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {created.map((a) => (
              <li key={a.id} className="rounded-xl bg-page px-3 py-2">
                <span className="block font-semibold">{a.fullName}</span>
                <span className="block text-sm text-ink-soft">
                  Tên đăng nhập: <strong className="text-ink">{a.username}</strong>
                </span>
                <span className="block text-sm text-ink-soft">
                  Mật khẩu: <strong className="text-ink">{a.password}</strong>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="field">
            <label htmlFor="bulk-list">Danh sách lớp, mỗi bạn một dòng</label>
            <textarea
              id="bulk-list"
              aria-describedby="bulk-list-hint"
              className="input min-h-[260px] font-medium"
              placeholder={EXAMPLE}
              value={text}
              onChange={(e) => setText(e.target.value)}
              data-autofocus
            />
            <small id="bulk-list-hint" className="text-ink-soft">
              Dán từ Word, Excel hoặc Zalo đều được. Số thứ tự ở đầu dòng tự bỏ qua. Mỗi dòng: <strong>họ tên, ngày sinh, tổ</strong>{" "}
              — ví dụ: Trần Hoài An, 22/11/2016, 2. <strong>Bạn nào cũng cần có tổ</strong>; ngày sinh để làm tên đăng nhập.
            </small>
          </div>
          <div>
            <p className="font-semibold">Xem trước ({parsed.students.length} bạn)</p>
            {parsed.students.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Danh sách sẽ hiện ở đây, kèm tên đăng nhập dự kiến.</p>
            ) : (
              <ol className="mt-2 grid max-h-[300px] gap-1 overflow-y-auto pr-1 text-[0.92rem]">
                {parsed.students.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-page px-2 py-1">
                    <span className="w-6 text-right text-ink-soft">{i + 1}.</span>
                    <span className="flex-1 font-medium">{s.fullName}</span>
                    {s.birthday ? <span className="text-sm text-ink-soft">{dmy(s.birthday)}</span> : null}
                    {s.group ? (
                      <span className={cn("text-sm", s.group > cls.groupCount && "font-bold text-red-pen")}>Tổ {s.group}</span>
                    ) : (
                      <span className="text-sm font-bold text-red-pen">Chưa có tổ</span>
                    )}
                    <span className="text-sm font-semibold text-blue-ink">{usernameFor(s.fullName, s.birthday)}</span>
                  </li>
                ))}
              </ol>
            )}
            {parsed.errors.length ? (
              <ul className="mt-3 grid gap-1 text-sm text-red-pen">
                {parsed.errors.map((e) => (
                  <li key={e.line}>
                    Dòng {e.line} ({e.text}): {e.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {parsed.students.length > room ? (
              <p className="field-error mt-2">Lớp chỉ còn chỗ cho {room} bạn nữa (tối đa {MAX_STUDENTS_PER_CLASS}).</p>
            ) : null}
            {badGroup ? <p className="field-error mt-2">Lớp chỉ có {cls.groupCount} tổ. Sửa số tổ ở dòng {badGroup.line}.</p> : null}
            {noGroup.length ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-gold-soft px-3 py-2 text-sm">
                <p className="flex-1">
                  <strong>{noGroup.length} bạn chưa có tổ.</strong> Thêm “, số tổ” sau tên, hoặc để app chia đều giúp cô.
                </p>
                <button type="button" className="btn btn-ghost btn-sm !min-h-[40px] bg-white/70" onClick={shareOutGroups}>
                  Chia tổ tự động
                </button>
              </div>
            ) : null}
            <p className="mt-3 text-sm text-ink-soft">
              Tên đăng nhập là tên lót, tên và ngày sinh của con, ví dụ <code>minhanh27</code>; mật khẩu ban đầu{" "}
              <code>{DEFAULT_STUDENT_PASSWORD}</code>, lần đầu vào lớp gia đình đặt mật khẩu riêng. Hai bạn trùng nhau thì bạn sau
              có thêm một chữ cái.
            </p>
          </div>
          <FormError message={error} />
        </div>
      )}
    </Sheet>
  );
}

function StudentEditSheet({ student, overview, onClose, onSaved }: { student: StudentRow | null; overview: ClassOverview; onClose(): void; onSaved(): void }) {
  const [f, setF] = useState({ fullName: "", username: "", group: "", avatarEmoji: "🐰" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (student) {
      setF({ fullName: student.fullName, username: student.username, group: student.group ? String(student.group) : "", avatarEmoji: student.avatarEmoji });
      setPhoto(student.avatarUrl);
      setErrors({});
    }
  }, [student]);

  if (!student) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;

  async function removePhoto() {
    const r = await del(`/api/t/students/${student!.id}/avatar`);
    if (!r.ok) return toast(r.message, "error");
    setPhoto(null);
    onSaved();
  }

  async function uploadPhoto(fl: File) {
    try {
      const dataUrl = await resizeImage(fl, IMAGE_LIMITS.avatar);
      const r = await put<StudentRow>(`/api/t/students/${student!.id}/avatar`, { dataUrl });
      if (!r.ok) throw new Error(r.message);
      setPhoto(r.data.avatarUrl);
      toast("Đã cập nhật ảnh.");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Không tải được ảnh.", "error");
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Sửa thông tin ${student.fullName}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErrors({});
              const r = await patch(`/api/t/students/${student.id}`, {
                fullName: f.fullName,
                username: f.username,
                group: Number(f.group),
                avatarEmoji: f.avatarEmoji,
              });
              setBusy(false);
              if (!r.ok) {
                setErrors(r.fields ?? { _: r.message });
                return;
              }
              toast("Đã lưu.");
              onSaved();
              onClose();
            }}
          >
            Lưu
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="flex items-center gap-4">
          <Avatar emoji={f.avatarEmoji} url={photo} name={student.fullName} size={80} />
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => file.current?.click()}>
              {photo ? "Đổi ảnh khác" : "Tải ảnh của con"}
            </button>
            {photo ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={removePhoto}>
                Bỏ ảnh, dùng sticker
              </button>
            ) : null}
          </div>
        </div>
        <fieldset>
          <legend className="mb-2 font-semibold">Sticker</legend>
          {photo ? <p className="mb-2 text-sm text-ink-soft">Chọn một sticker sẽ bỏ ảnh đang dùng.</p> : null}
          <div className="flex flex-wrap gap-1.5">
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={!photo && f.avatarEmoji === e}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-xl text-2xl",
                  !photo && f.avatarEmoji === e ? "bg-pink-soft ring-2 ring-pink-ink" : "bg-page",
                )}
                onClick={() => {
                  setF((x) => ({ ...x, avatarEmoji: e }));
                  if (photo) void removePhoto();
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Họ và tên" value={f.fullName} onChange={(e) => setF((x) => ({ ...x, fullName: e.target.value }))} error={errors.fullName} />
        <Field label="Tên đăng nhập" value={f.username} onChange={(e) => setF((x) => ({ ...x, username: e.target.value }))} error={errors.username} hint="Chữ không dấu, số và dấu gạch ngang." />
        <label className="field">
          <span>Tổ</span>
          <select className="input" value={f.group} onChange={(e) => setF((x) => ({ ...x, group: e.target.value }))}>
            {overview.class.teams.map((t, i) => (
              <option key={i} value={i + 1}>
                Tổ {i + 1}: {t.emoji} {t.name}
              </option>
            ))}
          </select>
        </label>
        <FormError message={errors._ ?? null} />
      </div>
    </Sheet>
  );
}

function StudentProfileSheet({ student, overview, onClose }: { student: StudentRow | null; overview: ClassOverview; onClose(): void }) {
  const [p, setP] = useState<StudentProfile | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setP(null);
    setNote("");
    if (!student) return;
    // A slow answer for the previous child must not show under this child's name.
    let current = true;
    void api<StudentProfile>(`/api/t/students/${student.id}`).then((r) => {
      if (!current) return;
      if (r.ok) setP(r.data);
      else toast(r.message, "error");
    });
    return () => {
      current = false;
    };
  }, [student]);

  return (
    <Sheet open={student !== null} onClose={onClose} wide title={student ? student.fullName : ""}>
      {!p || !student ? (
        <Loading />
      ) : (
        <div className="grid gap-6">
          <div className={cn("sticker flex flex-wrap items-center gap-5 p-5", groupClass(p.student.group))}>
            <Avatar emoji={p.student.avatarEmoji} url={p.student.avatarUrl} name={p.student.fullName} size={84} />
            <div className="min-w-[200px] flex-1">
              <p className="font-display text-2xl font-extrabold">
                <Plant level={p.level.level} size={30} className="mr-1 inline-block align-middle" /> Cây: {p.level.name}
              </p>
              <div className="progress mt-2">
                <span style={{ width: `${Math.round(p.level.progress * 100)}%` }} />
              </div>
              <p className="mt-1 text-sm text-ink-soft">{p.level.next ? `Còn ${p.level.toNext} giọt nước nữa là cây thành ${p.level.next.name}` : "Đã đạt cấp cao nhất"}</p>
            </div>
            <dl className="grid grid-cols-3 gap-4 text-center">
              <div>
                <dt className="text-sm text-ink-soft">Giọt nước</dt>
                <dd className="text-2xl font-semibold">{p.student.points}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-soft">Còn đổi quà</dt>
                <dd className="text-2xl font-semibold">{p.available}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-soft">Hạng tuần</dt>
                <dd className="text-2xl font-semibold">{p.rank ?? "–"}</dd>
              </div>
            </dl>
          </div>

          <section>
            <h3 className="text-xl font-extrabold">Nhận xét của cô</h3>
            <p className="text-sm text-ink-soft">Gia đình đọc được trong mục Kết quả của con.</p>
            <form
              className="mt-2 flex flex-col gap-2 sm:flex-row"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const r = await post<TeacherNote>(`/api/t/students/${student.id}/notes`, { body: note });
                setBusy(false);
                if (!r.ok) return toast(r.message, "error");
                setP((x) => (x ? { ...x, notes: [r.data, ...x.notes] } : x));
                setNote("");
              }}
            >
              <textarea className="input red-pen !min-h-[64px] flex-1 text-lg" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Tuần này con chăm phát biểu, cô rất vui!" />
              <button className="btn btn-primary sm:self-end" disabled={busy || !note.trim()}>
                Lưu nhận xét
              </button>
            </form>
            <ul className="mt-3 grid gap-2">
              {p.notes.map((n) => (
                <li key={n.id} className="flex items-start gap-3 rounded-xl bg-page px-3 py-2">
                  <p className="red-pen flex-1 whitespace-pre-wrap text-[1.08rem]">{n.body}</p>
                  <span className="shrink-0 text-xs text-ink-soft">{formatDate(n.createdAt)}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm !min-h-[28px] !px-1.5 text-red-pen"
                    aria-label="Xoá nhận xét"
                    onClick={async () => {
                      if (!window.confirm("Xoá nhận xét này?")) return;
                      const r = await del(`/api/t/notes/${n.id}`);
                      if (!r.ok) return toast(r.message, "error");
                      setP((x) => (x ? { ...x, notes: x.notes.filter((y) => y.id !== n.id) } : x));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {p.badges.length ? (
            <section>
              <h3 className="text-xl font-extrabold">Huy hiệu</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {p.badges.map((b) => (
                  <li key={b.key} className="chip" title={b.description}>
                    <span aria-hidden>{b.emoji}</span> {b.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h3 className="mb-3 text-xl font-extrabold">Kết quả của con</h3>
            <ReportView<StudentReport> base={`/api/t/students/${student.id}/report`} compact>
              {(r) =>
                r.events.length ? (
                  <section className="paper p-4">
                    <h4 className="font-display text-lg font-bold">Các lần nhận giọt nước</h4>
                    <ul className="mt-2 grid gap-1 text-[0.92rem]">
                      {r.events.slice(0, 15).map((e) => (
                        <li key={e.id} className="flex gap-2">
                          <span className={cn("w-8 text-right font-bold", e.delta > 0 ? "text-gold-ink" : "text-blue-ink")}>{signed(e.delta)}</span>
                          <span className="flex-1">
                            {e.emoji} {e.reason}
                          </span>
                          <span className="text-xs text-ink-soft">{timeAgo(e.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null
              }
            </ReportView>
          </section>
          <p className="text-sm text-ink-soft">
            Tổ: {p.student.group ? `${overview.class.teams[p.student.group - 1]?.emoji ?? ""} Tổ ${p.student.group}` : "chưa xếp"}. Tên đăng nhập: {p.student.username}.
          </p>
        </div>
      )}
    </Sheet>
  );
}
