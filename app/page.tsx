"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import PostCard from "@/components/PostCard";
import EmptyPostCard from "@/components/EmptyPostCard";
import { Post, Profile } from "@/types";
import { createClient } from "@/lib/supabase/client";

function getTodayKST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function formatDateKR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface MemberWithProfile {
  userId: string;
  profile: Profile;
}

export default function HomePage() {
  const today = getTodayKST();
  const supabase = useMemo(() => createClient(), []);

  const [selectedDate, setSelectedDate] = useState(today);
  const [currentUserId, setCurrentUserId] = useState("");
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [noGroup, setNoGroup] = useState(false);

  const isToday = selectedDate === today;

  const fetchData = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? "");

    const { data: group } = await supabase
      .from("groups")
      .select("*")
      .limit(1)
      .single();

    if (!group) {
      setNoGroup(true);
      setLoading(false);
      return;
    }

    const { data: membersData } = await supabase
      .from("group_members")
      .select("user_id, profiles(*)")
      .eq("group_id", group.id);

    const { data: postsData } = await supabase
      .from("posts")
      .select('id, user_id, group_id, date, category, subcategory, activity_text, edited_at, created_at, post_images(id, image_url, "order", created_at)')
      .eq("date", selectedDate)
      .eq("group_id", group.id)
      .order("created_at", { ascending: false });

    const postIds = (postsData ?? []).map((p) => (p as Record<string, unknown>).id as string);

    const [{ data: reactionsData }, { data: commentsData }] = postIds.length > 0
      ? await Promise.all([
          supabase.from("reactions").select("*").in("post_id", postIds),
          supabase.from("comments").select("id, post_id").in("post_id", postIds),
        ])
      : [{ data: [] }, { data: [] }];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mergedPosts: Post[] = (postsData ?? []).map((p: any) => {
      const member = (membersData ?? []).find(
        (m: Record<string, unknown>) => m.user_id === p.user_id
      );
      return {
        ...p,
        profiles: member ? (member as Record<string, unknown>).profiles : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reactions: (reactionsData ?? []).filter((r: any) => r.post_id === p.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        comments: (commentsData ?? []).filter((c: any) => c.post_id === p.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        images: [...(p.post_images ?? [])].sort((a: any, b: any) => a.order - b.order),
      };
    });

    const mappedMembers = (membersData ?? []).map((m: Record<string, unknown>) => ({
      userId: m.user_id as string,
      profile: m.profiles as Profile,
    }));

    setMembers(mappedMembers);
    setPosts(mergedPosts);
    setLoading(false);
  }, [selectedDate, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const completedMembers = members.filter((m) =>
    posts.some((p) => p.user_id === m.userId)
  );
  const pendingMembers = members.filter(
    (m) => !posts.some((p) => p.user_id === m.userId)
  );

  const totalCount = members.length;
  const doneCount = completedMembers.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">
            every<span className="text-primary">day</span>
          </h1>
          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-1 text-muted hover:text-foreground transition-colors"
              aria-label="이전 날짜"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="text-muted text-xs min-w-[90px] text-center">
              {isToday ? `오늘 · ${formatDateKR(today)}` : formatDateKR(selectedDate)}
            </span>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="p-1 text-muted hover:text-foreground transition-colors"
                aria-label="다음 날짜"
                disabled={addDays(selectedDate, 1) > today}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
            {isToday && <div className="w-[26px]" />}
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 bg-border rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted flex-shrink-0">
            {doneCount}/{totalCount}명 완료
          </span>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : noGroup ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-muted text-sm">그룹을 찾을 수 없습니다</p>
        </div>
      ) : (
        <main className="flex-1 px-4 py-4 pb-nav flex flex-col gap-4">
          {totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <span className="text-5xl">👥</span>
              <p className="text-muted text-sm">아직 그룹 멤버가 없습니다</p>
            </div>
          ) : (
            <>
              {completedMembers.map((member) => {
                const post = posts.find((p) => p.user_id === member.userId)!;
                return (
                  <PostCard
                    key={member.userId}
                    post={post}
                    currentUserId={currentUserId}
                  />
                );
              })}
              {/* 과거 날짜에 아무도 안 올린 경우 */}
              {!isToday && completedMembers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <span className="text-5xl">📭</span>
                  <p className="text-muted text-sm">이 날엔 인증한 멤버가 없어요</p>
                </div>
              )}
              {/* 오늘만 미완료 멤버 표시 */}
              {isToday && pendingMembers.map((member) => (
                <EmptyPostCard
                  key={member.userId}
                  profile={member.profile}
                  isCurrentUser={member.userId === currentUserId}
                />
              ))}
            </>
          )}
        </main>
      )}
    </div>
  );
}
