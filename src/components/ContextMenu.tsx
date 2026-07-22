import { useEffect } from "react";
import { useDismiss } from "../lib/useDismiss";

type MenuItem = { label: string; action: () => void; danger?: boolean };
export type MenuReq = { x: number; y: number; items: MenuItem[] };

export default function ContextMenu({
  req,
  close,
}: {
  req: MenuReq | null;
  close: () => void;
}) {
  const ref = useDismiss<HTMLDivElement>(req !== null, () =>
    ref.current?.hidePopover(),
  );

  useEffect(() => {
    if (req) ref.current?.showPopover();
  }, [req, ref]);

  if (!req) return null;
  return (
    <div
      ref={ref}
      popover="manual"
      onToggle={(e) => {
        if (e.newState === "closed") close();
      }}
      style={{ left: req.x, top: req.y }}
      className="fixed inset-auto m-0 min-w-28 rounded-md border border-ink/15 bg-surface py-1 shadow-md shadow-black/30"
    >
      {req.items.map((it) => (
        <button
          key={it.label}
          onClick={() => {
            it.action();
            ref.current?.hidePopover();
          }}
          className={`block w-full cursor-pointer px-3 py-1 text-left text-sm transition ${
            it.danger
              ? "text-red-400 hover:bg-red-400/10"
              : "text-ink/80 hover:bg-ink/10"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
