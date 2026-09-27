import Link from "next/link";
import { APP_NAME } from "@lhhp/shared";
import { cn } from "@/lib/utils";

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 no-underline", className)}>
      <span aria-hidden className="grid h-10 w-10 place-items-center rounded-2xl bg-pink text-2xl shadow-[0_3px_0_#f06d9e]">
        🌸
      </span>
      <span className="font-display text-[1.25rem] font-extrabold leading-none text-pink-ink">{APP_NAME}</span>
    </Link>
  );
}
