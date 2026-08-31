import { useState, useRef } from "react";

export function usePullToRefresh(onRefresh) {
  const [pulling, setPulling]    = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const active = useRef(false);

  const THRESHOLD = 60;
  const MAX_PULL = 80;

  const onTouchStart = (e) => {
    if (e.currentTarget.scrollTop <= 0 && !refreshing) {
      startY.current = e.touches[0].clientY;
      active.current = true;
    }
  };
  const onTouchMove = (e) => {
    if (!active.current || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPulling(Math.min(dy * 0.45, MAX_PULL));
    } else {
      active.current = false;
      setPulling(0);
    }
  };

  const onTouchEnd = async () => {
    if (!active.current) return;
    active.current = false;
    if (pulling >= THRESHOLD) {
      setRefreshing(true);
      setPulling(THRESHOLD);
      try { await onRefresh(); } finally {
        setRefreshing(false);
        setPulling(0);
      }
    } else {
      setPulling(0);
    }
  };

  return {
    pulling,
    refreshing,
    ready: pulling >= THRESHOLD,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
