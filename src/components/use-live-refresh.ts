"use client";

import { useEffect, useEffectEvent } from "react";

const INTERVAL_MS = 10_000;

/**
 * Calls `refresh` every 10 seconds while the tab is visible, and right away
 * when the tab regains focus, so changes from other devices show up.
 */
export function useLiveRefresh(refresh: () => void) {
  const onRefresh = useEffectEvent(refresh);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") onRefresh();
    };
    const timer = setInterval(tick, INTERVAL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
}
