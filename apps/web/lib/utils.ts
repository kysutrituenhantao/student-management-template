import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Tổ 1 → "group-1"; no group → "group-0". Drives the sticker's edge colour. */
export const groupClass = (group: number | null) => `group-${group ?? 0}`;
