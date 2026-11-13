"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Sparkles, { prefersReducedMotion } from "./Sparkles";
import {
  categoryLabel,
  formatMinutes,
  type Award,
  type MemberStats,
  type RecapResult,
} from "@/lib/recap";

// ---------------- 도우미 ----------------
function useInView<T extends Element>(threshold = 0.55) {
  // 들어올 때마다 다시 재생: 충분히 보이면 켜고, 화면에서 완전히 벗어나면 끈다
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const [round, setRound] = useState(0);
  const shown = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= threshold) {
          if (!shown.current) {
            shown.current = true;
            // 먼저 비어 있는 상태로 새로 그린 뒤, 다음 프레임에 켜야 그래프가 0에서부터 차오른다
            setRound((r) => r + 1);
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                if (shown.current) setInView(true);
              })
            );
          }
        } else if (!e.isIntersecting || e.intersectionRatio < 0.05) {
          // 스냅 스크롤에선 옆 섹션이 화면 가장자리에 딱 붙어 있어 '교차 중(비율 0)'으로 잡히므로 비율로 판단
          shown.current = false;
          setInView(false);
        }
      },
      { threshold: [0, 0.05, threshold] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView, round] as const;
}

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) {
      setV(0);
      return;
    }
    if (prefersReducedMotion()) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return v;
}

/** 일정 시간 뒤 1이 되는 트리거 (파티클용) */
function useLater(active: boolean, ms: number) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) {
      setT(0);
      return;
    }
    const id = setTimeout(() => setT(1), ms);
    return () => clearTimeout(id);
  }, [active, ms]);
  return t;
}

