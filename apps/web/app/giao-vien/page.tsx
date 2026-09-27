"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { ClassDetail, ClassSummary, Me, TeacherMe } from "@lhhp/shared";
import { AuthCard } from "@/components/auth-card";
import { PasswordField } from "@/components/password-input";
import { TeacherTopbar } from "@/components/teacher/topbar";
import { ClassForm } from "@/components/teacher/class-form";
import { Empty, Field, FormError, Loading, LoadError, Sheet } from "@/components/ui";
import { post } from "@/lib/api";
import { nextPath, useSession } from "@/lib/session";
import { useApi } from "@/lib/use-api";
import { useRouter } from "next/navigation";

export default function TeacherHome() {
  const { me, loading } = useSession();
  if (loading) return <Loading />;
  if (me?.role !== "teacher") return <TeacherLogin />;
  return <ClassList me={me} />;
}

function TeacherLogin() {
  const router = useRouter();
  const { setMe } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post<{ me: Me }>("/api/auth/teacher/login", { username, password });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setMe(r.data.me);
    const next = nextPath("", "/giao-vien/lop/");
    if (next) router.replace(next);
  }

  return (
    <AuthCard emoji="🍎" title="Trang giáo viên" intro="Đăng nhập để quản lý lớp của cô.">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Tên đăng nhập" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} />
        <PasswordField label="Mật khẩu" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <button type="submit" className="btn btn-primary text-lg" disabled={busy || !username || !password}>
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
      <div className="mt-6 grid gap-1 text-center text-[0.95rem]">
        <Link href="/giao-vien/dang-ky/" className="text-blue-ink">
          Tạo tài khoản giáo viên (cần mã mời)
        </Link>
        <Link href="/dang-nhap/" className="text-blue-ink">
          Học sinh, phụ huynh đăng nhập ở đây
        </Link>
      </div>
    </AuthCard>
  );
}

function ClassList({ me }: { me: TeacherMe }) {
  const router = useRouter();
  const { data, error, reload } = useApi<ClassSummary[]>("/api/t/classes");
  const [creating, setCreating] = useState(false);

  return (
    <>
      <TeacherTopbar me={me} />
      <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="red-pen text-lg">Chào {me.displayName}!</p>
            <h1 className="text-[2.4rem] font-extrabold">Các lớp của tôi</h1>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <span aria-hidden>＋</span> Tạo lớp mới
          </button>
        </div>

        <div className="mt-8">
          {error ? (
            <LoadError message={error} onRetry={reload} />
          ) : !data ? (
            <Loading />
          ) : data.length === 0 ? (
            <Empty emoji="🏫" title="Chưa có lớp nào">
              <p>Tạo lớp đầu tiên, rồi dán danh sách học sinh vào: mỗi em một dòng. App tự tạo tài khoản cho từng em.</p>
              <button type="button" className="btn btn-primary mt-4" onClick={() => setCreating(true)}>
                Tạo lớp mới
              </button>
            </Empty>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((c, i) => (
                <li key={c.id}>
                  <Link href={`/giao-vien/lop/?id=${c.id}`} className={`sticker group-${(i % 8) + 1} block overflow-hidden no-underline hover:-rotate-1`}>
                    {c.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.coverUrl} alt="" className="h-28 w-full rounded-t-[18px] object-cover" />
                    ) : (
                      <div className="chalkboard grid h-28 place-items-center !rounded-t-[18px] !border-4 font-hand text-2xl">{c.name}</div>
                    )}
                    <div className="p-4">
                      <h2 className="text-2xl font-extrabold">{c.name}</h2>
                      <p className="text-ink-soft">{c.studentCount} học sinh</p>
                      <p className="text-sm text-ink-soft">Năm học {c.schoolYear}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Sheet open={creating} onClose={() => setCreating(false)} title="Tạo lớp mới">
        <ClassForm
          submitLabel="Tạo lớp"
          onSaved={(c: ClassDetail) => {
            setCreating(false);
            router.push(`/giao-vien/lop/?id=${c.id}&tab=tai-khoan&them=1`);
          }}
        />
      </Sheet>
    </>
  );
}
