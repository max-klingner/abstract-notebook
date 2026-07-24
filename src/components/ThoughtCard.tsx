import { memo, type Dispatch, type RefObject, type SetStateAction } from "react";
import { fmtStamp } from "../lib/format";
import { TODO_RE } from "../lib/todos";
import { type Thought } from "../lib/store";
import { type MenuReq } from "./ContextMenu";
import { type LongPress } from "../lib/useLongPress";

export type DragState = { id: number; px: number; py: number; moved: boolean };
export type LinkDraft = { id: string; dx: number; dy: number };

const todoBackdrop = (text: string) =>
  text.split("\n").flatMap((line, i) => {
    const m = TODO_RE.exec(line);
    const nl = i > 0 ? ["\n"] : [];
    if (!m) return [...nl, line];
    return [
      ...nl,
      line.slice(0, m.index),
      <mark
        key={i}
        className={`rounded-sm text-transparent ${m[0].endsWith("✓") ? "bg-green/25" : "bg-gold/35"}`}
      >
        {m[0]}
      </mark>,
      line.slice(m.index + m[0].length),
    ];
  });

// memo: cards skip re-rendering while the camera moves or other thoughts
// change — all props except `t`, `focused` and `linkFrom` must stay
// identity-stable across App renders for that to hold
export default memo(function ThoughtCard({
  t,
  focused,
  linkFrom,
  drag,
  zoomRef,
  lp,
  moveThought,
  setThoughtText,
  removeThought,
  commitThought,
  createLink,
  setFocusedId,
  setLinkFrom,
  setMenuReq,
}: {
  t: Thought;
  focused: boolean;
  linkFrom: LinkDraft | null;
  drag: RefObject<DragState | null>;
  zoomRef: RefObject<number>;
  lp: LongPress;
  moveThought: (id: string, x: number, y: number) => void;
  setThoughtText: (id: string, text: string) => void;
  removeThought: (id: string) => void;
  commitThought: (id: string) => void;
  createLink: (fromId: string, toId: string, dx: number, dy: number) => void;
  setFocusedId: (id: string | null) => void;
  setLinkFrom: (l: LinkDraft | null) => void;
  setMenuReq: Dispatch<SetStateAction<MenuReq | null>>;
}) {
  return (
    <div
      style={{ transform: `translate(${t.x}px, ${t.y}px)` }}
      className={`absolute left-0 top-0 origin-top-left
        ${focused ? "" : "cursor-grab active:cursor-grabbing"}
        ${linkFrom === null ? "" : "cursor-crosshair"}`}
      onPointerDown={(e) => {
        if (linkFrom !== null) {
          if (linkFrom.id !== t.id)
            createLink(linkFrom.id, t.id, linkFrom.dx, linkFrom.dy);
          setLinkFrom(null);
          return; // No drag, no capture
        }
        if (focused) return;
        if (drag.current !== null) return;
        e.currentTarget.setPointerCapture(e.pointerId); // Route future point events to this div so cursor cant outrun it
        drag.current = {
          id: e.pointerId,
          px: e.clientX,
          py: e.clientY,
          moved: false,
        };
        const el = e.currentTarget;
        const { clientX, clientY } = e;
        lp.begin(e, () => {
          if (drag.current?.moved) return; // became a drag, no menu
          drag.current = null; // stop from turning into drag on release
          setMenuReq({
            x: clientX,
            y: clientY,
            items: [
              {
                label: "Link from here",
                action: () =>
                  setLinkFrom({
                    id: t.id,
                    dx: el.offsetWidth,
                    dy: el.offsetHeight,
                  }),
              },
              {
                label: "Delete thought",
                action: () => removeThought(t.id),
                danger: true,
              },
            ],
          });
        });
      }}
      onPointerMove={(e) => {
        lp.move(e);
        if (drag.current === null || drag.current.id !== e.pointerId) return;
        const dx = e.clientX - drag.current.px;
        const dy = e.clientY - drag.current.py;
        if (!drag.current.moved && Math.hypot(dx, dy) < 4) return;
        moveThought(
          t.id,
          t.x + dx / zoomRef.current,
          t.y + dy / zoomRef.current,
        );
        drag.current = {
          id: e.pointerId,
          px: e.clientX,
          py: e.clientY,
          moved: true,
        };
      }}
      onPointerUp={(e) => {
        lp.end();
        if (drag.current === null || drag.current.id !== e.pointerId) return;
        if (!drag.current.moved) {
          setFocusedId(t.id);
          e.currentTarget.querySelector("textarea")?.focus();
        }
        drag.current = null;
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const dx = e.currentTarget.offsetWidth;
        const dy = e.currentTarget.offsetHeight;
        setMenuReq({
          x: e.clientX,
          y: e.clientY,
          items: [
            {
              label: "Link from here",
              action: () => setLinkFrom({ id: t.id, dx, dy }),
            },
            {
              label: "Delete thought",
              action: () => removeThought(t.id),
              danger: true,
            },
          ],
        });
      }}
    >
      <h3 className="px-2 py-0.5 font-mono text-[0.625rem] tabular-nums text-ink">
        {fmtStamp(t.createdAt)}
      </h3>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 select-none whitespace-pre py-2 pl-4 pr-3 font-note text-sm text-transparent"
        >
          {todoBackdrop(t.text)}
        </div>
        <textarea
          value={t.text}
          onChange={(e) => setThoughtText(t.id, e.target.value)}
          onBlur={() => {
            commitThought(t.id);
            setFocusedId(null);
          }}
          className={`field-sizing-content min-w-28 resize-none overflow-hidden bg-transparent py-2 pl-4 pr-3
            font-note text-sm text-ink/90 outline-none placeholder:text-ink/30 relative
            ${focused ? "pointer-events-auto" : "pointer-events-none"}`}
          autoFocus={focused}
          placeholder={"..."}
          wrap="off"
        />
      </div>
    </div>
  );
});
