"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import {
  AVATAR_EMOJIS,
  ATTENDANCE_INFO,
  HONOUR_INFO,
  IMAGE_LIMITS,
  type BadgeDef,
  type CompetitionEntry,
  type EarnedBadge,
  type FamilyHonourBoard,
  type Honour,
  type Me,
  type Message,
  type StudentHome,
  type StudentMe,
  type StudentAttendance,
  type StudentReport,
  type SchoolRanking,
  type Task,
} from "@lhhp/shared";
import { Brand } from "@/components/brand";
import { CompetitionChart } from "@/components/competition-chart";
import { WeekMonthPicker } from "@/components/period-picker";
import { ClassBoard } from "@/components/board";
import { MangNonClass } from "@/components/mang-non";
import { Chat } from "@/components/chat";
import { TaskGrid } from "@/components/task-tile";
import { Plant } from "@/components/plant";
import { WorksGallery } from "@/components/works";
import { Leaderboard } from "@/components/leaderboard";
import { ReportView } from "@/components/report-view";
import { Avatar, Empty, Loading, LoadError, toast } from "@/components/ui";
import { del, post, put } from "@/lib/api";
import { firstName, formatDate, formatLocalDate, signed, timeAgo, todayLocal } from "@/lib/format";
import { resizeImage } from "@/lib/image";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "trang-chu", label: "Trang chủ", emoji: "🏠" },
  { id: "bang-tin", label: "Bảng tin", emoji: "📌" },
  { id: "nhiem-vu", label: "Nhiệm vụ", emoji: "📚" },
  { id: "ket-qua", label: "Kết quả", emoji: "📊" },
  // Brief 12: Thi đua in place of Huy hiệu; the child's badges are its third little tab.
  { id: "thi-dua", label: "Thi đua", emoji: "🏆" },
  { id: "nhan-co", label: "Nhắn cô", emoji: "💌" },
] as const;
/** Two more screens have no room in the bar; the home screen and the account page link to them. */
const EXTRA_TABS = ["tai-khoan", "ho-so"] as const;
type TabId = (typeof TABS)[number]["id"] | (typeof EXTRA_TABS)[number];

