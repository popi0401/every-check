// 연말정산 집계 + 올해의 상 (순수 함수 — 화면/DB와 분리)
import { CATEGORIES } from "@/lib/categories";

export interface RecapMemberInput {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  joinedDate: string; // KST YYYY-MM-DD
}
export interface RecapPostInput {
  user_id: string;
  date: string;
  category: string | null;
  created_at: string;
}
export interface RecapExemptInput {
  user_id: string | null; // null = 그룹 전체 제외일
  date: string;
}
export interface RecapInteraction {
  from: string; // 반응/댓글 남긴 사람
  to: string; // 글 주인
}
export interface RecapInput {
  year: number;
  endDate: string; // 집계 마지막 날 (확정본이면 12/31)
  members: RecapMemberInput[];
  posts: RecapPostInput[];
  exempts: RecapExemptInput[];
  reactions: RecapInteraction[];
  comments: RecapInteraction[];
  fineAmount: number;
}

export type DayStatus = "none" | "exempt" | "ok" | "miss";

export interface MemberStats {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  startDate: string;
  targetDays: number;
  successDays: number;
  rate: number | null;
  monthly: (number | null)[]; // 12개월 성공률
  bestMonth: number | null; // 0~11
  fine: number;
  longestStreak: number;
  categoryCounts: Record<string, number>;
  topCategory: string | null;
  distinctCategories: number;
  avgMinutes: number | null; // 평균 인증 시각 (KST, 0~1439)
  latestMinutes: number | null;
  nightCount: number; // 23시 이후 인증 수
  fullMonths: number; // 한 번도 안 빠진 달
  h1Rate: number | null;
  h2Rate: number | null;
  reactionsReceived: number;
  commentsReceived: number;
  cheersGiven: number; // 다른 사람 글에 남긴 반응+댓글
  days: DayStatus[]; // 1/1 ~ 12/31
}

export interface GroupStats {
  memberCount: number;
  totalDays: number;
  allSuccessDays: number;
  rate: number | null;
  monthly: (number | null)[];
  totalFine: number;
  categoryCounts: Record<string, number>;
  topCategory: string | null;
}

export interface Award {
  id: string;
  emoji: string;
  title: string;
  criteria: string;
  winners: string[];
  value: number;
  valueLabel: string;
  grand?: boolean;
}

export interface RecapResult {
  year: number;
  endDate: string;
  members: MemberStats[];
  group: GroupStats;
  awards: Award[]; // 발표 순서 (마지막이 대상)
}

// ---------- 날짜 도우미 (YYYY-MM-DD 문자열, 시간대 영향 없음) ----------
const DAY = 864e5;
const toNum = (d: string) => Date.parse(d + "T00:00:00Z") / DAY;
const toStr = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const monthOf = (d: string) => Number(d.slice(5, 7)) - 1;

export function kstMinutes(iso: string): number {
  const m = Math.floor(Date.parse(iso) / 60000) + 9 * 60;
  return ((m % 1440) + 1440) % 1440;
}
export function formatMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
}
export function categoryLabel(id: string | null): string {
  const c = CATEGORIES.find((x) => x.id === id);
  return c ? `${c.emoji} ${c.label}` : "";
}
const pct = (r: number | null) => (r == null ? "-" : `${(r * 100).toFixed(1)}%`);

function topKey(counts: Record<string, number>): string | null {
  let best: string | null = null;
  for (const k of Object.keys(counts)) if (best == null || counts[k] > counts[best]) best = k;
  return best;
}

