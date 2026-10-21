"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-card border-t border-border z-50">
      <div
        className="flex items-center justify-around px-2"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        {/* Home */}
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 pt-3 pb-1 px-5 transition-colors ${
            pathname === "/" ? "text-primary" : "text-muted"
          }`}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={pathname === "/" ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
          <span className="text-[10px]">홈</span>
        </Link>

        {/* Calendar */}
        <Link
          href="/calendar"
          className={`flex flex-col items-center gap-1 pt-3 pb-1 px-5 transition-colors ${
            pathname === "/calendar" ? "text-primary" : "text-muted"
          }`}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect
              x="3"
              y="4"
              width="18"
              height="18"
              rx="2"
              fill={pathname === "/calendar" ? "currentColor" : "none"}
              fillOpacity={pathname === "/calendar" ? "0.15" : "0"}
            />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-[10px]">달력</span>
        </Link>

        {/* Upload — center, highlighted */}
        <Link href="/upload" className="flex flex-col items-center -mt-5 px-2">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-primary/40 transition-all active:scale-90 ${
              pathname === "/upload" ? "bg-orange-500" : "bg-primary"
            }`}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span className="text-[10px] text-muted mt-1">올리기</span>
        </Link>

        {/* Settings */}
        <Link
          href="/settings"
          className={`flex flex-col items-center gap-1 pt-3 pb-1 px-5 transition-colors ${
            pathname === "/settings" ? "text-primary" : "text-muted"
          }`}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle
              cx="12"
              cy="12"
              r="3"
              fill={pathname === "/settings" ? "currentColor" : "none"}
            />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span className="text-[10px]">설정</span>
        </Link>
      </div>
    </nav>
  );
}
