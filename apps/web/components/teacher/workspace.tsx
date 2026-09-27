"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { ClassOverview, ClassSummary, TeacherMe } from "@lhhp/shared";
import { ClassBoard } from "@/components/board";
import { MangNonBook } from "@/components/mang-non";
import { Loading, LoadError } from "@/components/ui";
import { useApi } from "@/lib/use-api";
import { AttendanceTab } from "./attendance-tab";
import { BadgesTab } from "./badges-tab";
import { CompetitionTab } from "./competition-tab";
import { CriteriaTab } from "./criteria-tab";
import { FamilyTab } from "./family-tab";
import { HomeTab } from "./home-tab";
import { HonoursTab } from "./honours-tab";
import { ReportsTab } from "./reports-tab";
import { RewardsTab } from "./rewards-tab";
import { SettingsTab } from "./settings-tab";
import { StudentsTab } from "./students-tab";
import { TasksTab } from "./tasks-tab";
import { TeamsTab } from "./teams-tab";
import { TeacherTopbar } from "./topbar";

/**
 * The toolbar: the ten she chose (brief 4, item 8), in her order —
 *
 *   Trang chủ - Bảng tin – Nhiệm vụ - Hồ sơ măng non – Chuyên cần - Sơ đồ lớp – Báo cáo – Vinh danh – Đổi thưởng – Lời nhắn
 *
 * — on one row (brief 5: "trống nhiều quá, hãy dồn thanh công cụ lên 1 hàng", with "không để thông tin ra khỏi màn
 * hình"). It was once fourteen tabs on a row that scrolled sideways, which is how a family's message went unread for
 * two days, so it still never scrolls: a screen too narrow for one row gets tiles instead (`.toolbar` in globals.css).
 *
 * Two of them open a second little row (item 7: "mục Học sinh chuyển vào hồ sơ măng non, tạo 2 tab nhỏ trong mục
 * gồm: Hồ sơ măng non – Tài khoản học sinh"). Huy hiệu joins Vinh danh the same way — both are how a child is
 * praised. (Brief 12 renamed Vinh danh to Thi đua, with Kết quả thi đua, Vinh danh and Huy hiệu under it.) Cài đặt moves into the menu by her name, and Trò chơi goes altogether: every game is already on
 * Trang chủ under "Gọi ngẫu nhiên" and "Chia nhóm", which is where she stands when she uses them.
 */
