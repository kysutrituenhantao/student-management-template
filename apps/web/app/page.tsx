"use client";

import Link from "next/link";
import { APP_TAGLINE } from "@lhhp/shared";
import { Brand } from "@/components/brand";
import { useSession } from "@/lib/session";

export default function Home() {
  const { me } = useSession();
  const back = me?.role === "teacher" ? "/giao-vien/" : me?.role === "student" ? "/hoc-sinh/" : null;

  return (
    <main id="main" className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-12 pt-6 sm:px-8">
      <header className="flex items-center justify-between">
        <Brand />
        {back ? (
          <Link href={back} className="btn btn-primary btn-sm">
            Vào lớp
          </Link>
        ) : null}
      </header>

      <section className="chalkboard mt-8 px-6 py-10 text-center sm:px-12 sm:py-14">
        <p className="font-hand text-lg text-[#ffe9a8]">Chào mừng các con đến lớp!</p>
        <h1 className="mt-2 font-display text-[2.6rem] font-extrabold leading-[1.05] sm:text-[3.6rem]">
          Lớp Học Hạnh Phúc
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-hand text-[1.15rem] text-[#dff3e8]">{APP_TAGLINE}</p>
        <p aria-hidden className="mt-5 text-3xl tracking-[0.4em]">
          💧🌸💧
        </p>
      </section>

      <section aria-label="Chọn cách vào lớp" className="mt-10 grid gap-6 sm:grid-cols-2">
        <Link href="/dang-nhap/" className="sticker group-1 block p-6 no-underline hover:-rotate-1 sm:p-8">
          <span aria-hidden className="text-5xl">
            🎒
          </span>
          <h2 className="mt-3 text-[1.9rem] font-extrabold">Học sinh và phụ huynh</h2>
          <p className="mt-1 text-ink-soft">Đăng nhập bằng tài khoản cô phát. Xem vườn hoa, làm nhiệm vụ, nhắn tin với cô.</p>
          <span className="btn btn-primary mt-5">Đăng nhập</span>
        </Link>
        <Link href="/giao-vien/" className="sticker group-2 block p-6 no-underline hover:rotate-1 sm:p-8">
          <span aria-hidden className="text-5xl">
            🍎
          </span>
          <h2 className="mt-3 text-[1.9rem] font-extrabold">Giáo viên</h2>
          <p className="mt-1 text-ink-soft">Quản lý lớp, chấm điểm, giao nhiệm vụ Toán và Tiếng Việt, xem báo cáo.</p>
          <span className="btn btn-ghost mt-5">Vào trang giáo viên</span>
        </Link>
      </section>

      <section className="paper mt-10 grid gap-5 p-6 sm:grid-cols-3">
        {[
          ["💧", "Mỗi cố gắng là một giọt nước", "Cô bấm +💧 ngay trên sticker của con. Đủ giọt nước là cây lớn lên, đổi được quà."],
          ["📚", "Nhiệm vụ Toán, Tiếng Việt", "Làm bài ngay trên điện thoại. App tự chấm, cô nhận xét."],
          ["💌", "Phụ huynh luôn biết", "Xem kết quả theo tuần, tháng, học kỳ và nhắn tin trực tiếp với cô."],
        ].map(([emoji, title, body]) => (
          <div key={title}>
            <p className="text-3xl" aria-hidden>
              {emoji}
            </p>
            <h3 className="mt-1 text-xl font-bold">{title}</h3>
            <p className="mt-1 text-[0.95rem] text-ink-soft">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
