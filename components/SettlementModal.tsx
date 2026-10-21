"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types";

interface MemberFine {
  profile: Profile;
  userId: string;
  missedCount: number;
  totalFine: number;
}

function getTodayKST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export default function SettlementModal() {
  const [show, setShow] = useState(false);
  const [prevMonthLabel, setPrevMonthLabel] = useState("");
  const [fines, setFines] = useState<MemberFine[]>([]);

  useEffect(() => {
    const today = getTodayKST();
    const [y, m, d] = today.split("-").map(Number);
    if (d !== 1) return;

    const storageKey = `settlement_${y}-${String(m).padStart(2, "0")}`;
    if (localStorage.getItem(storageKey)) return;

    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    setPrevMonthLabel(`${prevYear}년 ${prevMonth}월`);

    const fetchStats = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: groupData } = await supabase
        .from("groups")
        .select("*")
        .limit(1)
        .single();
      if (!groupData) return;

      const mm = String(prevMonth).padStart(2, "0");
      const daysInMonth = new Date(prevYear, prevMonth, 0).getDate();
      const startDate = `${prevYear}-${mm}-01`;
      const endDate = `${prevYear}-${mm}-${String(daysInMonth).padStart(2, "0")}`;

      const [{ data: membersData }, { data: postsData }, { data: exemptData }] =
        await Promise.all([
          supabase
            .from("group_members")
            .select("user_id, joined_at, profiles(*)")
            .eq("group_id", groupData.id),
          supabase
            .from("posts")
            .select("user_id, date")
            .eq("group_id", groupData.id)
            .gte("date", startDate)
            .lte("date", endDate),
          supabase
            .from("exempt_days")
            .select("user_id, date")
            .eq("group_id", groupData.id)
            .gte("date", startDate)
            .lte("date", endDate),
        ]);

      if (!membersData) return;

      const posts = (postsData ?? []) as { user_id: string; date: string }[];
      const exempts = (exemptData ?? []) as {
        user_id: string | null;
        date: string;
      }[];

      const stats: MemberFine[] = membersData.map(
        (m: Record<string, unknown>) => {
          const profile = m.profiles as Profile;
          const userId = m.user_id as string;
          const joinedAt = m.joined_at
            ? new Date(m.joined_at as string).toLocaleDateString("en-CA", {
                timeZone: "Asia/Seoul",
              })
            : "2000-01-01";

          let missedCount = 0;
          for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${prevYear}-${mm}-${String(day).padStart(2, "0")}`;
            if (dateStr < joinedAt) continue;
            const hasPost = posts.some(
              (p) => p.user_id === userId && p.date === dateStr
            );
            const isExempt = exempts.some(
              (e) =>
                e.date === dateStr &&
                (e.user_id === userId || e.user_id === null)
            );
            if (!hasPost && !isExempt) missedCount++;
          }

          return {
            profile,
            userId,
            missedCount,
            totalFine: missedCount * (groupData.fine_amount ?? 1000),
          };
        }
      );

      stats.sort((a, b) => b.totalFine - a.totalFine);
      setFines(stats);
      setShow(true);
    };

    fetchStats();
  }, []);

  const handleConfirm = () => {
    const today = getTodayKST();
    const [y, m] = today.split("-");
    localStorage.setItem(`settlement_${y}-${m}`, "1");
    setShow(false);
  };

  if (!show) return null;

  const totalFine = fines.reduce((sum, f) => sum + f.totalFine, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-[430px] bg-card rounded-t-3xl border-t border-border p-6 pb-10 animate-slide-up">
        {/* Handle bar */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        <h2 className="text-lg font-bold text-foreground">전달 정산</h2>
        <p className="text-muted text-sm mt-0.5 mb-5">
          {prevMonthLabel} 미참여 벌금 집계
        </p>

        {/* Member list */}
        <div className="flex flex-col gap-3 mb-5 max-h-52 overflow-y-auto">
          {fines.map((f) => (
            <div key={f.userId} className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-full overflow-hidden bg-border flex-shrink-0">
                {f.profile.avatar_url ? (
                  <Image
                    src={f.profile.avatar_url}
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
                  {f.profile.nickname}
                </p>
                <p className="text-muted text-xs">미참여 {f.missedCount}일</p>
              </div>
              <p
                className={`font-bold text-sm flex-shrink-0 ${
                  f.totalFine > 0 ? "text-danger" : "text-green-500"
                }`}
              >
                {f.totalFine > 0 ? `${f.totalFine.toLocaleString()}원` : "0원"}
              </p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between py-3.5 border-t border-border mb-4">
          <span className="text-foreground font-bold text-sm">전체 합계</span>
          <span
            className={`font-bold text-xl ${
              totalFine > 0 ? "text-danger" : "text-green-500"
            }`}
          >
            {totalFine.toLocaleString()}원
          </span>
        </div>

        <button
          onClick={handleConfirm}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-all"
        >
          확인했어요
        </button>
      </div>
    </div>
  );
}
