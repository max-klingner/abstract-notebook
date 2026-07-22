import { useState, useEffect, useRef } from "react";
import { type Thought } from "../lib/store";

export default function SearchPanel({
  thoughts,
  flyTo,
}: {
  thoughts: Thought[];
  flyTo: (wx: number, wy: number, zoom: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const panelRef = useRef<HTMLDivElement>(null); // ref={panelRef} on the popover div

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const panel = panelRef.current;
        if (!panel) return;
        if (panel.matches(":popover-open")) {
          inputRef.current?.focus();
          inputRef.current?.select();
        } else {
          panel.showPopover();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q
    ? thoughts.filter((t) => t.text.toLowerCase().includes(q))
    : [];

  const CHAR_W = 8.4; // Menlo advance width at 14px (0.6em)
  const LINE_H = 20; // text-sm line height
  const PAD_X = 16; // the textarea's pl-4
  const PAD_Y = 8; // its py-2
  const HEADER_H = 22; // the timestamp h3 above the text
  const goTo = (t: Thought) => {
    const i = t.text.toLowerCase().indexOf(q);
    if (i < 0) return flyTo(t.x + 60, t.y + 30, 1.4); // shouldn't happen, but land somewhere sane
    const before = t.text.slice(0, i);
    const line = before.match(/\n/g)?.length ?? 0;
    const col = i - (before.lastIndexOf("\n") + 1);
    flyTo(
      t.x + PAD_X + (col + q.length / 2) * CHAR_W,
      t.y + HEADER_H + PAD_Y + (line + 0.5) * LINE_H,
      1.4,
    );
  };
  const cycle = (dir: 1 | -1) => {
    if (!matches.length) return;
    const next = (index + dir + matches.length) % matches.length;
    setIndex(next);
    goTo(matches[next]);
  };

  return (
    <div onWheel={(e) => e.stopPropagation()}>
      <button
        popoverTarget="search-panel"
        className="absolute left-[calc(50%+3rem)] top-3 z-10 -translate-x-1/2 cursor-pointer rounded-md
        bg-accent p-2 text-surface transition hover:bg-accent/80 shadow-sm shadow-black/30"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-5"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
      </button>
      <div
        ref={panelRef}
        id="search-panel"
        popover="auto"
        onToggle={(e) => {
          if (e.newState === "open") {
            inputRef.current?.focus();
            inputRef.current?.select();
          }
        }}
        className="fixed inset-auto top-3 left-[calc(50%+3rem)] m-0 -translate-x-4.5 open:flex items-center gap-2
        rounded-md border border-ink/15 bg-surface px-3 py-1.5 shadow-md shadow-black/30"
      >
        <input
          ref={inputRef}
          value={query}
          placeholder="search…"
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setIndex(0);
            const nq = v.trim().toLowerCase();
            const first = nq
              ? thoughts.find((t) => t.text.toLowerCase().includes(nq))
              : undefined;
            if (first) goTo(first);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              cycle(e.shiftKey ? -1 : 1);
            }
          }}
          className="w-48 select-text bg-transparent font-mono text-sm text-ink/90 outline-none placeholder:text-ink/30"
        />
        <span className="w-8 text-right font-mono text-xs tabular-nums text-ink/40">
          {q ? `${matches.length ? index + 1 : 0}/${matches.length}` : ""}
        </span>
      </div>
    </div>
  );
}