// ---------- 집계 ----------
export function computeRecap(input: RecapInput): RecapResult {
  const { year, endDate, members, posts, exempts, fineAmount } = input;
  const yStart = toNum(`${year}-01-01`);
  const yEnd = toNum(`${year}-12-31`);
  const last = Math.min(toNum(endDate), yEnd);
  const totalYearDays = yEnd - yStart + 1;

  const groupExempt = new Set(exempts.filter((e) => e.user_id == null).map((e) => e.date));
  const postsBy = new Map<string, RecapPostInput[]>();
  for (const p of posts) {
    if (p.date < `${year}-01-01` || p.date > toStr(last)) continue;
    const arr = postsBy.get(p.user_id) ?? [];
    arr.push(p);
    postsBy.set(p.user_id, arr);
  }

  const memberStats: MemberStats[] = members.map((m) => {
    const start = Math.max(yStart, toNum(m.joinedDate));
    const myExempt = new Set(exempts.filter((e) => e.user_id === m.userId).map((e) => e.date));
    const myPosts = postsBy.get(m.userId) ?? [];
    const postDates = new Set(myPosts.map((p) => p.date));

    const days: DayStatus[] = [];
    const mTarget = Array(12).fill(0);
    const mOk = Array(12).fill(0);
    let target = 0, ok = 0, streak = 0, longest = 0;

    for (let n = yStart; n <= yEnd; n++) {
      const d = toStr(n);
      if (n < start || n > last) { days.push("none"); continue; }
      if (groupExempt.has(d) || myExempt.has(d)) { days.push("exempt"); continue; } // 제외일은 연속을 끊지 않음
      const mo = monthOf(d);
      target++; mTarget[mo]++;
      if (postDates.has(d)) {
        ok++; mOk[mo]++; streak++; longest = Math.max(longest, streak);
        days.push("ok");
      } else {
        streak = 0;
        days.push("miss");
      }
    }

    const monthly = mTarget.map((t, i) => (t ? mOk[i] / t : null));
    let bestMonth: number | null = null;
    let bestRate = -1;
    for (let i = 0; i < 12; i++) {
      const r = monthly[i];
      if (r != null && r > bestRate) { bestRate = r; bestMonth = i; }
    }
    const sumRange = (a: number, b: number) => {
      let t = 0, o = 0;
      for (let i = a; i < b; i++) { t += mTarget[i]; o += mOk[i]; }
      return t ? o / t : null;
    };

    const categoryCounts: Record<string, number> = {};
    for (const p of myPosts) if (p.category) categoryCounts[p.category] = (categoryCounts[p.category] ?? 0) + 1;
    const mins = myPosts.map((p) => kstMinutes(p.created_at));

    return {
      userId: m.userId,
      nickname: m.nickname,
      avatarUrl: m.avatarUrl,
      startDate: toStr(start),
      targetDays: target,
      successDays: ok,
      rate: target ? ok / target : null,
      monthly,
      bestMonth,
      fine: (target - ok) * fineAmount,
      longestStreak: longest,
      categoryCounts,
      topCategory: topKey(categoryCounts),
      distinctCategories: Object.keys(categoryCounts).length,
      avgMinutes: mins.length ? mins.reduce((a, b) => a + b, 0) / mins.length : null,
      latestMinutes: mins.length ? Math.max(...mins) : null,
      nightCount: mins.filter((x) => x >= 23 * 60).length,
      fullMonths: mTarget.filter((t, i) => t > 0 && mOk[i] === t).length,
      h1Rate: sumRange(0, 6),
      h2Rate: sumRange(6, 12),
      reactionsReceived: input.reactions.filter((r) => r.to === m.userId && r.from !== m.userId).length,
      commentsReceived: input.comments.filter((r) => r.to === m.userId && r.from !== m.userId).length,
      cheersGiven:
        input.reactions.filter((r) => r.from === m.userId && r.to !== m.userId).length +
        input.comments.filter((r) => r.from === m.userId && r.to !== m.userId).length,
      days,
    };
  });

  // 그룹
  let totalDays = 0, allSuccess = 0, gT = 0, gO = 0;
  const gmT = Array(12).fill(0), gmO = Array(12).fill(0);
  for (let i = 0; i < totalYearDays; i++) {
    let anyTarget = false, all = true;
    for (const s of memberStats) {
      const st = s.days[i];
      if (st === "ok" || st === "miss") {
        anyTarget = true;
        const mo = monthOf(toStr(yStart + i));
        gT++; gmT[mo]++;
        if (st === "ok") { gO++; gmO[mo]++; } else all = false;
      }
    }
    if (anyTarget) { totalDays++; if (all) allSuccess++; }
  }
  const gCat: Record<string, number> = {};
  for (const s of memberStats) for (const [k, v] of Object.entries(s.categoryCounts)) gCat[k] = (gCat[k] ?? 0) + v;

  const group: GroupStats = {
    memberCount: memberStats.length,
    totalDays,
    allSuccessDays: allSuccess,
    rate: gT ? gO / gT : null,
    monthly: gmT.map((t, i) => (t ? gmO[i] / t : null)),
    totalFine: memberStats.reduce((a, s) => a + s.fine, 0),
    categoryCounts: gCat,
    topCategory: topKey(gCat),
  };

  return { year, endDate: toStr(last), members: memberStats, group, awards: pickAwards(memberStats) };
}

// ---------- 올해의 상 ----------
interface AwardDef {
  id: string;
  emoji: string;
  title: string;
  criteria: string;
  metric: (s: MemberStats) => number | null; // 클수록 좋음, null/0 이하는 후보 아님
  label: (v: number) => string;
}

