"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { DEFAULT_STUDENT_PASSWORD, type Me } from "@lhhp/shared";
import { AuthCard } from "@/components/auth-card";
import { PasswordField } from "@/components/password-input";
import { FormError, Loading } from "@/components/ui";
import { post } from "@/lib/api";
import { firstName } from "@/lib/format";
import { nextPath, useSession } from "@/lib/session";

export default function ChangePassword() {
  const router = useRouter();
  const { me, loading, setMe } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && me?.role !== "student") router.replace("/dang-nhap/");
  }, [loading, me, router]);

  if (me?.role !== "student") return <Loading />;
  // Signed in on the class's shared Abc12345 (brief 6): they have just typed it, so it isn't asked again.
  const firstTime = me.mustChangePassword;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setError(null);
    if (next !== again) {
      setErrors({ again: "Hai lần nhập chưa giống nhau." });
      return;
    }
    setBusy(true);
    const r = await post<{ me: Me }>("/api/auth/password", {
      currentPassword: firstTime ? DEFAULT_STUDENT_PASSWORD : current,
      newPassword: next,
    });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      if (!r.fields) setError(r.message);
      return;
    }
    setMe(r.data.me);
    router.replace(nextPath("/hoc-sinh/"));
  }

  return (
    <AuthCard
      emoji="🔑"
      title={firstTime ? "Đặt mật khẩu riêng" : "Đổi mật khẩu"}
      intro={
        firstTime
          ? `Chào gia đình ${firstName(me.fullName)}! Cả lớp đang dùng chung mật khẩu ${DEFAULT_STUDENT_PASSWORD}, nên lần đầu vào lớp nhà mình đặt một mật khẩu riêng nhé. Cô giáo vẫn xem được, để khi nhà mình quên thì cô nhắc lại.`
          : `Mật khẩu mới dùng cho cả ${firstName(me.fullName)} và bố mẹ. Cô giáo vẫn xem được, để khi nhà mình quên thì cô nhắc lại.`
      }
    >
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {firstTime ? null : (
          <PasswordField
            label="Mật khẩu hiện tại"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            error={errors.currentPassword}
            required
          />
        )}
        <PasswordField
          label="Mật khẩu mới"
          autoComplete="new-password"
          hint="Ít nhất 6 ký tự. Bố mẹ nhớ ghi lại giúp con nhé."
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={errors.newPassword}
          required
        />
        <PasswordField
          label="Nhập lại mật khẩu mới"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          error={errors.again}
          required
        />
        <FormError message={error} />
        <button type="submit" className="btn btn-primary text-lg" disabled={busy || (!firstTime && !current) || !next || !again}>
          {busy ? "Đang lưu…" : firstTime ? "Lưu và vào lớp" : "Lưu mật khẩu mới"}
        </button>
        {firstTime ? null : (
          <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
            Quay lại
          </button>
        )}
      </form>
    </AuthCard>
  );
}