const TABS = [
  { id: "trang-chu", label: "Trang chủ", emoji: "🏠", onBar: true },
  { id: "bang-tin", label: "Bảng tin", emoji: "📌", onBar: true },
  { id: "nhiem-vu", label: "Nhiệm vụ", emoji: "📚", onBar: true },
  { id: "ho-so", label: "Hồ sơ Măng non", emoji: "🌱", onBar: true },
  { id: "chuyen-can", label: "Chuyên cần", emoji: "📅", onBar: true },
  { id: "to-so-do", label: "Sơ đồ lớp", emoji: "🪑", onBar: true },
  { id: "bao-cao", label: "Báo cáo", emoji: "📊", onBar: true },
  // Brief 12: "Ở phần vinh danh đổi tên thành Thi đua", its first little tab "Kết quả thi đua".
  { id: "thi-dua", label: "Thi đua", sub: "Kết quả thi đua", subEmoji: "📊", emoji: "🏆", onBar: true },
  { id: "doi-qua", label: "Đổi thưởng", emoji: "🎁", onBar: true },
  { id: "loi-nhan", label: "Lời nhắn", emoji: "💌", onBar: true },
  // Reached through the tab above them, or through the menu.
  { id: "tai-khoan", label: "Tài khoản học sinh", emoji: "🔑", under: "ho-so" },
  { id: "vinh-danh", label: "Vinh danh", emoji: "🌟", under: "thi-dua" },
  { id: "huy-hieu", label: "Huy hiệu", emoji: "🏅", under: "thi-dua" },
  // Brief 7: "Phần đổi thưởng có 3 tab: tab Đổi thưởng; tab Điểm cộng; tab Điểm trừ".
  { id: "diem-cong", label: "Điểm cộng", emoji: "💧", under: "doi-qua" },
  { id: "diem-tru", label: "Điểm trừ", emoji: "🔔", under: "doi-qua" },
  { id: "cai-dat", label: "Cài đặt", emoji: "⚙️" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/** Her old links keep working: she has been in this app for two days and may have one open. */
const RENAMED: Record<string, TabId> = {
  "hoc-sinh": "tai-khoan",
  "phu-huynh": "loi-nhan",
  "tro-choi": "trang-chu",
};

const onBar = TABS.filter((t): t is Extract<(typeof TABS)[number], { onBar: true }> => "onBar" in t);
const subsOf = (parent: TabId) => TABS.filter((t) => ("under" in t ? t.under === parent : t.id === parent));

export function ClassWorkspace({ me }: { me: TeacherMe }) {
  const params = useSearchParams();
  const router = useRouter();
  const id = Number(params.get("id"));
  const asked = params.get("tab") ?? "";
  const tab = (TABS.find((t) => t.id === asked)?.id ?? RENAMED[asked] ?? "trang-chu") as TabId;
  const { data: overview, setData, error, reload } = useApi<ClassOverview>(id ? `/api/t/classes/${id}` : null);
  const { data: classes } = useApi<ClassSummary[]>("/api/t/classes");

  const goTo = useCallback(
    (next: string) => {
      const q = new URLSearchParams({ id: String(id) });
      if (next !== "trang-chu") q.set("tab", next);
      router.push(`/giao-vien/lop/?${q}`, { scroll: false });
    },
    [id, router],
  );
  const setOverview = useCallback((fn: (o: ClassOverview) => ClassOverview) => setData((o) => (o ? fn(o) : o)), [setData]);

  const badge: Partial<Record<TabId, number>> = overview
    ? { "doi-qua": overview.stats.pendingRedemptions, "loi-nhan": overview.stats.unreadMessages }
    : {};

  // Which button on the bar is lit: a sub-tab lights the one it lives under.
  const openTab = TABS.find((t) => t.id === tab);
  const parent = openTab && "under" in openTab ? openTab.under : tab;
  const subs = subsOf(parent as TabId);

  return (
    <>
      <TeacherTopbar me={me} classes={classes ?? undefined} classId={id} />
      <nav aria-label="Các mục của lớp" className="no-print sticky top-[57px] z-30 border-b border-line bg-white/95 backdrop-blur">
        <div role="tablist" aria-label="Thanh công cụ" className="toolbar mx-auto max-w-[1400px] px-2 py-1 sm:px-4">
          {onBar.map((t) => (
            <button key={t.id} type="button" role="tab" className="tool" aria-selected={parent === t.id} onClick={() => goTo(t.id)}>
              <span aria-hidden className="tool-emoji">
                {t.emoji}
              </span>
              {t.label}
              {badge[t.id] ? (
                <span
                  className="tool-badge grid h-5 min-w-5 place-items-center rounded-full bg-red-pen px-1.5 text-xs font-bold text-white"
                  aria-label={`${badge[t.id]} việc mới`}
                >
                  {badge[t.id]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {subs.length > 1 ? (
          <div role="tablist" aria-label="Mục nhỏ" className="mx-auto flex max-w-[1400px] flex-wrap gap-2 border-t border-line px-3 py-2 sm:px-5">
            {subs.map((t) => (
              <button key={t.id} type="button" role="tab" className="chip" aria-selected={tab === t.id} onClick={() => goTo(t.id)}>
                {/* A button on the bar may go by another name in its own little row: Thi đua opens Kết quả thi đua. */}
                <span aria-hidden>{"subEmoji" in t ? t.subEmoji : t.emoji}</span> {"sub" in t ? t.sub : t.label}
              </button>
            ))}
          </div>
        ) : null}
      </nav>
      <main id="main" className="mx-auto max-w-[1400px] px-3 pb-28 pt-5 sm:px-6">
        {!id ? (
          <LoadError message="Địa chỉ này thiếu mã lớp. Cô mở lớp từ danh sách các lớp nhé." />
        ) : error ? (
          <LoadError message={error} onRetry={reload} />
        ) : !overview ? (
          <Loading />
        ) : overview.class.id !== id ? (
          <Loading />
        ) : tab === "trang-chu" ? (
          // Keyed by class: switching class must not carry over an undo bar or a selection from the previous one.
          <HomeTab key={overview.class.id} overview={overview} setOverview={setOverview} reload={reload} goTo={goTo} />
        ) : tab === "bang-tin" ? (
          <ClassBoard key={overview.class.id} role="teacher" classId={overview.class.id} />
        ) : tab === "nhiem-vu" ? (
          <TasksTab overview={overview} reload={reload} />
        ) : tab === "tai-khoan" ? (
          <StudentsTab overview={overview} reload={reload} />
        ) : tab === "ho-so" ? (
          <MangNonBook key={overview.class.id} classId={overview.class.id} teams={overview.class.teams} />
        ) : tab === "chuyen-can" ? (
          <AttendanceTab key={overview.class.id} overview={overview} reload={reload} />
        ) : tab === "thi-dua" ? (
          <CompetitionTab key={overview.class.id} overview={overview} />
        ) : tab === "vinh-danh" ? (
          <HonoursTab key={overview.class.id} overview={overview} />
        ) : tab === "bao-cao" ? (
          <ReportsTab overview={overview} />
        ) : tab === "to-so-do" ? (
          <TeamsTab overview={overview} setOverview={setOverview} />
        ) : tab === "doi-qua" ? (
          <RewardsTab overview={overview} reload={reload} />
        ) : tab === "diem-cong" || tab === "diem-tru" ? (
          <CriteriaTab key={tab} overview={overview} kind={tab === "diem-cong" ? "plus" : "minus"} reload={reload} />
        ) : tab === "huy-hieu" ? (
          <BadgesTab overview={overview} reload={reload} />
        ) : tab === "loi-nhan" ? (
          <FamilyTab overview={overview} reload={reload} />
        ) : (
          <SettingsTab overview={overview} setOverview={setOverview} reload={reload} />
        )}
      </main>
    </>
  );
}
