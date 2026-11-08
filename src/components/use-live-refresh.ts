"use client";

import { useEffect, useEffectEvent, useRef } from "react";

const INTERVAL_MS = 10_000;

/**
 * Calls `refresh` every 10 seconds while the tab is visible, and right away
 * when the tab regains focus, so changes from other devices show up.
 *
 * With Cache Components, Next.js keeps visited pages mounted but hidden and
 * re-runs their effects when you navigate back. We refresh at that point too,
 * so edits made on another page show up without a reload.
 */
export function useLiveRefresh(refresh: () => void) {
  const onRefresh = useEffectEvent(refresh);
  const hasMounted = useRef(false);

  useEffect(() => {
    // The first mount already has fresh server data; later runs are re-shows.
    if (hasMounted.current) onRefresh();
    hasMounted.current = true;

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