const josa = (word: string, a: string, b: string) => {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return b;
  return (c - 0xac00) % 28 ? a : b;
};
const pct = (r: number | null, d = 1) => (r == null ? "-" : `${(r * 100).toFixed(d)}%`);
const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function Avatar({ url, name, size = 64, className = "" }: { url: string | null; name: string; size?: number; className?: string }) {
  return (
    <div
      className={`rounded-full overflow-hidden bg-[#2A2A2A] flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} crossOrigin="anonymous" className="w-full h-full object-cover" />
      ) : (
        <span style={{ fontSize: size * 0.45 }}>👤</span>
      )}
    </div>
  );
}

function Section({
  children,
  bg,
  sectionRef,
  className = "",
  replay = 0,
}: {
  children: ReactNode;
  bg: string;
  sectionRef?: React.Ref<HTMLElement>;
  className?: string;
  /** 바뀔 때마다 안쪽을 새로 그려 CSS 애니메이션을 처음부터 재생 */
  replay?: number;
}) {
  return (
    <section
      ref={sectionRef}
      className={`recap-anim relative min-h-[100dvh] snap-start snap-always flex flex-col items-center justify-center px-6 overflow-hidden text-center ${className}`}
      style={{ background: bg }}
    >
      <div key={replay} className="contents">
        {children}
      </div>
    </section>
  );
}

const FadeUp = ({ show, delay = 0, children, className = "" }: { show: boolean; delay?: number; children: ReactNode; className?: string }) => (
  <div
    className={className}
    style={{
      opacity: show ? 1 : 0,
      transform: show ? "none" : "translateY(24px)",
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
    }}
  >
    {children}
  </div>
);

const ScrollHint = ({ label = "내려서 보기" }: { label?: string }) => (
  <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center text-white/50 text-xs gap-1" style={{ animation: "recap-bounce 1.6s ease-in-out infinite" }}>
    <span>{label}</span>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
  </div>
);

const BG = {
  intro: "radial-gradient(120% 80% at 50% 20%, #4a1d08 0%, #121212 65%)",
  days: "linear-gradient(180deg, #121212 0%, #1d130e 100%)",
  rate: "radial-gradient(100% 70% at 50% 45%, #3b1806 0%, #121212 70%)",
  monthly: "linear-gradient(180deg, #1d130e 0%, #121212 100%)",
  streak: "radial-gradient(90% 60% at 50% 40%, #4a1a05 0%, #140c08 75%)",
  category: "linear-gradient(180deg, #121212 0%, #1a1420 100%)",
  fine: "radial-gradient(100% 70% at 50% 30%, #2b2410 0%, #121212 70%)",
  group: "linear-gradient(180deg, #121212 0%, #10181d 100%)",
  ceremony: "radial-gradient(110% 80% at 50% 30%, #3d2f08 0%, #0d0b05 70%)",
  award: "radial-gradient(100% 70% at 50% 35%, #2a2208 0%, #0b0a06 75%)",
  grand: "radial-gradient(90% 70% at 50% 35%, #4a3a06 0%, #050403 70%)",
  summary: "linear-gradient(180deg, #0b0a06 0%, #121212 100%)",
};

// ---------------- 섹션들 ----------------
function IntroSection({ year, me, note }: { year: number; me: MemberStats | null; note: string | null }) {
  const [ref, inView, round] = useInView<HTMLElement>(0.3);
  const full = "우리, 매일 뭘 했을까?";
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (!inView) {
      setTyped("");
      return;
    }
    if (prefersReducedMotion()) return setTyped(full);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 90);
    return () => clearInterval(id);
  }, [inView]);
  const burst = useLater(inView, 300);
  return (
    <Section sectionRef={ref} replay={round} bg={BG.intro}>
      <Sparkles trigger={burst} originY={0.38} count={70} />
      {note && <span className="absolute top-6 left-6 text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/70">{note}</span>}
      <FadeUp show={inView}>
        <p className="text-primary font-bold tracking-widest text-sm mb-3">EVERYDAY 연말정산</p>
        <h1 className="text-7xl font-bold recap-shimmer-text leading-none">{year}</h1>
      </FadeUp>
      <p className="mt-8 text-2xl font-bold text-white min-h-[2.5rem]">{typed}<span className="animate-pulse text-primary">|</span></p>
      {me && (
        <FadeUp show={inView} delay={2.2}>
          <p className="mt-4 text-white/60 text-sm">{me.nickname}님의 1년을 돌아볼게요</p>
        </FadeUp>
      )}
      <ScrollHint />
    </Section>
  );
}

function DaysSection({ me, year }: { me: MemberStats; year: number }) {
  const [ref, inView, round] = useInView<HTMLElement>();
  const ok = Math.round(useCountUp(me.successDays, inView, 1600));
  const fromJan = me.startDate === `${year}-01-01`;
  const burst = useLater(inView, 1700);
  return (
    <Section sectionRef={ref} replay={round} bg={BG.days}>
      <Sparkles trigger={burst} originY={0.2} count={40} />
      <FadeUp show={inView}>
        <p className="text-white/60 text-base">{fromJan ? "올해" : "가입 후"} {me.targetDays}일 중</p>
        <p className="text-6xl font-bold text-white mt-2">
          <span className="text-primary">{ok}</span>일
        </p>
        <p className="text-white/80 text-lg font-semibold mt-1">인증했어요</p>
      </FadeUp>
      <div className="mt-8 grid gap-[3px] w-full max-w-[360px]" style={{ gridTemplateColumns: "repeat(21, minmax(0, 1fr))" }}>
        {me.days.map((d, i) => (
          <div
            key={i}
            className="aspect-square rounded-full"
            style={{
              background: !inView || d === "none" ? "#1f1f1f" : d === "ok" ? "#FF6B2C" : d === "exempt" ? "#3d3d3d" : "#2e2e2e",
              boxShadow: inView && d === "ok" ? "0 0 4px rgba(255,107,44,0.6)" : "none",
              transition: `background 0.3s ease ${i * 3.5}ms, box-shadow 0.3s ease ${i * 3.5}ms`,
            }}
          />
        ))}
      </div>
      <FadeUp show={inView} delay={1.4} className="mt-4 flex gap-4 text-[11px] text-white/50">
        <span><span className="inline-block w-2 h-2 rounded-full bg-primary mr-1" />인증</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-[#2e2e2e] mr-1" />못 함</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-[#3d3d3d] mr-1" />제외일</span>
      </FadeUp>
    </Section>
  );
}

function RateSection({ me }: { me: MemberStats }) {
  const [ref, inView, round] = useInView<HTMLElement>();
  const rate = me.rate ?? 0;
  const v = useCountUp(rate * 100, inView, 1600);
  const burst = useLater(inView, 1650);
  const R = 84, C = 2 * Math.PI * R;
  const msg = rate >= 0.95 ? "거의 완벽한 한 해였어요" : rate >= 0.85 ? "정말 꾸준했어요" : rate >= 0.7 ? "흔들려도 잘 버텼어요" : "내년엔 더 잘할 수 있어요";
  return (
    <Section sectionRef={ref} replay={round} bg={BG.rate}>
      <Sparkles trigger={burst} count={80} />
      <FadeUp show={inView}><p className="text-white/60">올해 나의 성공률</p></FadeUp>
      <div className="relative mt-6 w-[220px] h-[220px]">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <circle cx="100" cy="100" r={R} fill="none" stroke="#2A2A2A" strokeWidth="14" />
          <circle
            cx="100" cy="100" r={R} fill="none" stroke="url(#rateGrad)" strokeWidth="14" strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={inView ? C * (1 - rate) : C}
            style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)" }}
          />
          <defs>
            <linearGradient id="rateGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFB07A" />
              <stop offset="100%" stopColor="#FF6B2C" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl font-bold text-white">{v.toFixed(1)}<span className="text-2xl">%</span></span>
        </div>
      </div>
      <FadeUp show={inView} delay={1.6}><p className="mt-8 text-xl font-bold text-white">{msg}</p></FadeUp>
    </Section>
  );
}

function MonthlySection({ me, group }: { me: MemberStats; group: RecapResult["group"] }) {
  const [ref, inView, round] = useInView<HTMLElement>();
  const burst = useLater(inView, 1500);
  const best = me.bestMonth;
  return (
    <Section sectionRef={ref} replay={round} bg={BG.monthly}>
      <FadeUp show={inView}>
        <p className="text-white/60">월별 성공률</p>
        {best != null && (
          <p className="text-2xl font-bold text-white mt-1">
            가장 빛난 달은 <span className="text-primary">{MONTHS[best]}</span>
          </p>
        )}
      </FadeUp>
      <div className="relative mt-10 w-full max-w-[360px] h-[220px] flex items-end gap-1.5">
        {best != null && <div className="absolute inset-0"><Sparkles trigger={burst} originY={0.1} count={40} /></div>}
        {me.monthly.map((r, i) => {
          const g = group.monthly[i];
          return (
            <div key={i} className="relative flex-1 h-full flex flex-col justify-end items-center">
              {i === best && inView && (
                <span className="absolute -top-6 text-base" style={{ animation: "recap-pop 0.6s ease 1.3s both" }}>⭐</span>
              )}
              <div className="relative w-full h-full flex items-end">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: inView && r != null ? `${Math.max(r * 100, 3)}%` : "0%",
                    background: r == null ? "transparent" : i === best ? "linear-gradient(180deg,#FFD27A,#FF6B2C)" : "#FF6B2C99",
                    transition: `height 0.9s cubic-bezier(.2,.8,.2,1) ${i * 0.08}s`,
                  }}
                />
                {g != null && (
                  <div
                    className="absolute left-0 right-0 h-[2px] bg-white/70"
                    style={{ bottom: `${g * 100}%`, opacity: inView ? 1 : 0, transition: `opacity 0.5s ease ${1.2 + i * 0.03}s` }}
                  />
                )}
              </div>
              <span className="text-[10px] text-white/50 mt-1.5">{i + 1}</span>
            </div>
          );
        })}
      </div>
      <FadeUp show={inView} delay={1.4} className="mt-4 flex gap-4 text-[11px] text-white/50">
        <span><span className="inline-block w-2 h-2 rounded-sm bg-primary mr-1" />나</span>
        <span><span className="inline-block w-3 h-[2px] bg-white/70 mr-1 align-middle" />그룹 평균</span>
      </FadeUp>
    </Section>
  );
}

function StreakSection({ me }: { me: MemberStats }) {
  const [ref, inView, round] = useInView<HTMLElement>();
  const v = Math.round(useCountUp(me.longestStreak, inView, 1500));
  const burst = useLater(inView, 1550);
  const scale = 0.5 + Math.min(1, me.longestStreak / 60) * 0.7;
  return (
    <Section sectionRef={ref} replay={round} bg={BG.streak}>
      <Sparkles trigger={burst} originY={0.35} count={60} />
      <FadeUp show={inView}><p className="text-white/60">최장 연속 인증</p></FadeUp>
      <div
        className="mt-4 text-[96px] leading-none"
        style={{
          transform: inView ? `scale(${scale})` : "scale(0.2)",
          transition: "transform 1.5s cubic-bezier(.2,.8,.2,1)",
          filter: "drop-shadow(0 0 24px rgba(255,107,44,0.7))",
        }}
      >
        🔥
      </div>
      <p className="mt-4 text-6xl font-bold text-white">{v}<span className="text-2xl ml-1">일 연속</span></p>
      <FadeUp show={inView} delay={1.5}>
        <p className="mt-4 text-white/70">
          {me.longestStreak >= 30 ? "한 달 넘게 하루도 안 쉬었어요!" : me.longestStreak >= 14 ? "2주 넘게 꾸준히 이어갔어요" : "내년엔 불꽃을 더 키워봐요"}
        </p>
      </FadeUp>
    </Section>
  );
}

function CategorySection({ me, year }: { me: MemberStats; year: number }) {
  const [ref, inView, round] = useInView<HTMLElement>();
  const burst = useLater(inView, 1300);
  const entries = Object.entries(me.categoryCounts).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  return (
    <Section sectionRef={ref} replay={round} bg={BG.category}>
      {top ? (
        <>
          <Sparkles trigger={burst} originY={0.42} count={60} />
          <FadeUp show={inView}><p className="text-white/60">가장 많이 한 활동</p></FadeUp>
          <div
            className="mt-6 px-6 py-4 rounded-3xl bg-primary/20 border-2 border-primary"
            style={{ animation: inView ? "recap-pop 0.8s ease 0.9s both" : "none", opacity: inView ? undefined : 0 }}
          >
            <p className="text-4xl font-bold text-white">{categoryLabel(top[0])}</p>
            <p className="text-primary font-bold mt-1">{top[1]}회</p>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-[340px]">
            {entries.slice(1, 8).map(([k, n], i) => (
              <span
                key={k}
                className="px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm"
                style={{ animation: inView ? `recap-drop 0.7s ease ${0.15 * i}s both` : "none", opacity: inView ? undefined : 0 }}
              >
                {categoryLabel(k)} {n}
              </span>
            ))}
          </div>
          {year === 2026 && <p className="mt-6 text-[11px] text-white/40">분류 기능이 생긴 10월 21일 이후 기준</p>}
        </>
      ) : (
        <FadeUp show={inView}>
          <p className="text-4xl">🗂️</p>
          <p className="mt-4 text-xl font-bold text-white">분류 기록이 아직 없어요</p>
          <p className="mt-2 text-white/60 text-sm">내년엔 여기서 1년 치 활동을 보여드릴게요</p>
        </FadeUp>
      )}
    </Section>
  );
}

function FineSection({ me }: { me: MemberStats }) {
  const [ref, inView, round] = useInView<HTMLElement>();
  const v = Math.round(useCountUp(me.fine, inView, 1800));
  const missed = me.targetDays - me.successDays;
  const coins = Math.min(missed, 24);
  const burst = useLater(inView && me.fine === 0, 600);
  return (
    <Section sectionRef={ref} replay={round} bg={BG.fine}>
      {me.fine === 0 && <Sparkles trigger={burst} palette="gold" count={90} />}
      <div className="absolute inset-x-0 bottom-0 h-[45%] pointer-events-none">
        {inView &&
          Array.from({ length: coins }, (_, i) => (
            <span
              key={i}
              className="absolute text-3xl"
              style={{
                left: `${8 + ((i * 37) % 84)}%`,
                bottom: `${(i * 13) % 40}%`,
                animation: `recap-coin 1.1s cubic-bezier(.3,.6,.4,1) ${0.06 * i}s both`,
              }}
            >
              🪙
            </span>
          ))}
      </div>
      <FadeUp show={inView}><p className="text-white/60">올해 낸 벌금</p></FadeUp>
      <p className="relative mt-3 text-6xl font-bold text-white">{v.toLocaleString()}<span className="text-2xl ml-1">원</span></p>
      <FadeUp show={inView} delay={1.8}>
        <p className="relative mt-4 text-white/70">
          {me.fine === 0 ? "벌금 0원! 완벽해요 ✨" : `${missed}일 빠졌어요 · 그룹에 기부해 줘서 고마워요`}
        </p>
      </FadeUp>
    </Section>
  );
}

function GroupSection({ data, nameOf }: { data: RecapResult; nameOf: (id: string) => MemberStats | undefined }) {
  const [ref, inView, round] = useInView<HTMLElement>();
  const g = data.group;
  const all = Math.round(useCountUp(g.allSuccessDays, inView, 1600));
  const burst = useLater(inView, 1700);
  const ms = data.members;
  return (
    <Section sectionRef={ref} replay={round} bg={BG.group}>
      <Sparkles trigger={burst} originY={0.3} count={60} />
      <FadeUp show={inView}><p className="text-white/60">우리 그룹 {g.memberCount}명의 1년</p></FadeUp>
      <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-[300px]">
        {ms.map((m, i) => {
          const ang = (i / ms.length) * Math.PI * 2;
          return (
            <div
              key={m.userId}
              style={{
                transform: inView ? "none" : `translate(${Math.round(Math.cos(ang) * 160)}px, ${Math.round(Math.sin(ang) * 260)}px) scale(0.4)`,
                opacity: inView ? 1 : 0,
                transition: `transform 1s cubic-bezier(.2,.8,.2,1) ${i * 0.07}s, opacity 0.6s ease ${i * 0.07}s`,
              }}
            >
              <Avatar url={nameOf(m.userId)?.avatarUrl ?? null} name={m.nickname} size={44} className="ring-2 ring-primary/60" />
            </div>
          );
        })}
      </div>
      <FadeUp show={inView} delay={0.6}>
        <p className="mt-8 text-white/70">모두가 함께 성공한 날</p>
        <p className="text-6xl font-bold text-white mt-1">
          <span className="text-primary">{all}</span>일
        </p>
        <p className="text-white/50 text-sm mt-1">{g.totalDays}일 중 {pct(g.totalDays ? g.allSuccessDays / g.totalDays : null)}</p>
      </FadeUp>
      <FadeUp show={inView} delay={1.4} className="mt-8 grid grid-cols-3 gap-2 w-full max-w-[360px]">
        <div className="bg-white/5 rounded-2xl py-3">
          <p className="text-[11px] text-white/50">그룹 성공률</p>
          <p className="text-lg font-bold text-white">{pct(g.rate)}</p>
        </div>
        <div className="bg-white/5 rounded-2xl py-3">
          <p className="text-[11px] text-white/50">그룹 총 벌금</p>
          <p className="text-lg font-bold text-white">{g.totalFine.toLocaleString()}원</p>
        </div>
        <div className="bg-white/5 rounded-2xl py-3">
          <p className="text-[11px] text-white/50">최다 활동</p>
          <p className="text-lg font-bold text-white">{g.topCategory ? categoryLabel(g.topCategory) : "-"}</p>
        </div>
      </FadeUp>
    </Section>
  );
}

function CeremonySection({ year }: { year: number }) {
  const [ref, inView, round] = useInView<HTMLElement>();
  const burst = useLater(inView, 400);
  return (
    <Section sectionRef={ref} replay={round} bg={BG.ceremony}>
      <Sparkles trigger={burst} palette="gold" count={90} />
      <FadeUp show={inView}>
        <p className="text-6xl" style={{ animation: inView ? "recap-glow 2s ease-in-out infinite" : "none" }}>🎖️</p>
        <p className="mt-6 text-sm tracking-[0.3em] text-[#f5c542] font-bold">AWARDS</p>
        <h2 className="mt-2 text-4xl font-bold recap-gold-text">{year} 올해의 상</h2>
        <p className="mt-4 text-white/60 text-sm">봉투를 눌러 수상자를 확인하세요</p>
      </FadeUp>
      <ScrollHint label="시상식 시작" />
    </Section>
  );
}

function AwardSection({
  award,
  meId,
  nameOf,
  onOpen,
  opened,
  isLast,
}: {
  award: Award;
  meId: string;
  nameOf: (id: string) => MemberStats | undefined;
  onOpen: () => void;
  opened: boolean;
  isLast: boolean;
}) {
  const [revealed, setRevealed] = useState(opened);
  const [burst, setBurst] = useState(0);
  const grand = !!award.grand;
  const mine = award.winners.includes(meId);
  const title = `올해의 ${award.title}`;

  const open = () => {
    if (revealed) return;
    setRevealed(true);
    setBurst((b) => b + 1);
    try {
      navigator.vibrate?.(grand ? [60, 40, 140] : 40);
    } catch {}
    onOpen();
  };

  return (
    <Section bg={grand ? BG.grand : BG.award}>
      {revealed && <Sparkles trigger={burst} palette={grand ? "gold" : "orange"} originY={0.4} count={grand ? 100 : 70} />}
      {revealed && grand && <Sparkles trigger={burst} mode="rain" palette="gold" count={180} />}
      {!(grand && revealed) && <p className="text-5xl leading-none">{award.emoji}</p>}
      <h2 className={`mt-4 text-[26px] leading-tight font-bold break-keep ${grand ? "recap-gold-text" : "text-white"}`}>
        {title}{josa(award.title, "은", "는")}…
      </h2>
      <p className="mt-2 text-white/50 text-[13px] break-keep">{award.criteria}</p>

      {!revealed ? (
        <button
          type="button"
          onClick={open}
          className="mt-10 relative w-[220px] h-[150px] rounded-2xl flex items-center justify-center"
          style={{
            background: grand ? "linear-gradient(135deg,#f5c542,#a8780a)" : "linear-gradient(135deg,#FF8A4C,#c4450f)",
            boxShadow: grand ? "0 0 40px rgba(255,215,0,0.45)" : "0 0 30px rgba(255,107,44,0.35)",
            animation: "recap-shake 1.6s ease-in-out infinite",
          }}
          aria-label={`${title} 봉투 열기`}
        >
          <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.25),transparent)", clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
          <span className="relative flex flex-col items-center gap-1">
            <span className="text-4xl">{grand ? "👑" : "💌"}</span>
            <span className="text-white font-bold text-sm">탭해서 열기</span>
          </span>
        </button>
      ) : (
        <div className="mt-8 flex flex-col items-center">
          {grand && (
            <div className="text-[88px] leading-none mb-4" style={{ animation: "recap-trophy 1.4s cubic-bezier(.2,.8,.2,1) both, recap-glow 2s ease-in-out 1.4s infinite" }}>
              🏆
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-4">
            {award.winners.map((id, i) => {
              const m = nameOf(id);
              return (
                <div key={id} className="flex flex-col items-center" style={{ animation: `recap-spin-in 1.1s cubic-bezier(.2,.8,.2,1) ${(grand ? 0.9 : 0) + i * 0.15}s both` }}>
                  <div className={`rounded-full p-1 ${grand ? "bg-gradient-to-br from-[#fff4c2] via-[#ffd700] to-[#a8780a]" : "bg-gradient-to-br from-[#FFD27A] to-[#FF6B2C]"}`}>
                    <Avatar url={m?.avatarUrl ?? null} name={m?.nickname ?? ""} size={award.winners.length > 1 ? 76 : 104} />
                  </div>
                  <p className={`mt-3 text-2xl font-bold ${grand ? "recap-gold-text" : "recap-shimmer-text"}`}>{m?.nickname ?? "알 수 없음"}</p>
                </div>
              );
            })}
          </div>
          {award.winners.length > 1 && <p className="mt-2 text-xs text-white/50">공동 수상</p>}
          <p
            className={`mt-4 text-xl font-bold ${grand ? "text-[#ffd700]" : "text-primary"}`}
            style={{ animation: `recap-fade-up 0.6s ease ${grand ? 1.6 : 0.8}s both` }}
          >
            {award.valueLabel}
          </p>
          {mine && (
            <span
              className="mt-5 px-4 py-1.5 rounded-full bg-white text-[#121212] font-bold text-sm"
              style={{ animation: `recap-pop 0.6s ease ${grand ? 2 : 1.1}s both` }}
            >
              🎉 축하해요!
            </span>
          )}
          {!isLast && <ScrollHint label="다음 상" />}
          {isLast && <ScrollHint label="마무리" />}
        </div>
      )}
    </Section>
  );
}

function SummarySection({
  data,
  me,
  meId,
  onSeen,
  onClose,
  isDemo,
}: {
  data: RecapResult;
  me: MemberStats | null;
  meId: string;
  onSeen: () => void;
  onClose: () => void;
  isDemo: boolean;
}) {
  const [ref, inView, round] = useInView<HTMLElement>(0.4);
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const burst = useLater(inView, 300);
  const myAwards = data.awards.filter((a) => a.winners.includes(meId));

  useEffect(() => {
    if (inView) onSeen();
  }, [inView, onSeen]);

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true, backgroundColor: "#121212" });
      const a = document.createElement("a");
      a.href = url;
      a.download = `everyday-${data.year}-연말정산.png`;
      a.click();
    } catch {
      alert("이미지 저장에 실패했어요. 화면을 캡처해 주세요!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section sectionRef={ref} replay={round} bg={BG.summary} className="!justify-start pt-14 pb-12">
      <Sparkles trigger={burst} count={70} originY={0.3} />
      <FadeUp show={inView} className="w-full flex flex-col items-center">
        <div ref={cardRef} className="w-full max-w-[340px] rounded-3xl p-6 text-left border border-white/10" style={{ background: "linear-gradient(160deg,#3b1806 0%,#1E1E1E 55%,#121212 100%)" }}>
          <p className="text-primary text-xs font-bold tracking-widest">EVERYDAY {data.year}</p>
          <p className="text-white text-2xl font-bold mt-1">{me ? `${me.nickname}의 1년` : "우리 그룹의 1년"}</p>
          {me && (
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div><p className="text-[11px] text-white/50">인증</p><p className="text-white font-bold text-lg">{me.successDays}<span className="text-sm text-white/50">/{me.targetDays}일</span></p></div>
              <div><p className="text-[11px] text-white/50">성공률</p><p className="text-white font-bold text-lg">{pct(me.rate)}</p></div>
              <div><p className="text-[11px] text-white/50">최장 연속</p><p className="text-white font-bold text-lg">{me.longestStreak}일</p></div>
              <div><p className="text-[11px] text-white/50">벌금</p><p className="text-white font-bold text-lg">{me.fine.toLocaleString()}원</p></div>
              {me.topCategory && <div className="col-span-2"><p className="text-[11px] text-white/50">가장 많이 한 활동</p><p className="text-white font-bold">{categoryLabel(me.topCategory)}</p></div>}
              {me.avgMinutes != null && <div className="col-span-2"><p className="text-[11px] text-white/50">평균 인증 시각</p><p className="text-white font-bold">{formatMinutes(me.avgMinutes)}</p></div>}
            </div>
          )}
          {myAwards.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {myAwards.map((a) => (
                <span key={a.id} className={`px-2.5 py-1 rounded-full text-xs font-bold ${a.grand ? "bg-[#ffd700] text-[#121212]" : "bg-primary/20 text-primary"}`}>
                  {a.emoji} {a.title}
                </span>
              ))}
            </div>
          )}
          <div className="mt-5 pt-4 border-t border-white/10 text-xs text-white/60">
            그룹 {data.group.memberCount}명 · 모두 성공한 날 {data.group.allSuccessDays}일 · 그룹 성공률 {pct(data.group.rate)}
          </div>
        </div>
        <div className="mt-5 w-full max-w-[340px] text-left">
          <p className="text-white/60 text-xs mb-2">올해의 상 수상자</p>
          <div className="flex flex-col gap-1.5">
            {data.awards.map((a) => (
              <p key={a.id} className="text-white/80 text-sm">
                {a.emoji} <span className="font-semibold">{a.title}</span> · {a.winners.map((id) => data.members.find((m) => m.userId === id)?.nickname ?? "").join(", ")}
              </p>
            ))}
          </div>
        </div>
        <div className="mt-6 w-full max-w-[340px] flex gap-2">
          <button type="button" onClick={save} disabled={saving} className="flex-1 bg-white/10 text-white font-bold py-3.5 rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all">
            {saving ? "저장 중..." : "이미지로 저장"}
          </button>
          <button type="button" onClick={onClose} className="flex-1 bg-primary text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all">
            {isDemo ? "닫기" : "홈으로"}
          </button>
        </div>
      </FadeUp>
    </Section>
  );
}

// ---------------- 전체 ----------------
export default function RecapView({
  data,
  meId,
  note,
  isDemo = false,
  onSeen,
  onClose,
}: {
  data: RecapResult;
  meId: string;
  note: string | null;
  isDemo?: boolean;
  onSeen: () => void;
  onClose: () => void;
}) {
  const me = data.members.find((m) => m.userId === meId && m.targetDays > 0) ?? null;
  const byId = useMemo(() => new Map(data.members.map((m) => [m.userId, m])), [data.members]);
  const nameOf = (id: string) => byId.get(id);
  const [opened, setOpened] = useState(0); // 연 봉투 수 (그 다음 섹션까지만 보여줌)
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleOpen = (i: number) => {
    setOpened((o) => Math.max(o, i + 1));
  };

  return (
    <div
      ref={scrollRef}
      className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[60] overflow-y-auto snap-y snap-mandatory bg-[#121212] overscroll-contain"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="fixed top-4 right-4 sm:right-[calc(50%-199px)] z-[70] w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white/80"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>

      <IntroSection year={data.year} me={me} note={note} />
      {me && (
        <>
          <DaysSection me={me} year={data.year} />
          <RateSection me={me} />
          <MonthlySection me={me} group={data.group} />
          <StreakSection me={me} />
          <CategorySection me={me} year={data.year} />
          <FineSection me={me} />
        </>
      )}
      <GroupSection data={data} nameOf={nameOf} />
      {data.awards.length > 0 && <CeremonySection year={data.year} />}
      {data.awards.slice(0, opened + 1).map((a, i) => (
        <AwardSection
          key={a.id}
          award={a}
          meId={meId}
          nameOf={nameOf}
          opened={i < opened}
          isLast={i === data.awards.length - 1}
          onOpen={() => handleOpen(i)}
        />
      ))}
      {opened >= data.awards.length && (
        <SummarySection data={data} me={me} meId={meId} onSeen={onSeen} onClose={onClose} isDemo={isDemo} />
      )}
    </div>
  );
}
