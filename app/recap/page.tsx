"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RecapView from "@/components/recap/RecapView";
import {
  computeRecap,
  type RecapInteraction,
  type RecapPostInput,
  type RecapExemptInput,
  type RecapResult,
} from "@/lib/recap";
import { demoRecapInput } from "@/lib/recapDemo";
import { FIRST_RECAP_YEAR, markRecapSeen } from "@/lib/recapSeen";

function todayKST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}
function addDays(d: string, n: number) {
  return new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
}

type State =
  | { kind: "loading" }
  | { kind: "locked"; year: number }
  | { kind: "empty"; year: number }
  | { kind: "error"; msg: string }
  | { kind: "ready"; data: RecapResult; meId: string; note: string | null; final: boolean; demo: boolean };

// Supabase는 한 번에 1000행까지만 주므로 나눠서 받기
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default function RecapPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const today = todayKST();
      const currentYear = Number(today.slice(0, 4));
      const year = Number(params.get("year")) || currentYear - 1;
      const supabase = createClient();

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return router.replace("/login");
        const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
        const isAdmin = !!profile?.is_admin;

        // 디자인 샘플 (관리자, 가상 데이터)
        if (params.get("demo") === "1" && isAdmin) {
          const y = Number(params.get("year")) || currentYear;
          return setState({ kind: "ready", data: computeRecap(demoRecapInput(y)), meId: "d1", note: "샘플 데이터", final: false, demo: true });
        }

        const final = year < currentYear;
        const preview = params.get("preview") === "1" && isAdmin;
        if (year < FIRST_RECAP_YEAR) return setState({ kind: "empty", year });
        if (!final && !preview) return setState({ kind: "locked", year });

        const endDate = final ? `${year}-12-31` : addDays(today, -1);
        const start = `${year}-01-01`;

        const { data: group } = await supabase.from("groups").select("id, fine_amount").limit(1).single();
        if (!group) throw new Error("그룹을 찾을 수 없어요");

        const { data: membersRaw } = await supabase
          .from("group_members")
          .select("user_id, joined_at, profiles(nickname, avatar_url)")
          .eq("group_id", group.id);

        const members = (membersRaw ?? []).map((m: Record<string, unknown>) => {
          const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as { nickname: string | null; avatar_url: string | null } | null;
          return {
            userId: m.user_id as string,
            nickname: p?.nickname ?? "알 수 없음",
            avatarUrl: p?.avatar_url ?? null,
            joinedDate: m.joined_at
              ? new Date(m.joined_at as string).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
              : start,
          };
        });

        const [posts, exempts] = await Promise.all([
          fetchAll<RecapPostInput>((f, t) =>
            supabase.from("posts").select("user_id, date, category, created_at").eq("group_id", group.id)
              .gte("date", start).lte("date", endDate).order("date").range(f, t)
          ),
          fetchAll<RecapExemptInput>((f, t) =>
            supabase.from("exempt_days").select("user_id, date").eq("group_id", group.id)
              .gte("date", start).lte("date", endDate).order("date").range(f, t)
          ),
        ]);

        // 반응·댓글: 실패해도 연말정산은 보여줌 (관련 상만 빠짐)
        const interactions = async (table: "reactions" | "comments"): Promise<RecapInteraction[]> => {
          try {
            const rows = await fetchAll<{ user_id: string; posts: { user_id: string } | { user_id: string }[] | null }>((f, t) =>
              supabase.from(table).select("user_id, posts!inner(user_id, date, group_id)")
                .eq("posts.group_id", group.id).gte("posts.date", start).lte("posts.date", endDate)
                .order("created_at").range(f, t)
            );
            return rows.map((r) => {
              const p = Array.isArray(r.posts) ? r.posts[0] : r.posts;
              return { from: r.user_id, to: p?.user_id ?? "" };
            });
          } catch {
            return [];
          }
        };
        const [reactions, comments] = await Promise.all([interactions("reactions"), interactions("comments")]);

        const data = computeRecap({
          year, endDate, members, posts, exempts, reactions, comments,
          fineAmount: group.fine_amount ?? 1000,
        });
        if (!data.members.some((m) => m.targetDays > 0)) return setState({ kind: "empty", year });

        setState({
          kind: "ready", data, meId: user.id, final, demo: false,
          note: final ? null : `미리보기 · ${endDate.slice(5).replace("-", "/")}까지`,
        });
      } catch (e) {
        setState({ kind: "error", msg: e instanceof Error ? e.message : "불러오지 못했어요" });
      }
    })();
  }, [router]);

  const ready = state.kind === "ready" ? state : null;
  const onSeen = useCallback(() => {
    if (ready?.final) markRecapSeen(ready.data.year);
  }, [ready]);
  const onClose = useCallback(() => {
    onSeen();
    router.push(ready?.demo ? "/settings" : "/");
  }, [onSeen, ready, router]);

  if (ready) {
    return <RecapView data={ready.data} meId={ready.meId} note={ready.note} isDemo={ready.demo} onSeen={onSeen} onClose={onClose} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center gap-3">
      {state.kind === "loading" && (
        <>
          <p className="text-4xl animate-pulse">✨</p>
          <p className="text-muted text-sm">1년 치 기록을 모으는 중...</p>
        </>
      )}
      {state.kind === "locked" && (
        <>
          <p className="text-4xl">🔒</p>
          <p className="text-foreground font-bold text-lg">{state.year} 연말정산은 아직 비밀이에요</p>
          <p className="text-muted text-sm">{state.year + 1}년 1월 1일에 공개돼요</p>
        </>
      )}
      {state.kind === "empty" && (
        <>
          <p className="text-4xl">🗂️</p>
          <p className="text-foreground font-bold text-lg">{state.year}년 기록이 없어요</p>
        </>
      )}
      {state.kind === "error" && (
        <>
          <p className="text-4xl">😵</p>
          <p className="text-foreground font-bold">연말정산을 불러오지 못했어요</p>
          <p className="text-muted text-xs">{state.msg}</p>
        </>
      )}
      {state.kind !== "loading" && (
        <button onClick={() => router.push("/")} className="mt-4 px-6 py-3 rounded-2xl bg-primary text-white font-bold">
          홈으로
        </button>
      )}
    </div>
  );
}
