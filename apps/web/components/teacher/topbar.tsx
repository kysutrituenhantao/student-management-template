"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { KeyRound, LogOut, Maximize, Minimize, Volume2, VolumeX } from "lucide-react";
import type { ClassSummary, TeacherMe } from "@lhhp/shared";
import { Brand } from "@/components/brand";
import { PasswordField } from "@/components/password-input";
import { FormError, Sheet, toast } from "@/components/ui";
import { post } from "@/lib/api";
import { useSession } from "@/lib/session";
import { setSound, soundOn } from "@/lib/sound";

export function TeacherTopbar({ me, classes, classId }: { me: TeacherMe; classes?: ClassSummary[]; classId?: number }) {
  const router = useRouter();
  const { logout } = useSession();
  const [sound, setSoundState] = useState(false);
  const [full, setFull] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    setSoundState(soundOn());
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-5">
        <Brand href="/giao-vien/" />
        {classes && classes.length > 0 && classId ? (
          <label className="flex items-center gap-2">
            <span className="sr-only">Chọn lớp</span>
            <select
              className="input !min-h-[40px] !w-auto !rounded-full !py-1 font-semibold"
              value={classId}
              onChange={(e) => router.push(`/giao-vien/lop/?id=${e.target.value}`)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            className="btn btn-ghost btn-sm !px-2.5"
            aria-pressed={sound}
            aria-label={sound ? "Tắt âm thanh" : "Bật âm thanh"}
            title={sound ? "Tắt âm thanh" : "Bật âm thanh"}
            onClick={() => {
              setSound(!sound);
              setSoundState(!sound);
            }}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm hidden !px-2.5 sm:inline-flex"
            aria-label={full ? "Thoát toàn màn hình" : "Toàn màn hình (chiếu lên TV)"}
            title={full ? "Thoát toàn màn hình" : "Toàn màn hình"}
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
          >
            {full ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <div className="relative" ref={menuRef}>
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <span aria-hidden>🧑‍🏫</span>
              <span className="max-w-[9rem] truncate">{me.displayName}</span>
            </button>
            {menu ? (
              <div className="paper absolute right-0 top-full z-50 mt-2 grid w-56 gap-1 p-2 shadow-lg">
                <Link href="/giao-vien/" className="btn btn-ghost btn-sm justify-start !border-0" onClick={() => setMenu(false)}>
                  <span aria-hidden>📚</span> Các lớp của tôi
                </Link>
                {/* The toolbar is the ten she asked for (brief 4, item 8); Cài đặt lives here instead. */}
                {classId ? (
                  <Link
                    href={`/giao-vien/lop/?id=${classId}&tab=cai-dat`}
                    className="btn btn-ghost btn-sm justify-start !border-0"
                    onClick={() => setMenu(false)}
                  >
                    <span aria-hidden>⚙️</span> Cài đặt lớp
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm justify-start !border-0"
                  onClick={() => {
                    setMenu(false);
                    setPwOpen(true);
                  }}
                >
                  <KeyRound size={16} /> Đổi mật khẩu
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm justify-start !border-0 text-red-pen"
                  onClick={async () => {
                    await logout();
                    router.replace("/giao-vien/");
                  }}
                >
                  <LogOut size={16} /> Đăng xuất
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <TeacherPasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
    </header>
  );
}

function TeacherPasswordSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  // Never reopen holding what was typed last time.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCurrent("");
      setNext("");
      setErrors({});
      setError(null);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Đổi mật khẩu">
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErrors({});
          setError(null);
          const r = await post("/api/auth/password", { currentPassword: current, newPassword: next });
          setBusy(false);
          if (!r.ok) {
            setErrors(r.fields ?? {});
            if (!r.fields) setError(r.message);
            return;
          }
          toast("Đã đổi mật khẩu.");
          setCurrent("");
          setNext("");
          onClose();
        }}
      >
        <PasswordField label="Mật khẩu hiện tại" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.currentPassword} autoComplete="current-password" />
        <PasswordField label="Mật khẩu mới" hint="Ít nhất 8 ký tự." value={next} onChange={(e) => setNext(e.target.value)} error={errors.newPassword} autoComplete="new-password" />
        <FormError message={error} />
        <button className="btn btn-primary" disabled={busy || !current || !next}>
          Lưu mật khẩu mới
        </button>
      </form>
    </Sheet>
  );
}
