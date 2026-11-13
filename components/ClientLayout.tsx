"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import BottomNav from "./BottomNav";
import SettlementModal from "./SettlementModal";
import { pendingRecapYear } from "@/lib/recapSeen";

const NO_NAV_PATHS = ["/login", "/onboarding"];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const showNav =
    !NO_NAV_PATHS.includes(pathname) &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/recap");

  // 1월에 홈에 처음 들어오면 지난해 연말정산을 먼저 보여줌 (한 번만)
  useEffect(() => {
    if (pathname !== "/") return;
    let cancelled = false;
    pendingRecapYear().then((y) => {
      if (!cancelled && y) router.push(`/recap?year=${y}`);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return (
    <>
      {children}
      {showNav && <BottomNav />}
      {showNav && <SettlementModal />}
    </>
  );
}
