"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { APP_NAME, type AccountSlip, type ClassOverview } from "@lhhp/shared";
import { Loading, LoadError } from "@/components/ui";
import { useTeacher } from "@/lib/session";
import { useApi } from "@/lib/use-api";

/** One slip per child, to cut out and send home: where to go, the username, the first password. */
function Slips() {
  const me = useTeacher();
  const id = Number(useSearchParams().get("id"));
  const { data, error, reload } = useApi<ClassOverview>(me && id ? `/api/t/classes/${id}` : null);
  const slips = useApi<AccountSlip[]>(me && id ? `/api/t/classes/${id}/accounts` : null);
  if (!me) return <Loading />;
  if (error || slips.error) return <LoadError message={(error ?? slips.error)!} onRetry={reload} />;
  if (!data || !slips.data) return <Loading />;
  const site = typeof window === "undefined" ? "" : window.location.host;

  return (
    <main id="main" className="mx-auto max-w-[900px] bg-white px-4 py-6 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-extrabold">Phiếu tài khoản lớp {data.class.name}</h1>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          In phiếu
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-3 print:gap-2">
        {slips.data.map((s) => (
          <li key={s.id} className="break-inside-avoid rounded-xl border-2 border-dashed border-[#c9b8d8] p-4 print:rounded-none">
            <p className="text-sm font-semibold text-pink-ink">🌸 {APP_NAME}</p>
            <p className="mt-1 font-display text-xl font-extrabold leading-tight">{s.fullName}</p>
            <p className="text-sm text-ink-soft">Lớp {data.class.name}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-[0.95rem]">
              <dt>Trang web:</dt>
              <dd className="font-semibold">{site}</dd>
              <dt>Tên đăng nhập:</dt>
              <dd className="text-lg font-bold">{s.username}</dd>
              <dt>Mật khẩu:</dt>
              <dd className="text-lg font-bold tracking-wider">{s.password}</dd>
            </dl>
            <p className="mt-2 text-xs text-ink-soft">
              {s.chosenByChild
                ? "Mật khẩu gia đình mình đã tự đặt. Quên thì nhắn cô, cô xem lại giúp."
                : "Lần đầu vào lớp, gia đình đặt một mật khẩu riêng. Quên thì nhắn cô, cô xem lại giúp."}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function PrintSlips() {
  return (
    <Suspense fallback={<Loading />}>
      <Slips />
    </Suspense>
  );
}
