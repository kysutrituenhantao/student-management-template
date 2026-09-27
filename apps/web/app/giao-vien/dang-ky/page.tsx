"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Me } from "@lhhp/shared";
import { AuthCard } from "@/components/auth-card";
import { PasswordField } from "@/components/password-input";
import { Field, FormError } from "@/components/ui";
import { post } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function TeacherRegister() {
  const router = useRouter();
  const { setMe } = useSession();
  const [form, setForm] = useState({ inviteCode: "", displayName: "", username: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    const r = await post<{ me: Me }>("/api/auth/teacher/register", form);
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      if (!r.fields) setError(r.message);
      return;
    }
    setMe(r.data.me);
    router.replace("/giao-vien/");
  }

  return (
    <AuthCard emoji="🍎" title="Tạo tài khoản giáo viên" intro="Cần mã mời do người quản trị ứng dụng gửi.">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Mã mời" value={form.inviteCode} onChange={set("inviteCode")} error={errors.inviteCode} autoComplete="off" required />
        <Field
          label="Tên hiển thị"
          placeholder="Ví dụ: Cô Hoa"
          hint="Học sinh và phụ huynh sẽ thấy tên này."
          value={form.displayName}
          onChange={set("displayName")}
          error={errors.displayName}
          required
        />
        <Field
          label="Tên đăng nhập"
          placeholder="Ví dụ: cohoa"
          autoCapitalize="none"
          autoComplete="username"
          spellCheck={false}
          value={form.username}
          onChange={set("username")}
          error={errors.username}
          required
        />
        <PasswordField
          label="Mật khẩu"
          hint="Ít nhất 8 ký tự."
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          required
        />
        <FormError message={error} />
        <button type="submit" className="btn btn-primary text-lg" disabled={busy}>
          {busy ? "Đang tạo…" : "Tạo tài khoản"}
        </button>
      </form>
      <p className="mt-6 text-center text-[0.95rem]">
        Đã có tài khoản?{" "}
        <Link href="/giao-vien/" className="text-blue-ink">
          Đăng nhập
        </Link>
      </p>
    </AuthCard>
  );
}
