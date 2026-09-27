"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { Me } from "@lhhp/shared";
import { AuthCard } from "@/components/auth-card";
import { PasswordField } from "@/components/password-input";
import { Field, FormError } from "@/components/ui";
import { post } from "@/lib/api";
import { nextPath, useSession } from "@/lib/session";

export default function StudentLogin() {
  const router = useRouter();
  const { me, setMe } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me?.role !== "student") return;
    // On the class's shared first password, choosing their own comes first; then on to where they were going.
    router.replace(me.mustChangePassword ? `/doi-mat-khau/${window.location.search}` : nextPath("/hoc-sinh/"));
  }, [me, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post<{ me: Me }>("/api/auth/student/login", { username, password });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setMe(r.data.me);
  }

  return (
    <AuthCard emoji="🎒" title="Vào lớp nào!" intro="Học sinh và phụ huynh đăng nhập bằng tài khoản cô giáo đã phát.">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field
          label="Tên đăng nhập"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Ví dụ: An2026"
          hint="Viết hoa, viết thường, có dấu hay không đều được."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <PasswordField
          label="Mật khẩu"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <FormError message={error} />
        <button type="submit" className="btn btn-primary text-lg" disabled={busy || !username || !password}>
          {busy ? "Đang vào lớp…" : "Vào lớp"}
        </button>
        <p className="text-center text-[0.95rem] text-ink-soft">Quên mật khẩu? Con nhờ cô giáo đặt lại nhé.</p>
      </form>
      <p className="mt-6 text-center text-[0.95rem]">
        <Link href="/giao-vien/" className="text-blue-ink">
          Tôi là giáo viên
        </Link>
      </p>
    </AuthCard>
  );
}
