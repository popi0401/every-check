"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import SettlementModal from "./SettlementModal";

const NO_NAV_PATHS = ["/login", "/onboarding"];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showNav =
    !NO_NAV_PATHS.includes(pathname) && !pathname.startsWith("/auth");

  return (
    <>
      {children}
      {showNav && <BottomNav />}
      {showNav && <SettlementModal />}
    </>
  );
}
