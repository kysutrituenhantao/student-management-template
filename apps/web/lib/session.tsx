"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Me, StudentMe, TeacherMe } from "@lhhp/shared";
import { SIGNED_OUT_EVENT, api, post } from "./api";

interface SessionState {
  me: Me | null;
  loading: boolean;
  setMe(me: Me | null): void;
  refresh(): Promise<Me | null>;
  logout(): Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * Set by "Đăng xuất". A deliberate sign-out must not carry a return path: on a shared family phone the next person to
 * sign in may be a sibling, who should land on their own home, not on the page the last child left open.
 */
let signedOutOnPurpose = false;

/** Unsent task drafts are kept under this prefix, per child. */
export const DRAFT_PREFIX = "lhhp-draft-";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const r = await api<{ me: Me | null }>("/api/auth/me");
    const next = r.ok ? r.data.me : null;
    setMe(next);
    setLoading(false);
    return next;
  }, []);

  const logout = useCallback(async () => {
    await post("/api/auth/logout");
    signedOutOnPurpose = true;
    try {
      // On a shared family phone the next person may be a sibling: leave nothing of this child's behind.
      for (const key of Object.keys(localStorage)) if (key.startsWith(DRAFT_PREFIX)) localStorage.removeItem(key);
    } catch {
      // Private mode: there was nothing stored anyway.
    }
    setMe(null);
  }, []);

  const setUser = useCallback((next: Me | null) => {
    if (next) signedOutOnPurpose = false;
    setMe(next);
  }, []);

  useEffect(() => {
    void refresh();
    const onSignedOut = () => void refresh();
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, [refresh]);

  return <SessionContext.Provider value={{ me, loading, setMe: setUser, refresh, logout }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}

/** `?next=` pointing back at this page, unless the user just signed out on purpose. */
function returnHere(): string {
  return signedOutOnPurpose ? "" : `?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

/** A `?next=` target is followed only if it's a path inside the area being signed in to. */
export function nextPath(fallback: string, area = fallback): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith(area) && !next.startsWith("//") ? next : fallback;
}

/** The signed-in teacher, or a redirect to the teacher sign-in page (and back here afterwards). */
export function useTeacher(): TeacherMe | null {
  const { me, loading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!loading && me?.role !== "teacher") router.replace(`/giao-vien/${returnHere()}`);
  }, [loading, me, router]);
  return me?.role === "teacher" ? me : null;
}

/**
 * The signed-in student, or a redirect to sign in — or, on the class's shared first password, to choosing their own
 * (brief 6), since the API opens nothing else until they have.
 */
export function useStudent(): StudentMe | null {
  const { me, loading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (me?.role !== "student") router.replace(`/dang-nhap/${returnHere()}`);
    else if (me.mustChangePassword) router.replace(`/doi-mat-khau/${returnHere()}`);
  }, [loading, me, router]);
  return me?.role === "student" && !me.mustChangePassword ? me : null;
}
