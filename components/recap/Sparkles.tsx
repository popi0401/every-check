"use client";

// 스파클(4각 별) + 글리터(반짝이 조각) 파티클 — 가벼운 캔버스 구현
import { useEffect, useRef } from "react";

const PALETTES = {
  orange: ["#FF6B2C", "#FF9A5C", "#FFC9A3", "#FFFFFF", "#FFE2CF"],
  gold: ["#FFD700", "#FFE680", "#F5C542", "#FFFFFF", "#FFF4C2", "#E8B923"],
};

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; rot: number; vr: number;
  life: number; max: number; color: string;
  star: boolean; tw: number;
}

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

interface Props {
  /** 값이 바뀔 때마다 한 번 터짐 (0이면 대기) */
  trigger: number;
  mode?: "burst" | "rain";
  palette?: keyof typeof PALETTES;
  count?: number;
  /** burst 중심 (0~1, 캔버스 기준) */
  originY?: number;
  fixed?: boolean;
}

export default function Sparkles({ trigger, mode = "burst", palette = "orange", count, originY = 0.45, fixed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!trigger || prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = PALETTES[palette];
    const pick = () => colors[Math.floor(Math.random() * colors.length)];
    const n = count ?? (mode === "rain" ? 140 : 60);
    let spawned = 0;

    const spawn = (i: number): Particle => {
      const star = Math.random() < 0.45;
      if (mode === "rain") {
        return {
          x: Math.random() * w, y: -20 - Math.random() * 40,
          vx: (Math.random() - 0.5) * 0.6, vy: 1.2 + Math.random() * 2.2,
          size: star ? 4 + Math.random() * 6 : 2 + Math.random() * 4,
          rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.2,
          life: 0, max: 220 + Math.random() * 120, color: pick(), star, tw: Math.random() * 6,
        };
      }
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = 2 + Math.random() * 5.5;
      return {
        x: w / 2, y: h * originY,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5,
        size: star ? 5 + Math.random() * 8 : 2 + Math.random() * 4,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        life: 0, max: 70 + Math.random() * 60, color: pick(), star, tw: Math.random() * 6,
      };
    };

    if (mode === "burst") {
      for (let i = 0; i < n; i++) particles.current.push(spawn(i));
      spawned = n;
    }

    const drawStar = (p: Particle, alpha: number) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.star) {
        const s = p.size, k = s * 0.22;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(k, -k, s, 0);
        ctx.quadraticCurveTo(k, k, 0, s);
        ctx.quadraticCurveTo(-k, k, -s, 0);
        ctx.quadraticCurveTo(-k, -k, 0, -s);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.35;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      if (mode === "rain" && spawned < n) {
        for (let k = 0; k < 3 && spawned < n; k++) particles.current.push(spawn(spawned++));
      }
      particles.current = particles.current.filter((p) => p.life < p.max && p.y < h + 30);
      for (const p of particles.current) {
        p.life++;
        p.x += p.vx + (mode === "rain" ? Math.sin((p.life + p.tw * 10) / 18) * 0.6 : 0);
        p.y += p.vy;
        if (mode === "burst") { p.vx *= 0.96; p.vy = p.vy * 0.96 + 0.09; }
        p.rot += p.vr;
        const fade = 1 - p.life / p.max;
        const twinkle = 0.55 + 0.45 * Math.sin(p.life / 4 + p.tw);
        drawStar(p, Math.max(0, fade) * twinkle);
      }
      if (particles.current.length > 0 || (mode === "rain" && spawned < n)) {
        raf.current = requestAnimationFrame(tick);
      } else {
        raf.current = null;
      }
    };
    if (raf.current == null) raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
      particles.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`${fixed ? "fixed" : "absolute"} inset-0 w-full h-full pointer-events-none z-10`}
    />
  );
}