export function StudentApp({ me }: { me: StudentMe }) {
  const params = useSearchParams();
  const router = useRouter();
  const asked = params.get("tab");
  // An old link to Huy hiệu opens Thi đua on the child's badges.
  const tab = (asked === "huy-hieu" ? "thi-dua" : (TABS.find((t) => t.id === asked)?.id ?? EXTRA_TABS.find((t) => t === asked) ?? "trang-chu")) as TabId;
  const home = useApi<StudentHome>("/api/s/home");
  const goTo = useCallback((t: TabId) => router.push(t === "trang-chu" ? "/hoc-sinh/" : `/hoc-sinh/?tab=${t}`, { scroll: false }), [router]);

  return (
    <div className="pb-24 md:pb-10">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2 sm:px-5">
          <Brand href="/hoc-sinh/" className="hidden sm:inline-flex" />
          <Link href="/hoc-sinh/" aria-label="Trang chủ" className="grid h-10 w-10 place-items-center rounded-2xl bg-pink text-2xl shadow-[0_3px_0_#f06d9e] sm:hidden">
            🌸
          </Link>
          <nav aria-label="Các mục" className="ml-2 hidden md:block">
            <div role="tablist" className="tabbar !p-0">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => goTo(t.id)}>
                  <span aria-hidden>{t.emoji}</span> {t.label}
                  {t.id === "nhan-co" && home.data?.unreadMessages ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-pen px-1 text-xs font-bold text-white">{home.data.unreadMessages}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </nav>
          <button type="button" onClick={() => goTo("tai-khoan")} className="ml-auto flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-pink-soft" aria-label="Tài khoản của con">
            <Avatar emoji={me.avatarEmoji} url={me.avatarUrl} name={me.fullName} size={38} />
            <span className="text-left leading-tight">
              <span className="block font-bold">{firstName(me.fullName)}</span>
              <span className="block text-xs text-ink-soft">{me.className}</span>
            </span>
          </button>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-3 pt-5 sm:px-5">
        {home.error ? (
          <LoadError message={home.error} onRetry={home.reload} />
        ) : !home.data ? (
          <Loading />
        ) : tab === "trang-chu" ? (
          <HomeView home={home.data} goTo={goTo} />
        ) : tab === "bang-tin" ? (
          <ClassBoard role="family" />
        ) : tab === "nhiem-vu" ? (
          <TasksView />
        ) : tab === "ho-so" ? (
          <MangNonClass meId={me.id} />
        ) : tab === "ket-qua" ? (
          <ResultsView home={home.data} />
        ) : tab === "thi-dua" ? (
          <ThiDuaView me={me} initial={asked === "huy-hieu" ? "huy-hieu" : "ket-qua-thi-dua"} />
        ) : tab === "nhan-co" ? (
          <MessagesView teacher={home.data.teacherName} onRead={home.reload} />
        ) : (
          <AccountView me={me} />
        )}
      </main>

      <nav aria-label="Các mục" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => goTo(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn("relative flex flex-col items-center gap-0.5 px-0.5 py-2 text-[0.68rem] font-semibold", tab === t.id ? "text-pink-ink" : "text-ink-soft")}
            >
              <span className={cn("grid h-8 w-11 place-items-center rounded-full text-xl", tab === t.id && "bg-pink-soft")} aria-hidden>
                {t.emoji}
              </span>
              {t.label}
              {t.id === "nhan-co" && home.data?.unreadMessages ? <span className="absolute right-4 top-1 h-2.5 w-2.5 rounded-full bg-red-pen" aria-label="Có tin nhắn mới" /> : null}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// Home -----------------------------------------------------------------------------------

function HomeView({ home, goTo }: { home: StudentHome; goTo(t: TabId): void }) {
  const p = home.profile;
  const lvl = p.level;
  const todo = home.openTasks;
  return (
    <div className="grid gap-6">
      <section className={cn("sticker grid gap-4 p-5 sm:grid-cols-[auto_auto_1fr] sm:items-center sm:p-6", `group-${p.student.group ?? 1}`)}>
        <Avatar emoji={home.me.avatarEmoji} url={home.me.avatarUrl} name={home.me.fullName} size={96} className="mx-auto ring-8 ring-gold-soft sm:mx-0" />
        {/* The child's own plant, as big as their face: it is the thing the drops are for. */}
        <Plant level={lvl.level} size={104} className="mx-auto sm:mx-0" />
        <div>
          <p className="red-pen text-lg">Chào {firstName(home.me.fullName)}!</p>
          <h1 className="font-display text-[2rem] font-extrabold leading-tight">Cây của con: {lvl.name}</h1>
          <div className="progress mt-2 max-w-md" aria-label={`Cây lớn được: ${Math.round(lvl.progress * 100)}%`}>
            <span style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {/* Past "Quả chín" the picture stops changing and only the level climbs, so the goal is the number. */}
            {lvl.next && lvl.next.name !== lvl.name
              ? `Còn ${lvl.toNext} giọt nước nữa là cây của con thành ${lvl.next.name}`
              : `Còn ${lvl.toNext} giọt nước nữa là cây của con lên Lv ${lvl.next?.level ?? lvl.level}`}
          </p>
          {/* Brief 17: "thể hiện rõ tổng cộng số giọt nước và số giọt nước tuần này" — the same two numbers as Thi đua. */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div role="group" aria-label="Tổng cộng" className="rounded-2xl bg-gold px-3 py-2">
              <p className="text-sm font-bold">💧 Tổng cộng</p>
              <p className="leading-none">
                <span data-testid="drops" className="font-display text-[2rem] font-extrabold">
                  {p.student.points}
                </span>{" "}
                <span className="font-semibold">giọt nước</span>
              </p>
            </div>
            <div role="group" aria-label="Tuần này" className="rounded-2xl bg-pink-soft px-3 py-2 text-pink-ink">
              <p className="text-sm font-bold">📅 Tuần này</p>
              <p className="leading-none">
                <span data-testid="drops" className="font-display text-[2rem] font-extrabold">
                  {p.student.weekPoints}
                </span>{" "}
                <span className="font-semibold">giọt nước</span>
              </p>
            </div>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            <li className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-line">Lv {lvl.level}</li>
            {p.rank ? <li className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-line">🏆 Hạng {p.rank} tuần này</li> : null}
          </ul>
        </div>
      </section>

      <nav aria-label="Các mục khác của lớp" className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => goTo("bang-tin")} className="sticker group-2 flex items-center gap-3 p-4 text-left">
          <span className="text-3xl" aria-hidden>
            📌
          </span>
          <span>
            <span className="block font-display text-lg font-extrabold leading-tight">Bảng tin của lớp</span>
            <span className="block text-sm text-ink-soft">Ảnh hoạt động, việc ở nhà và lời nhắn của cô.</span>
          </span>
        </button>
        <button type="button" onClick={() => goTo("ho-so")} className="sticker group-4 flex items-center gap-3 p-4 text-left">
          <span className="text-3xl" aria-hidden>
            🌱
          </span>
          <span>
            <span className="block font-display text-lg font-extrabold leading-tight">Hồ sơ Măng non</span>
            <span className="block text-sm text-ink-soft">Trang của con và của các bạn trong lớp.</span>
          </span>
        </button>
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-6">
          <section className="paper p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-extrabold">📚 Cô giao việc</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => goTo("nhiem-vu")}>
                Xem tất cả
              </button>
            </div>
            {todo.length === 0 ? (
              <p className="mt-2 text-ink-soft">Hôm nay cô chưa giao việc gì. 🎉</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {todo.map((t) => (
                  <TaskRow key={t.id} t={t} />
                ))}
              </ul>
            )}
          </section>

          {p.notes.length ? (
            <section className="paper p-4">
              <h2 className="text-xl font-extrabold">✍️ Lời phê của cô</h2>
              <ul className="mt-2 grid gap-2">
                {p.notes.slice(0, 3).map((n) => (
                  <li key={n.id} className="rounded-xl bg-page px-3 py-2">
                    <p className="red-pen whitespace-pre-wrap text-[1.12rem]">{n.body}</p>
                    <p className="text-right text-xs text-ink-soft">{formatDate(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {home.announcements.length ? (
            <section className="paper p-4">
              <h2 className="text-xl font-extrabold">📣 Thông báo của lớp</h2>
              <ul className="mt-2 grid gap-3">
                {home.announcements.map((a) => (
                  <li key={a.id} className={cn("rounded-xl px-3 py-2", a.pinned ? "bg-gold-soft" : "bg-page")}>
                    <p className="font-bold">
                      {a.pinned ? "📌 " : ""}
                      {a.title}
                    </p>
                    {a.body ? <p className="whitespace-pre-wrap text-[0.95rem]">{a.body}</p> : null}
                    <p className="text-xs text-ink-soft">{formatDate(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="paper p-4">
            <h2 className="text-xl font-extrabold">💧 Giọt nước gần đây</h2>
            {home.recent.length === 0 ? (
              <p className="mt-2 text-ink-soft">Chưa có giọt nước nào. Cố gắng lên con nhé!</p>
            ) : (
              <ul className="mt-2 grid gap-1.5">
                {home.recent.map((e) => (
                  <li key={e.id} className="flex items-baseline gap-2">
                    <span className={cn("w-9 text-right font-display text-lg font-extrabold", e.delta > 0 ? "text-gold-ink" : "text-blue-ink")}>{signed(e.delta)}</span>
                    <span className="flex-1">
                      {e.emoji} {e.reason}
                    </span>
                    <span className="text-xs text-ink-soft">{timeAgo(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="grid gap-6">
          <section className="chalkboard px-4 py-4">
            <p className="font-display text-xl font-bold">{home.className}</p>
            {home.classMotto ? <p className="mt-1 font-hand text-[#dff3e8]">{home.classMotto}</p> : null}
            <p className="mt-2 text-sm text-[#cfe8da]">
              🧑‍🏫 {home.teacherName}
              {home.schoolWeek > 0 ? `, tuần học thứ ${home.schoolWeek}` : ""}
            </p>
          </section>
          {home.weekTop ? <Leaderboard rows={home.weekTop} /> : null}
          {home.unreadMessages ? (
            <button type="button" onClick={() => goTo("nhan-co")} className="sticker group-1 p-4 text-left">
              <p className="font-bold">💌 Cô có {home.unreadMessages} tin nhắn mới cho gia đình</p>
              <p className="text-sm text-ink-soft">Bấm để đọc</p>
            </button>
          ) : null}
          {p.badges.length ? (
            <section className="paper p-4">
              <h2 className="text-xl font-extrabold">🏅 Huy hiệu của con</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {p.badges.map((b) => (
                  <li key={b.key} className="grid w-20 place-items-center text-center" title={b.description}>
                    <span className="text-3xl" aria-hidden>
                      {b.emoji}
                    </span>
                    <span className="text-xs font-semibold leading-tight">{b.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/** One notice, whole: what the teacher wrote is what a parent reads on the phone. */
function TaskRow({ t }: { t: Task }) {
  const late = t.dueDate !== null && t.dueDate < todayLocal();
  return (
    <li className="rounded-2xl border-2 border-line bg-white px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-soft text-2xl" aria-hidden>
          📚
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{t.title}</p>
          <p className="flex flex-wrap gap-x-3 text-sm text-ink-soft">
            {t.dueDate ? <span className={cn(late && "text-red-pen")}>Hạn {formatLocalDate(t.dueDate)}</span> : null}
          </p>
        </div>
      </div>
      {t.instructions ? <p className="mt-2 whitespace-pre-wrap text-[1.02rem] leading-snug">{t.instructions}</p> : null}
    </li>
  );
}

// Tasks ------------------------------------------------------------------------------------

function TasksView() {
  const { data, error, reload } = useApi<Task[]>("/api/s/tasks");
  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const today = todayLocal();
  const open = data.filter((t) => t.status === "published" && (!t.dueDate || t.dueDate >= today));
  const past = data.filter((t) => !open.includes(t));
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-[2rem] font-extrabold">📚 Nhiệm vụ</h1>
        <p className="text-ink-soft">Những việc cô giao cho cả lớp. Con làm vào vở như bình thường nhé.</p>
      </div>
      {data.length === 0 ? (
        <Empty emoji="🌈" title="Cô chưa giao nhiệm vụ nào">
          Khi cô giao việc, nội dung sẽ hiện ở đây.
        </Empty>
      ) : null}
      {open.length ? (
        <section>
          <h2 className="mb-2 text-xl font-extrabold">Cần làm</h2>
          <TaskGrid tasks={open} label="Các nhiệm vụ" />
        </section>
      ) : null}
      {past.length ? (
        <section>
          <h2 className="mb-2 text-xl font-extrabold">Đã qua</h2>
          <div className="opacity-80">
            <TaskGrid tasks={past} label="Nhiệm vụ đã qua" />
          </div>
        </section>
      ) : null}
    </div>
  );
}

// Results ----------------------------------------------------------------------------------

function ResultsView({ home }: { home: StudentHome }) {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-[2rem] font-extrabold">📊 Kết quả của {firstName(home.me.fullName)}</h1>
        <p className="text-ink-soft">Giọt nước, chuyên cần, nhiệm vụ và lời phê của cô theo tuần, tháng và học kỳ.</p>
      </div>
      {/* "Phần này sẽ hiển thị ở giao diện của PH trong mục kết quả — vẫn dùng tên SẢN PHẨM CỦA EM" (brief 4, item 5). */}
      <WorksGallery />
      <FamilyAttendance />
      {/* The honours moved to Thi đua → Vinh danh (brief 12). */}
      {home.profile.notes.length ? (
        <section className="paper p-4">
          <h2 className="text-xl font-extrabold">✍️ Nhận xét của cô</h2>
          <ul className="mt-2 grid gap-2">
            {home.profile.notes.map((n) => (
              <li key={n.id} className="rounded-xl bg-page px-3 py-2">
                <p className="red-pen whitespace-pre-wrap text-[1.12rem]">{n.body}</p>
                <p className="text-right text-xs text-ink-soft">{formatDate(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ReportView<StudentReport> base="/api/s/report">
        {(r) => (
          <div className="grid gap-5">
            <section className="paper p-4">
              <h3 className="font-display text-lg font-bold">Các lần nhận giọt nước</h3>
              {r.events.length === 0 ? (
                <p className="mt-1 text-sm text-ink-soft">Chưa có giọt nước nào trong khoảng này.</p>
              ) : (
                <ul className="mt-2 grid gap-1.5 text-[0.95rem]">
                  {r.events.map((e) => (
                    <li key={e.id} className="flex gap-2">
                      <span className={cn("w-8 text-right font-bold", e.delta > 0 ? "text-gold-ink" : "text-blue-ink")}>{signed(e.delta)}</span>
                      <span className="flex-1">
                        {e.emoji} {e.reason}
                      </span>
                      <span className="text-xs text-ink-soft">{timeAgo(e.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </ReportView>
    </div>
  );
}

// Thi đua ----------------------------------------------------------------------------------

const THI_DUA_TABS = [
  { id: "ket-qua-thi-dua", label: "Kết quả thi đua", emoji: "📊" },
  { id: "vinh-danh", label: "Vinh danh", emoji: "🌟" },
  { id: "huy-hieu", label: "Huy hiệu", emoji: "🏅" },
] as const;
type ThiDuaTab = (typeof THI_DUA_TABS)[number]["id"];

/**
 * Thi đua on the family's side, in place of Huy hiệu (brief 12): "hiển thị đủ tab 1 và tab 2. Tab 3 chỉ hiện huy hiệu
 * của cá nhân. Điều này nhằm cho PH thấy vị trí của con mình trong tuần qua… đồng thời biết đc vị trí của lớp trong
 * trường trong tuần qua."
 */
function ThiDuaView({ me, initial }: { me: StudentMe; initial: ThiDuaTab }) {
  // Brief 18: "chỉ hiển thị kết quả tuần đc giáo viên nhập. Nếu GV chưa nhập thì k hiển thị" — until she has entered
  // a week, the school's results are not a tab at all.
  const entered = useApi<CompetitionEntry[]>("/api/s/competition/entered");
  const hasResults = (entered.data?.length ?? 0) > 0;
  const tabs = THI_DUA_TABS.filter((t) => t.id !== "ket-qua-thi-dua" || hasResults);
  const [chosen, setChosen] = useState<ThiDuaTab | null>(null);
  const sub: ThiDuaTab = chosen ?? (initial === "ket-qua-thi-dua" && !hasResults ? "vinh-danh" : initial);
  if (!entered.data && !entered.error) return <Loading />;
  return (
    <div className="grid gap-5">
      <h1 className="text-[2rem] font-extrabold">🏆 Thi đua</h1>
      <div role="tablist" aria-label="Các mục thi đua" className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={sub === t.id} className="chip !min-h-[44px]" onClick={() => setChosen(t.id)}>
            <span aria-hidden>{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>
      {sub === "ket-qua-thi-dua" && hasResults ? (
        <FamilyCompetition entries={entered.data!} />
      ) : sub === "huy-hieu" ? (
        <FamilyBadges />
      ) : (
        <FamilyRank me={me} />
      )}
    </div>
  );
}

/**
 * Where the class stands in the school, read-only, for the weeks and months she has entered and no others (brief 18),
 * newest first and open on the newest.
 */
function FamilyCompetition({ entries }: { entries: CompetitionEntry[] }) {
  const [pick, setPick] = useState(0);
  const e = entries[Math.min(pick, entries.length - 1)]!;
  const { data, error, reload } = useApi<SchoolRanking>(`/api/s/competition?period=${e.period}&date=${e.periodKey}`);
  return (
    <section className="paper grid gap-4 p-4">
      <p className="text-ink-soft">Lớp mình đứng thứ mấy trong trường? Cột màu đỏ là lớp mình.</p>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Kết quả của</span>
        <select className="input font-semibold" aria-label="Chọn tuần" value={pick} onChange={(ev) => setPick(Number(ev.target.value))}>
          {entries.map((x, i) => (
            <option key={`${x.period}-${x.periodKey}`} value={i}>
              {x.periodLabel}
            </option>
          ))}
        </select>
      </label>
      {error ? <LoadError message={error} onRetry={reload} /> : !data ? <Loading /> : <CompetitionChart ranking={data} />}
    </section>
  );
}

/**
 * Where the child stands in the class, week by week, and the honours. Brief 15: "hiển thị theo tuần. Ví dụ: Nguyễn
 * Minh Anh 123 giọt nước Tuần này 20 giọt nước" — the total and the week, side by side, for every child shown.
 */
function FamilyRank({ me }: { me: StudentMe }) {
  const [date, setDate] = useState(todayLocal());
  const { data, error, reload } = useApi<FamilyHonourBoard>(`/api/s/honours/board?period=week&date=${date}`);
  const name = firstName(me.fullName);
  return (
    <div className="grid gap-5">
      <section className="paper grid gap-4 p-4">
        <WeekMonthPicker kind="week" onKind={() => undefined} date={date} onDate={setDate} label={data?.periodLabel} weekOnly />
        {error ? (
          <LoadError message={error} onRetry={reload} />
        ) : !data ? (
          <Loading />
        ) : (
          <>
            <div className="sticker group-3 flex items-center gap-3 p-4">
              <span className="text-4xl" aria-hidden>
                {data.me.rank === 1 ? "🥇" : data.me.rank === 2 ? "🥈" : data.me.rank === 3 ? "🥉" : "🌱"}
              </span>
              <div>
                {data.me.rank ? (
                  <p className="text-lg">
                    <strong>{name}</strong> đứng thứ <strong className="text-2xl">{data.me.rank}/{data.me.of}</strong> trong lớp
                  </p>
                ) : (
                  <p className="text-lg">
                    Tuần này <strong>{name}</strong> chưa có giọt nước nào. Cố lên con nhé!
                  </p>
                )}
                <p className="mt-0.5 font-semibold">💧 Tổng cộng {data.me.total} giọt nước</p>
                <p className="font-semibold text-pink-ink">Tuần này {data.me.points} giọt nước</p>
              </div>
            </div>
            {data.leaders && data.leaders.length ? (
              <div>
                <h2 className="font-display text-lg font-bold">Top 10 của lớp tuần này</h2>
                <ol aria-label="Top 10 của lớp" className="mt-2 grid gap-1.5">
                  {data.leaders.map((l) => {
                    const rank = 1 + data.leaders!.filter((x) => x.points > l.points).length;
                    return (
                      <li
                        key={l.studentId}
                        className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5", l.studentId === me.id && "bg-pink-soft font-bold")}
                      >
                        <span className="w-7 shrink-0 text-right tabular-nums">{rank}.</span>
                        <Avatar emoji={l.avatarEmoji} url={l.avatarUrl} name={l.fullName} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{l.fullName}</span>
                          <span className="flex flex-wrap gap-x-3 text-sm font-normal">
                            <span className="text-ink-soft">💧 {l.total} giọt nước</span>
                            <span className="font-semibold text-pink-ink">Tuần này {l.points} giọt nước</span>
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}
          </>
        )}
      </section>
      <FamilyHonours meId={me.id} />
    </div>
  );
}

/** "Tab 3 chỉ hiện huy hiệu của cá nhân": the badges this child has earned, in the teacher's words. */
function FamilyBadges() {
  const { data, error, reload } = useApi<{ all: BadgeDef[]; earned: EarnedBadge[] }>("/api/s/badges");
  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (data.earned.length === 0) {
    return (
      <Empty emoji="🏅" title="Con chưa có huy hiệu nào">
        Chăm ngoan, giúp đỡ bạn bè là sẽ có huy hiệu đầu tiên nhé!
      </Empty>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="text-ink-soft">Con đã có {data.earned.length} huy hiệu.</p>
      <ul aria-label="Huy hiệu của con" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {data.earned.map((b) => (
          <li key={b.key} className="sticker group-3 p-4 text-center">
            <span className="text-4xl" aria-hidden>
              {b.emoji}
            </span>
            <p className="mt-1 font-bold leading-tight">{b.name}</p>
            <p className="text-xs text-ink-soft">{b.description}</p>
            {b.note ? <p className="red-pen mt-1 text-sm">{b.note}</p> : null}
            <p className="mt-1 text-xs text-ink-soft">{formatDate(b.awardedAt)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Messages ---------------------------------------------------------------------------------

function MessagesView({ teacher, onRead }: { teacher: string; onRead(): void }) {
  const { data, setData, error, reload } = useApi<Message[]>("/api/s/messages");
  const loaded = data !== null;
  // Reading the thread marks the teacher's messages read: refresh the unread count once they've loaded.
  useEffect(() => {
    if (loaded) onRead();
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-[2rem] font-extrabold">💌 Nhắn {teacher}</h1>
        <p className="text-ink-soft">Bố mẹ hoặc con nhắn đều được. Chỉ cô giáo đọc được tin nhắn này.</p>
      </div>
      <div className="paper overflow-hidden">
        {error ? (
          <LoadError message={error} onRetry={reload} />
        ) : !data ? (
          <Loading />
        ) : (
          <Chat
            messages={data}
            mine="family"
            placeholder="Ví dụ: Thưa cô, hôm nay con xin nghỉ học vì bị ốm ạ."
            onSend={async (body) => {
              const r = await post<Message>("/api/s/messages", { body });
              if (!r.ok) {
                toast(r.message, "error");
                return false;
              }
              setData((m) => [...(m ?? []), r.data]);
              return true;
            }}
          />
        )}
      </div>
    </div>
  );
}

// Account ----------------------------------------------------------------------------------

/** Chuyên cần, as a family reads it: how many days their child was at school over the period they pick. */
function FamilyAttendance() {
  const [period, setPeriod] = useState<"week" | "month" | "semester" | "year">("month");
  const { data, error } = useApi<StudentAttendance>(`/api/s/attendance?period=${period}`);
  const total = data ? data.coMat + data.diMuon + data.coPhep + data.khongPhep : 0;

  return (
    <section className="paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">📅 Chuyên cần</h2>
        <label className="sr-only" htmlFor="chuyen-can-period">
          Khoảng thời gian
        </label>
        <select id="chuyen-can-period" className="input !h-10 !w-auto !py-0" value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
          <option value="week">Tuần này</option>
          <option value="month">Tháng này</option>
          <option value="semester">Học kỳ</option>
          <option value="year">Năm học</option>
        </select>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-ink-soft">{error}</p>
      ) : !data ? (
        <p className="mt-2 text-sm text-ink-soft">Đang tải…</p>
      ) : total === 0 ? (
        <p className="mt-2 text-ink-soft">Cô chưa điểm danh ngày nào trong {data.period.label.toLowerCase()}.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">{data.period.label} · lớp điểm danh {data.daysTaken} ngày</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {(
              [
                ["co_mat", data.coMat],
                ["di_muon", data.diMuon],
                ["co_phep", data.coPhep],
                ["khong_phep", data.khongPhep],
              ] as const
            ).map(([status, n]) => (
              <div key={status} className="rounded-2xl bg-page py-2">
                <dt className="text-xs text-ink-soft">
                  <span aria-hidden>{ATTENDANCE_INFO[status].emoji} </span>
                  {ATTENDANCE_INFO[status].label}
                </dt>
                <dd className="text-xl font-extrabold">{n}</dd>
              </div>
            ))}
          </dl>
          {data.recent.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {data.recent.slice(0, 14).map((d) => (
                <li
                  key={d.day}
                  className="rounded-full bg-page px-2.5 py-1 text-sm ring-1 ring-line"
                  title={d.note || ATTENDANCE_INFO[d.status].label}
                >
                  <span aria-hidden>{ATTENDANCE_INFO[d.status].emoji} </span>
                  {formatLocalDate(d.day).slice(0, 5)}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-sm text-ink-soft">Mỗi ngày đi học đầy đủ, con được cô tặng 1 💧.</p>
        </>
      )}
    </section>
  );
}

/** Vinh danh: the child's own honours first, then the friends' — a class celebrates together. */
function FamilyHonours({ meId }: { meId: number }) {
  const { data } = useApi<Honour[]>("/api/s/honours");
  if (!data || data.length === 0) return null;
  const mine = data.filter((h) => h.studentId === meId);
  const others = data.filter((h) => h.studentId !== meId).slice(0, 12);

  return (
    <section className="paper p-4">
      <h2 className="text-xl font-extrabold">🏆 Vinh danh</h2>
      {mine.length ? (
        <ul className="mt-2 grid gap-2">
          {mine.map((h) => (
            <li key={h.id} className="sticker group-3 flex items-center gap-3 p-3">
              <span className="text-3xl" aria-hidden>
                {HONOUR_INFO[h.period].emoji}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-extrabold leading-tight">{h.title}</span>
                <span className="block text-sm text-ink-soft">
                  {h.periodLabel}
                  {h.note ? ` · ${h.note}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-ink-soft">Con chưa được vinh danh. Cố lên con nhé, cô luôn nhìn thấy cố gắng của con!</p>
      )}
      {others.length ? (
        <>
          <h3 className="mt-4 font-display text-lg font-bold">Các bạn được vinh danh</h3>
          <ul className="mt-2 grid gap-1.5">
            {others.map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-[0.95rem]">
                <Avatar emoji={h.avatarEmoji} url={h.avatarUrl} name={h.fullName} size={28} />
                <span className="min-w-0 flex-1 truncate">{h.fullName}</span>
                <span className="text-ink-soft">
                  {HONOUR_INFO[h.period].emoji} {h.periodLabel}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function AccountView({ me }: { me: StudentMe }) {
  const router = useRouter();
  const { setMe, logout } = useSession();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(f: File) {
    setBusy(true);
    try {
      const dataUrl = await resizeImage(f, IMAGE_LIMITS.avatar);
      const r = await put<{ me: Me }>("/api/s/avatar", { dataUrl });
      if (!r.ok) throw new Error(r.message);
      setMe(r.data.me);
      toast("Đã đổi ảnh đại diện.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Không tải được ảnh.", "error");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <h1 className="text-[2rem] font-extrabold">🙂 Tài khoản của con</h1>
      <section className="sticker group-2 grid gap-4 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar emoji={me.avatarEmoji} url={me.avatarUrl} name={me.fullName} size={96} />
          <div>
            <p className="font-display text-2xl font-extrabold">{me.fullName}</p>
            <p className="text-ink-soft">
              Tên đăng nhập: <strong className="text-ink">{me.username}</strong>
            </p>
            <p className="text-ink-soft">
              {me.className}, {me.teacherName}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => file.current?.click()}>
            {busy ? "Đang tải ảnh…" : "📷 Tải ảnh của con"}
          </button>
          {me.avatarUrl ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                const r = await del<{ me: Me }>("/api/s/avatar");
                if (r.ok) setMe(r.data.me);
              }}
            >
              Dùng sticker thay ảnh
            </button>
          ) : null}
        </div>
        <fieldset>
          <legend className="mb-2 font-semibold">Hoặc chọn sticker</legend>
          <div className="flex flex-wrap gap-1.5">
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={me.avatarEmoji === e}
                aria-label={`Chọn sticker ${e}`}
                className={cn("grid h-11 w-11 place-items-center rounded-xl text-2xl", me.avatarEmoji === e ? "bg-pink-soft ring-2 ring-pink-ink" : "bg-white")}
                onClick={async () => {
                  const r = await put<{ me: Me }>("/api/s/avatar-emoji", { avatarEmoji: e });
                  if (!r.ok) return toast(r.message, "error");
                  setMe(r.data.me);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>
      </section>
      <section className="paper grid gap-3 p-5">
        <Link href="/doi-mat-khau/" className="btn btn-ghost justify-start">
          🔑 Đổi mật khẩu
        </Link>
        <button
          type="button"
          className="btn btn-ghost justify-start text-red-pen"
          onClick={async () => {
            await logout();
            router.replace("/dang-nhap/");
          }}
        >
          <LogOut size={18} /> Đăng xuất
        </button>
      </section>
    </div>
  );
}
