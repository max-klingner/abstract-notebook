import { useMemo, useRef } from "react";

const HOLD_MS = 450;
const DRIFT_PX = 8; // finger jitter allowed before the hold is canceled

// works for both React and native pointer events — we only need these fields
type PressEvent = { clientX: number; clientY: number; pointerType: string };

// Long-press ("touch right-click") detection.
// begin() from onPointerDown with what should happen when the hold fires,
// move() from onPointerMove, end() from onPointerUp / onPointerCancel.
export function useLongPress() {
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);

  // one object created once, so memoized components can take it as a prop
  // without their prop equality breaking every render
  return useMemo(() => {
    const end = () => {
      if (hold.current !== null) clearTimeout(hold.current.timer);
      hold.current = null;
    };

    const begin = (e: PressEvent, fire: () => void) => {
      if (e.pointerType !== "touch") return; // mouse keeps its real right-click
      end();
      hold.current = {
        x: e.clientX,
        y: e.clientY,
        timer: window.setTimeout(() => {
          hold.current = null;
          fire();
        }, HOLD_MS),
      };
    };

    const move = (e: PressEvent) => {
      if (hold.current === null) return;
      const drift = Math.hypot(
        e.clientX - hold.current.x,
        e.clientY - hold.current.y,
      );
      if (drift > DRIFT_PX) end();
    };

    return { begin, move, end };
  }, []);
}

export type LongPress = ReturnType<typeof useLongPress>;
