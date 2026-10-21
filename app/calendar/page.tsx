"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Profile, Group, ExemptDay } from "@/types";

function getTodayKST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function formatDateKR(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}월 ${d}일`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getWeekDates(): string[] {
  const today = getTodayKST();
  const [ty, tm, td] = today.split("-").map(Number);
  const date = new Date(ty, tm - 1, td);
  // 일요일 기준 시작 (월간 뷰와 동일한 기준)
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

function getDatesInRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || startDate > endDate) return [];

  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const current = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const dates: string[] = [];

  while (current <= end) {
    dates.push(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`
    );
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

interface MemberStats {
  profile: Profile;
  userId: string;
  joinedAt: string;
  participation: Record<string, boolean>;
  missedCount: number;
  totalFine: number;
}

type ViewMode = "monthly" | "weekly";

export default function CalendarPage() {
  const today = getTodayKST();
  const tomorrow = useMemo(() => addDays(today, 1), [today]);
  const weekDates = useMemo(() => getWeekDates(), []);
  const supabase = useMemo(() => createClient(), []);

  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [year, setYear] = useState(() => parseInt(today.slice(0, 4)));
  const [month, setMonth] = useState(() => parseInt(today.slice(5, 7)));
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [exemptDays, setExemptDays] = useState<ExemptDay[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);

  const exemptDaysRef = useRef(exemptDays);
  const groupRef = useRef(group);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exemptModal, setExemptModal] = useState<{
    dateStr: string;
    isCurrentlyExempt: boolean;
  } | null>(null);
  const [rangeModal, setRangeModal] = useState<{
    startDate: string;
    endDate: string;
    saving: boolean;
  } | null>(null);

  useEffect(() => {
    exemptDaysRef.current = exemptDays;
  }, [exemptDays]);

  useEffect(() => {
    groupRef.current = group;
  }, [group]);

  useEffect(() => {
    const saved = localStorage.getItem("calendarView") as ViewMode | null;
    if (saved === "monthly" || saved === "weekly") setViewMode(saved);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, [supabase]);

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("calendarView", mode);
  };

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);

      const { data: groupData } = await supabase
        .from("groups")
        .select("*")
        .limit(1)
        .single();
      if (!groupData) {
        setLoading(false);
        return;
      }
      setGroup(groupData);

      const { data: membersData } = await supabase
        .from("group_members")
        .select("user_id, joined_at, profiles(*)")
        .eq("group_id", groupData.id);
      if (!membersData) {
        setLoading(false);
        return;
      }

      const mm = String(month).padStart(2, "0");
      const daysInMonth = new Date(year, month, 0).getDate();

      let startDate: string;
      let endDate: string;

      if (viewMode === "monthly") {
        startDate = `${year}-${mm}-01`;
        endDate = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;
      } else {
        startDate = weekDates[0];
        endDate = weekDates[6];
      }

      const [{ data: postsData }, { data: exemptData }] = await Promise.all([
        supabase
          .from("posts")
          .select("user_id, date")
          .eq("group_id", groupData.id)
          .gte("date", startDate)
          .lte("date", endDate),
        supabase
          .from("exempt_days")
          .select("id, user_id, date, group_id, reason, created_at")
          .eq("group_id", groupData.id)
          .gte("date", startDate)
          .lte("date", endDate),
      ]);

      const posts = (postsData ?? []) as { user_id: string; date: string }[];
      const exempts = (exemptData ?? []) as ExemptDay[];
      setExemptDays(exempts);

      const dates =
        viewMode === "monthly"
          ? Array.from(
              { length: daysInMonth },
              (_, i) => `${year}-${mm}-${String(i + 1).padStart(2, "0")}`
            )
          : weekDates;

      const stats: MemberStats[] = membersData.map(
        (m: Record<string, unknown>) => {
          const profile = m.profiles as Profile;
          const userId = m.user_id as string;
          const joinedAt = m.joined_at
            ? new Date(m.joined_at as string).toLocaleDateString("en-CA", {
                timeZone: "Asia/Seoul",
              })
            : "2000-01-01";

          const participation: Record<string, boolean> = {};
          let missedCount = 0;

          for (const dateStr of dates) {
            const hasPost = posts.some(
              (p) => p.user_id === userId && p.date === dateStr
            );
            participation[dateStr] = hasPost;
            const isPreJoin = dateStr < joinedAt;
            const isFuture = dateStr > today;
            const isToday = dateStr === today;
            const isExempt = exempts.some(
              (e) =>
                e.date === dateStr &&
                (e.user_id === userId || e.user_id === null)
            );
            if (!isPreJoin && !isFuture && !isToday && !hasPost && !isExempt) {
              missedCount++;
            }
          }

          return {
            profile,
            userId,
            joinedAt,
            participation,
            missedCount,
            totalFine: missedCount * (groupData.fine_amount ?? 1000),
          };
        }
      );

      stats.sort((a, b) => b.totalFine - a.totalFine);
      setMemberStats(stats);
      setLoading(false);
    },
    [year, month, viewMode, weekDates, supabase, today]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExemptDay = useCallback(
    async (dateStr: string) => {
      if (!currentUserId || !groupRef.current) return;

      const existing = exemptDaysRef.current.find(
        (e) => e.user_id === currentUserId && e.date === dateStr
      );

      if (existing) {
        setExemptDays((prev) => prev.filter((e) => e.id !== existing.id));
        await supabase.from("exempt_days").delete().eq("id", existing.id);
      } else {
        const tempId = `temp-${dateStr}`;
        setExemptDays((prev) => [
          ...prev,
          {
            id: tempId,
            user_id: currentUserId,
            group_id: groupRef.current!.id,
            date: dateStr,
            reason: null,
            created_at: new Date().toISOString(),
          },
        ]);
        await supabase.from("exempt_days").insert({
          user_id: currentUserId,
          group_id: groupRef.current!.id,
          date: dateStr,
        });
      }
      // Silent refetch to update missedCount in fine summary
      fetchData(true);
    },
    [currentUserId, fetchData, supabase]
  );

  const openRangeModal = useCallback(() => {
    const mm = String(month).padStart(2, "0");
    const daysInSelectedMonth = new Date(year, month, 0).getDate();
    const monthStart = `${year}-${mm}-01`;
    const monthEnd = `${year}-${mm}-${String(daysInSelectedMonth).padStart(2, "0")}`;
    const startDate = monthStart > tomorrow ? monthStart : tomorrow;
    const endDate = monthEnd >= startDate ? monthEnd : startDate;

    setRangeModal({
      startDate,
      endDate,
      saving: false,
    });
  }, [month, tomorrow, year]);

  const closeRangeModal = useCallback(() => {
    setRangeModal(null);
  }, []);

  const updateRangeModal = useCallback(
    (field: "startDate" | "endDate", value: string) => {
      setRangeModal((prev) => {
        if (!prev) return prev;

        if (field === "startDate") {
          const startDate = value < tomorrow ? tomorrow : value;
          const endDate = prev.endDate < startDate ? startDate : prev.endDate;
          return { ...prev, startDate, endDate };
        }

        const endDate = value < prev.startDate ? prev.startDate : value;
        return { ...prev, endDate };
      });
    },
    [tomorrow]
  );

  const applyRangeExemptDays = useCallback(async () => {
    if (!rangeModal || !currentUserId || !groupRef.current) return;
    if (rangeModal.startDate < tomorrow || rangeModal.endDate < rangeModal.startDate) {
      return;
    }

    const dates = getDatesInRange(rangeModal.startDate, rangeModal.endDate);
    if (dates.length === 0) return;

    setRangeModal((prev) => (prev ? { ...prev, saving: true } : prev));

    const existingDates = new Set(
      exemptDaysRef.current
        .filter((e) => e.user_id === currentUserId)
        .map((e) => e.date)
    );
    const newDates = dates.filter((date) => !existingDates.has(date));

    if (newDates.length > 0) {
      const now = new Date().toISOString();
      const optimisticRows: ExemptDay[] = newDates.map((date) => ({
        id: `temp-range-${date}`,
        user_id: currentUserId,
        group_id: groupRef.current!.id,
        date,
        reason: null,
        created_at: now,
      }));

      setExemptDays((prev) => [...prev, ...optimisticRows]);

      const { error } = await supabase.from("exempt_days").insert(
        newDates.map((date) => ({
          user_id: currentUserId,
          group_id: groupRef.current!.id,
          date,
        }))
      );

      if (error) {
        setExemptDays((prev) =>
          prev.filter((e) => !optimisticRows.some((row) => row.id === e.id))
        );
      }
    }

    setRangeModal(null);
    fetchData(true);
  }, [currentUserId, fetchData, rangeModal, supabase, tomorrow]);

  const openExemptModal = useCallback(
    (dateStr: string) => {
      if (dateStr <= today) return;
      if (navigator.vibrate) navigator.vibrate(40);
      const isCurrentlyExempt = exemptDaysRef.current.some(
        (e) => e.user_id === currentUserId && e.date === dateStr
      );
      setExemptModal({ dateStr, isCurrentlyExempt });
    },
    [currentUserId, today]
  );

  const handlePressStart = useCallback(
    (dateStr: string) => {
      longPressTimer.current = setTimeout(() => openExemptModal(dateStr), 500);
    },
    [openExemptModal]
  );

  const handlePressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleModalConfirm = useCallback(() => {
    if (!exemptModal) return;
    toggleExemptDay(exemptModal.dateStr);
    setExemptModal(null);
  }, [exemptModal, toggleExemptDay]);

  const handleModalClose = useCallback(() => setExemptModal(null), []);

  const daysInMonth = new Date(year, month, 0).getDate();
  const calendarStartDay = new Date(year, month - 1, 1).getDay();
  const [ty, tm] = today.split("-").map(Number);
  const isCurrentMonth = year === ty && month === tm;
  const currentMemberStats = memberStats.find((m) => m.userId === currentUserId);
  const rangeDates = rangeModal
    ? getDatesInRange(rangeModal.startDate, rangeModal.endDate)
    : [];
  const rangeAlreadyExemptCount = rangeDates.filter((date) =>
    exemptDays.some((e) => e.user_id === currentUserId && e.date === date)
  ).length;
  const rangeNewCount = rangeDates.length - rangeAlreadyExemptCount;
  const canApplyRange =
    rangeDates.length > 0 &&
    rangeNewCount > 0 &&
    !!rangeModal &&
    rangeModal.startDate >= tomorrow &&
    rangeModal.endDate >= rangeModal.startDate;

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const renderWeekCell = (
    dateStr: string,
    joinedAt: string,
    participated: boolean,
    isExempt: boolean
  ) => {
    const isPreJoin = dateStr < joinedAt;
    const isFuture = dateStr > today;
    const isToday = dateStr === today;

    if (isExempt || isPreJoin)
      return <span className="text-border/60 text-[10px]">—</span>;
    if (isFuture) return <span className="text-border text-[10px]">·</span>;
    if (participated)
      return <span className="text-green-500 font-bold">✓</span>;
    if (isToday) return <span className="text-yellow-500 font-bold">?</span>;
    return <span className="text-danger font-bold">✗</span>;
  };

  const weekLabel = `${weekDates[0].slice(5).replace("-", "/")} ~ ${weekDates[6].slice(5).replace("-", "/")}`;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-background/95 backdrop-blur-md z-40">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-foreground">현황</h1>
          <div className="flex bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => changeView("monthly")}
              className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                viewMode === "monthly"
                  ? "bg-primary text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              월
            </button>
            <button
              onClick={() => changeView("weekly")}
              className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                viewMode === "weekly"
                  ? "bg-primary text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              주
            </button>
          </div>
        </div>

        {viewMode === "monthly" ? (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <div />
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={prevMonth}
                className="text-muted hover:text-foreground transition-colors p-2"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="text-foreground font-bold text-base w-28 text-center">
                {year}년 {month}월
              </span>
              <button
                onClick={nextMonth}
                disabled={isCurrentMonth}
                className="text-muted hover:text-foreground transition-colors p-2 disabled:opacity-30"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={openRangeModal}
                className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-colors active:scale-[0.98] hover:text-foreground"
              >
                휴일설정
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-muted">
            이번 주&nbsp;
            <span className="text-foreground font-medium">{weekLabel}</span>
          </p>
        )}
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto pb-nav">
          {viewMode === "monthly" ? (
            /* ── 월간: 7열 그리드 캘린더 ── */
            <div className="px-4 pt-4">
              <div className="grid grid-cols-7 gap-px bg-border rounded-2xl overflow-hidden">
                {/* 요일 헤더 */}
                {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
                  <div
                    key={d}
                    className={`bg-card py-2 text-center text-[11px] font-semibold ${
                      i === 0
                        ? "text-red-400"
                        : i === 6
                        ? "text-blue-400"
                        : "text-muted"
                    }`}
                  >
                    {d}
                  </div>
                ))}
                {/* 앞 빈 칸 */}
                {Array.from({ length: calendarStartDay }).map((_, i) => (
                  <div key={`e-${i}`} className="bg-card h-16" />
                ))}
                {/* 날짜 셀 */}
                {Array.from({ length: daysInMonth }, (_, idx) => {
                  const day = idx + 1;
                  const mm = String(month).padStart(2, "0");
                  const dd = String(day).padStart(2, "0");
                  const dateStr = `${year}-${mm}-${dd}`;
                  const isFuture = dateStr > today;
                  const isToday = dateStr === today;
                  const dayOfWeek = (calendarStartDay + idx) % 7;

                  const isMyExempt = exemptDays.some(
                    (e) => e.user_id === currentUserId && e.date === dateStr
                  );
                  const myParticipated =
                    currentMemberStats?.participation[dateStr] ?? false;
                  const myJoinedAt = currentMemberStats?.joinedAt ?? "2000-01-01";
                  const myMissed =
                    !isFuture &&
                    !isToday &&
                    !myParticipated &&
                    !isMyExempt &&
                    dateStr >= myJoinedAt;

                  // 그 날 참가 대상자 = 제외일 아니고 가입일 이후인 멤버
                  const activeMembers = memberStats.filter((m) => {
                    const exempt = exemptDays.some(
                      (e) => e.date === dateStr && (e.user_id === m.userId || e.user_id === null)
                    );
                    return !exempt && dateStr >= m.joinedAt;
                  });
                  const allDone =
                    !isFuture &&
                    !isToday &&
                    activeMembers.length > 0 &&
                    activeMembers.every((m) => m.participation[dateStr] === true);

                  const numClass = isToday
                    ? "text-primary"
                    : isFuture
                    ? "text-muted/30"
                    : dayOfWeek === 0
                    ? "text-red-400"
                    : dayOfWeek === 6
                    ? "text-blue-400"
                    : "text-foreground";

                  const isPast = !isToday && !isFuture;

                  return (
                    <div
                      key={day}
                      className={`bg-card h-16 flex flex-col items-center pt-2 pb-1.5 relative overflow-hidden select-none cursor-pointer active:opacity-70 ${
                        isToday ? "ring-1 ring-inset ring-primary/40" : ""
                      } ${isPast ? "opacity-50" : ""}`}
                      onMouseDown={() => handlePressStart(dateStr)}
                      onMouseUp={handlePressEnd}
                      onMouseLeave={handlePressEnd}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        handlePressStart(dateStr);
                      }}
                      onTouchEnd={handlePressEnd}
                      onTouchCancel={handlePressEnd}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openExemptModal(dateStr);
                      }}
                    >
                      {/* 제외일 빗금 오버레이 */}
                      {isMyExempt && (
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(136,136,136,0.18) 4px, rgba(136,136,136,0.18) 6px)",
                          }}
                        />
                      )}
                      {/* 전원 완료 → 특별 아이콘 / 나만 완료 → 체크 */}
                      {allDone ? (
                        <img src="/icons/all-done_2.png" alt="" className="absolute inset-0 m-auto w-8 h-8 pointer-events-none z-0 translate-y-3" />
                      ) : myParticipated && !isMyExempt ? (
                        <span className="absolute inset-0 flex items-center justify-center text-green-400/40 text-3xl font-black pointer-events-none z-10 translate-y-1">
                          ✓
                        </span>
                      ) : null}
                      <span
                        className={`text-sm font-bold leading-none mb-1.5 relative z-10 ${numClass}`}
                      >
                        {day}
                      </span>
                      {myMissed && (
                        <div className="w-1.5 h-1.5 rounded-full bg-danger/70 relative z-10" />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-muted/40 text-[11px] text-center mt-2.5">
                날짜를 길게 눌러 개인 제외일 지정 · 다시 누르면 해제
              </p>
            </div>
          ) : (
            /* ── 주간: CSS Grid (유동 폭) ── */
            <div className="px-4 pt-4">
              <div
                className="grid gap-px bg-border rounded-2xl overflow-hidden"
                style={{ gridTemplateColumns: "72px repeat(7, minmax(0, 1fr))" }}
              >
                {/* 헤더 행 */}
                <div className="bg-card py-2 flex items-center justify-center text-[11px] font-semibold text-muted">
                  멤버
                </div>
                {DAY_LABELS.map((d, i) => {
                  const dateStr = weekDates[i];
                  const isToday = dateStr === today;
                  return (
                    <div
                      key={d}
                      className={`bg-card py-2 flex flex-col items-center justify-center text-[11px] font-semibold ${
                        isToday
                          ? "text-primary"
                          : i === 0
                          ? "text-red-400"
                          : i === 6
                          ? "text-blue-400"
                          : "text-muted"
                      }`}
                    >
                      <span>{d}</span>
                      <span className="font-normal text-[10px]">
                        {parseInt(dateStr.slice(8))}
                      </span>
                    </div>
                  );
                })}

                {/* 데이터 행 */}
                {memberStats.flatMap((m) => [
                  /* 멤버 이름 셀 */
                  <div
                    key={`name-${m.userId}`}
                    className="bg-card flex items-center gap-1.5 px-2 py-3"
                  >
                    <div className="relative w-5 h-5 rounded-full overflow-hidden bg-border flex-shrink-0">
                      {m.profile.avatar_url ? (
                        <Image
                          src={m.profile.avatar_url}
                          alt=""
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-[8px] flex items-center justify-center w-full h-full">
                          👤
                        </span>
                      )}
                    </div>
                    <span className="text-foreground text-[11px] font-medium truncate">
                      {m.profile.nickname}
                    </span>
                  </div>,

                  /* 7일 셀 */
                  ...weekDates.map((dateStr) => {
                    const isExempt = exemptDays.some(
                      (e) =>
                        e.date === dateStr &&
                        (e.user_id === m.userId || e.user_id === null)
                    );
                    const isMyRow = m.userId === currentUserId;
                    const isMyExempt =
                      isMyRow &&
                      exemptDays.some(
                        (e) => e.user_id === currentUserId && e.date === dateStr
                      );
                    return (
                      <div
                        key={`${m.userId}-${dateStr}`}
                        className={`bg-card flex items-center justify-center py-3 text-[11px] relative overflow-hidden select-none ${
                          isMyRow ? "cursor-pointer active:opacity-70" : ""
                        }`}
                        {...(isMyRow
                          ? {
                              onMouseDown: () => handlePressStart(dateStr),
                              onMouseUp: handlePressEnd,
                              onMouseLeave: handlePressEnd,
                              onTouchStart: (e: React.TouchEvent) => {
                                e.preventDefault();
                                handlePressStart(dateStr);
                              },
                              onTouchEnd: handlePressEnd,
                              onTouchCancel: handlePressEnd,
                              onContextMenu: (e: React.MouseEvent) => {
                                e.preventDefault();
                                openExemptModal(dateStr);
                              },
                            }
                          : {})}
                      >
                        {isMyExempt && (
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              backgroundImage:
                                "repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(136,136,136,0.18) 4px, rgba(136,136,136,0.18) 6px)",
                            }}
                          />
                        )}
                        <span className="relative z-10">
                          {renderWeekCell(
                            dateStr,
                            m.joinedAt,
                            m.participation[dateStr],
                            isExempt
                          )}
                        </span>
                      </div>
                    );
                  }),
                ])}
              </div>
            </div>
          )}

          {/* 벌금 집계 */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-foreground">
                {viewMode === "monthly"
                  ? `${month}월 벌금 집계`
                  : "이번 주 벌금 집계"}
              </h2>
              {group && (
                <span className="text-muted text-xs">
                  {group.fine_amount.toLocaleString()}원/일
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {memberStats.length === 0 ? (
                <p className="text-muted text-sm text-center py-8">
                  멤버가 없습니다
                </p>
              ) : (
                memberStats.map((m, idx) => (
                  <div
                    key={m.userId}
                    className="bg-card rounded-2xl px-4 py-3 border border-border flex items-center gap-3"
                  >
                    <span className="text-muted text-sm w-5 text-center font-medium">
                      {idx + 1}
                    </span>
                    <div className="relative w-9 h-9 rounded-full overflow-hidden bg-border flex-shrink-0">
                      {m.profile.avatar_url ? (
                        <Image
                          src={m.profile.avatar_url}
                          alt=""
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm">
                          👤
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm font-semibold truncate">
                        {m.profile.nickname}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold text-base ${
                          m.totalFine > 0 ? "text-danger" : "text-green-500"
                        }`}
                      >
                        {m.totalFine > 0
                          ? `${m.totalFine.toLocaleString()}원`
                          : "0원"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      {/* 기간 휴일 설정 모달 */}
      {rangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm bg-card rounded-3xl border border-border px-6 pt-7 pb-6">
            <h2 className="text-lg font-bold text-foreground mb-1.5">
              휴일 기간 설정
            </h2>
            <p className="text-muted text-sm mb-5">
              시작일과 종료일을 고르면 그 기간을 한 번에 쉬는 날로 지정해요.
            </p>

            <div className="flex flex-col gap-3 mb-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">시작일</span>
                <input
                  type="date"
                  value={rangeModal.startDate}
                  min={tomorrow}
                  inputMode="numeric"
                  onChange={(e) => updateRangeModal("startDate", e.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">종료일</span>
                <input
                  type="date"
                  value={rangeModal.endDate}
                  min={rangeModal.startDate}
                  inputMode="numeric"
                  onChange={(e) => updateRangeModal("endDate", e.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
                />
              </label>
            </div>

            <div className="mb-6">
              {rangeDates.length === 0 ? (
                <p className="text-danger text-xs font-semibold">
                  종료일은 시작일과 같거나 늦어야 해요.
                </p>
              ) : rangeModal.startDate < tomorrow ? (
                <p className="text-danger text-xs font-semibold">
                  시작일은 내일부터 선택할 수 있어요.
                </p>
              ) : (
                <p className="text-muted text-xs leading-relaxed">
                  <span className="font-bold text-[#FFFFFF]">{rangeNewCount}일</span>을 휴일로 지정해요.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeRangeModal}
                disabled={rangeModal.saving}
                className="flex-1 bg-background border border-border text-muted font-semibold py-3.5 rounded-2xl active:scale-[0.98] transition-all text-sm disabled:opacity-50"
              >
                닫기
              </button>
              <button
                onClick={applyRangeExemptDays}
                disabled={rangeModal.saving || !canApplyRange}
                className="flex-1 bg-primary text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all text-sm disabled:opacity-50"
              >
                {rangeModal.saving ? "저장 중" : "지정할게요"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 제외일 지정 / 해제 확인 모달 */}
      {exemptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm bg-card rounded-3xl border border-border px-6 pt-7 pb-6">
            <h2 className="text-lg font-bold text-foreground mb-1.5">
              {exemptModal.isCurrentlyExempt
                ? `${formatDateKR(exemptModal.dateStr)} 쉬는 날을 취소할까요?`
                : `${formatDateKR(exemptModal.dateStr)}은 쉬어가는 날로 지정할까요?`}
            </h2>
            <p className="text-muted text-sm mb-7">
              {exemptModal.isCurrentlyExempt
                ? "다시 인증 대상 날짜가 돼요."
                : "이 날은 벌금에서 제외돼요."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleModalClose}
                className="flex-1 bg-background border border-border text-muted font-semibold py-3.5 rounded-2xl active:scale-[0.98] transition-all text-sm"
              >
                {exemptModal.isCurrentlyExempt ? "유지할게요" : "아니에요"}
              </button>
              <button
                onClick={handleModalConfirm}
                className="flex-1 bg-primary text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all text-sm"
              >
                {exemptModal.isCurrentlyExempt ? "취소할게요" : "지정할게요"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
