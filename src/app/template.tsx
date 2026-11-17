"use client";

import { useIsLowEndDevice } from "@/lib/useDeviceTier";

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const isLowEnd = useIsLowEndDevice();

  return (
    <div className={isLowEnd ? "" : "animate-page-enter"}>
      {children}
    </div>
  );
}
