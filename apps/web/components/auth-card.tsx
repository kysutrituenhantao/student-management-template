import type { ReactNode } from "react";
import { Brand } from "./brand";

export function AuthCard({ emoji, title, intro, children }: { emoji: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <Brand />
      <div className="sticker group-1 mt-10 p-6 sm:p-8">
        <p aria-hidden className="text-5xl">
          {emoji}
        </p>
        <h1 className="mt-2 text-[2rem] font-extrabold">{title}</h1>
        {intro ? <div className="mt-1 text-ink-soft">{intro}</div> : null}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
