// 디자인 미리보기용 샘플 데이터 (실제 멤버와 무관한 가상 인물)
import type { RecapInput } from "@/lib/recap";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function demoRecapInput(year: number): RecapInput {
  const r = rng(2026);
  const people = [
    { userId: "d1", nickname: "성실한 고양이", joined: `${year}-01-01`, p: 0.97, hour: 7 },
    { userId: "d2", nickname: "밤샘 부엉이", joined: `${year}-01-01`, p: 0.9, hour: 23 },
    { userId: "d3", nickname: "역전의 용사", joined: `${year}-01-01`, p: 0.6, hour: 21, late: 0.95 },
    { userId: "d4", nickname: "응원 요정", joined: `${year}-03-02`, p: 0.82, hour: 20 },
    { userId: "d5", nickname: "다재다능 판다", joined: `${year}-05-10`, p: 0.86, hour: 18 },
    { userId: "d6", nickname: "느긋한 거북이", joined: `${year}-06-01`, p: 0.7, hour: 22 },
  ];
  const cats = ["job", "study", "side_job", "project", "exercise", "reading", "hobby", "self_care", "etc"];
  const posts: RecapInput["posts"] = [];
  const end = Date.parse(`${year}-12-31T00:00:00Z`);
  for (const m of people) {
    for (let t = Date.parse(`${m.joined}T00:00:00Z`); t <= end; t += 864e5) {
      const d = new Date(t).toISOString().slice(0, 10);
      const second = Number(d.slice(5, 7)) >= 7;
      const p = m.late && second ? m.late : m.p;
      if (r() > p) continue;
      const hh = Math.min(23, Math.max(5, m.hour + Math.floor(r() * 3) - 1));
      const mm = Math.floor(r() * 60);
      const utc = new Date(Date.parse(`${d}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+09:00`)).toISOString();
      const variety = m.userId === "d5" ? 9 : 3;
      posts.push({ user_id: m.userId, date: d, category: d >= `${year}-10-21` ? cats[Math.floor(r() * variety)] : null, created_at: utc });
    }
  }
  const reactions: RecapInput["reactions"] = [];
  const comments: RecapInput["comments"] = [];
  for (const p of posts) {
    for (const m of people) {
      if (m.userId === p.user_id) continue;
      const cheer = m.userId === "d4" ? 0.6 : 0.15;
      if (r() < cheer) reactions.push({ from: m.userId, to: p.user_id });
      if (r() < cheer / 4) comments.push({ from: m.userId, to: p.user_id });
    }
  }
  return {
    year,
    endDate: `${year}-12-31`,
    members: people.map((m) => ({ userId: m.userId, nickname: m.nickname, avatarUrl: null, joinedDate: m.joined })),
    posts,
    exempts: [{ user_id: null, date: `${year}-09-17` }, { user_id: "d1", date: `${year}-08-03` }],
    reactions,
    comments,
    fineAmount: 1000,
  };
}
