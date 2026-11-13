// 1/1 연말정산 "한 번만 보여주기" 기록 (DB 우선, 실패 시 이 기기에만 저장)
import { createClient } from "@/lib/supabase/client";

export const FIRST_RECAP_YEAR = 2026;
const key = (y: number) => `recap_seen_${y}`;

export async function markRecapSeen(year: number) {
  try {
    localStorage.setItem(key(year), "1");
  } catch {}
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ wrapped_seen_year: year }).eq("id", user.id).lt("wrapped_seen_year", year);
    await supabase.from("profiles").update({ wrapped_seen_year: year }).eq("id", user.id).is("wrapped_seen_year", null);
  } catch {}
}

/** 1월 중 홈 첫 접속이면, 아직 안 본 지난해 연말정산 연도를 돌려줌 */
export async function pendingRecapYear(): Promise<number | null> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const [y, m] = today.split("-").map(Number);
  const year = y - 1;
  if (m !== 1 || year < FIRST_RECAP_YEAR) return null;
  try {
    if (localStorage.getItem(key(year))) return null;
  } catch {}
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from("profiles").select("wrapped_seen_year").eq("id", user.id).single();
    if (!error && data && (data.wrapped_seen_year ?? 0) >= year) {
      try { localStorage.setItem(key(year), "1"); } catch {}
      return null;
    }
  } catch {}
  return year;
}