const AWARD_DEFS: AwardDef[] = [
  { id: "streak", emoji: "🔥", title: "연속왕", criteria: "가장 길게 연속으로 인증한 사람", metric: (s) => s.longestStreak, label: (v) => `${v}일 연속` },
  { id: "perfect", emoji: "📅", title: "개근상", criteria: "한 번도 안 빠진 달이 가장 많은 사람", metric: (s) => s.fullMonths, label: (v) => `개근 ${v}개월` },
  { id: "comeback", emoji: "📈", title: "역전상", criteria: "상반기보다 하반기 성공률이 가장 많이 오른 사람", metric: (s) => (s.h1Rate != null && s.h2Rate != null ? s.h2Rate - s.h1Rate : null), label: (v) => `하반기 +${(v * 100).toFixed(1)}%p` },
  { id: "early", emoji: "🌅", title: "부지런상", criteria: "평균 인증 시각이 가장 이른 사람", metric: (s) => (s.avgMinutes == null ? null : 1440 - s.avgMinutes), label: (v) => `평균 ${formatMinutes(1440 - v)}` },
  { id: "owl", emoji: "🦉", title: "올빼미상", criteria: "23시 이후 인증이 가장 많은 사람", metric: (s) => s.nightCount, label: (v) => `23시 이후 ${v}회` },
  { id: "variety", emoji: "🎨", title: "다재다능상", criteria: "가장 다양한 분류를 인증한 사람", metric: (s) => s.distinctCategories, label: (v) => `${v}개 분류` },
  { id: "popular", emoji: "💖", title: "인기상", criteria: "내 글에 받은 반응이 가장 많은 사람", metric: (s) => s.reactionsReceived, label: (v) => `반응 ${v}개` },
  { id: "cheer", emoji: "📣", title: "응원단장상", criteria: "다른 사람 글에 반응·댓글을 가장 많이 남긴 사람", metric: (s) => s.cheersGiven, label: (v) => `응원 ${v}번` },
];

// 발표 순서: 작은 상 → 기부천사 → 대상
const REVEAL_ORDER = ["cheer", "popular", "variety", "owl", "early", "comeback", "perfect", "streak"];

export function pickAwards(stats: MemberStats[]): Award[] {
  const eligible = stats.filter((s) => s.rate != null);
  if (eligible.length === 0) return [];

  // 대상: 성공률 1위, 같으면 최장 연속
  const grandSorted = [...eligible].sort(
    (a, b) => (b.rate as number) - (a.rate as number) || b.longestStreak - a.longestStreak
  );
  const g0 = grandSorted[0];
  const grandWinners = grandSorted
    .filter((s) => s.rate === g0.rate && s.longestStreak === g0.longestStreak)
    .map((s) => s.userId);

  const count = new Map<string, number>();
  const awarded: Award[] = [];

  for (const def of AWARD_DEFS) {
    const ranked = eligible
      .filter((s) => !grandWinners.includes(s.userId))
      .map((s) => ({ s, v: def.metric(s) }))
      .filter((x): x is { s: MemberStats; v: number } => x.v != null && x.v > 0)
      .sort((a, b) => b.v - a.v);
    if (ranked.length === 0) continue;

    // 가능하면 모두 하나씩: 1위가 이미 상을 받았으면, 1위 기록의 80% 이상인
    // 상위 3명 중 아직 상이 없는 사람에게 (차이가 크면 그대로 1위에게)
    const top = ranked[0];
    const pick = (count.get(top.s.userId) ?? 0) > 0
      ? ranked.slice(1, 3).find((x) => !(count.get(x.s.userId) ?? 0) && x.v >= top.v * 0.8) ?? top
      : top;
    const winners = ranked
      .filter((x) => x.v === pick.v && ((count.get(x.s.userId) ?? 0) === 0 || x.s.userId === pick.s.userId))
      .map((x) => x.s.userId);
    winners.forEach((id) => count.set(id, (count.get(id) ?? 0) + 1));
    awarded.push({ id: def.id, emoji: def.emoji, title: def.title, criteria: def.criteria, winners, value: pick.v, valueLabel: def.label(pick.v) });
  }

  const ordered = REVEAL_ORDER.map((id) => awarded.find((a) => a.id === id)).filter((a): a is Award => !!a);

  // 기부천사상 (웃음용): 벌금 1위, 대상 직전
  const maxFine = Math.max(...eligible.map((s) => s.fine));
  if (maxFine > 0) {
    ordered.push({
      id: "donor", emoji: "💸", title: "기부천사상", criteria: "벌금을 가장 많이 낸 사람 (고마워요!)",
      winners: eligible.filter((s) => s.fine === maxFine).map((s) => s.userId),
      value: maxFine, valueLabel: `${maxFine.toLocaleString()}원 기부`,
    });
  }

  ordered.push({
    id: "grand", emoji: "🏆", title: "대상", criteria: "올해 성공률 1위",
    winners: grandWinners, value: g0.rate as number, valueLabel: `성공률 ${pct(g0.rate)}`, grand: true,
  });
  return ordered;
}
