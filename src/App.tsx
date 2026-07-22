import { useState, useRef } from "react";
import { useData } from "./lib/useData";
import { fmtStamp } from "./lib/format";
import { TODO_RE } from "./lib/todos";
import TagPanel from "./components/TagPanel";
import TodoPanel from "./components/TodoPanel";
import SearchPanel from "./components/SearchPanel";
import SettingsPanel from "./components/SettingsPanel";
import Minimap from "./components/Minimap";
import ConfirmPanel from "./components/ContextMenu";
import { type Tag } from "./lib/store";
import { type MenuReq } from "./components/ContextMenu";

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

export default function App() {
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const drag = useRef<{ px: number; py: number; moved: boolean } | null>(null);
  const pan = useRef<{ px: number; py: number } | null>(null);

  const [linkFrom, setLinkFrom] = useState<{
    id: number;
    dx: number;
    dy: number;
  } | null>(null);

  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  const [regionDraft, setRegionDraft] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const [menuReq, setMenuReq] = useState<MenuReq | null>(null);

  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.5 });
  const flyRaf = useRef<number | null>(null);

  const stopFly = () => {
    if (flyRaf.current !== null) cancelAnimationFrame(flyRaf.current);
    flyRaf.current = null;
  };

  const glideTo = (to: { x: number; y: number; zoom: number }) => {
    const from = camera;
    stopFly();
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 350);
      const e = 1 - (1 - p) ** 3;
      setCamera({
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        zoom: from.zoom + (to.zoom - from.zoom) * e,
      });
      flyRaf.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    flyRaf.current = requestAnimationFrame(step);
  };

  const {
    data,
    importBoard,
    createThought,
    moveThought,
    setThoughtText,
    removeThought,
    commitThought,
    createLink,
    removeLink,
    createRegion,
    removeRegion,
    addTag,
    setTagDescription,
    setTagColor,
    removeTag,
  } = useData();

  const draftRect = regionDraft && {
    x: Math.min(regionDraft.x1, regionDraft.x2),
    y: Math.min(regionDraft.y1, regionDraft.y2),
    w: Math.abs(regionDraft.x2 - regionDraft.x1),
    h: Math.abs(regionDraft.y2 - regionDraft.y1),
  };

  const screenToWorld = (sx: number, sy: number) => ({
    x: sx / camera.zoom + camera.x,
    y: sy / camera.zoom + camera.y,
  });

  const flyTo = (wx: number, wy: number, zoom = 1.4) =>
    glideTo({
      zoom,
      x: wx - window.innerWidth / 2 / zoom,
      y: wy - window.innerHeight / 2 / zoom,
    });

  return (
    <main
      className={`relative w-screen h-screen overflow-hidden bg-board select-none ${selectedTag ? "cursor-crosshair" : ""}`}
      onDoubleClick={(e) => {
        if (e.target !== e.currentTarget) return; // Ignore double clicks on thoughts
        const rect = e.currentTarget.getBoundingClientRect();
        const { x, y } = screenToWorld(
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
        const id = createThought(x, y);
        setFocusedId(id);
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (e.target !== e.currentTarget) return;
        if (linkFrom !== null) {
          setLinkFrom(null);
          return;
        }
        if (selectedTag !== null) {
          e.currentTarget.setPointerCapture(e.pointerId);
          const { x, y } = screenToWorld(e.clientX, e.clientY);
          setRegionDraft({ x1: x, y1: y, x2: x, y2: y });
          return;
        }
        pan.current = { px: e.clientX, py: e.clientY };
      }}
      onPointerMove={(e) => {
        if (regionDraft !== null) {
          const { x, y } = screenToWorld(e.clientX, e.clientY);
          setRegionDraft((prev) => {
            if (prev !== null) return { ...prev, x2: x, y2: y };
            else return prev;
          });
          return;
        }
        if (pan.current === null) return;
        const dx = e.clientX - pan.current.px;
        const dy = e.clientY - pan.current.py;
        setCamera((c) => ({
          ...c,
          x: c.x - dx / c.zoom,
          y: c.y - dy / c.zoom,
        }));
        pan.current = { px: e.clientX, py: e.clientY };
      }}
      onPointerUp={() => {
        if (regionDraft !== null) {
          if (selectedTag && draftRect && draftRect.w > 8 && draftRect.h > 8)
            createRegion(
              selectedTag.id,
              draftRect.x,
              draftRect.y,
              draftRect.w,
              draftRect.h,
            );
          setSelectedTag(null);
          setRegionDraft(null);
          return;
        }
        pan.current = null;
      }}
      onWheel={(e) => {
        const factor = Math.exp(-e.deltaY * 0.002);
        const newZoom = Math.max(0.25, Math.min(camera.zoom * factor, 4));
        setCamera((c) => ({
          zoom: newZoom,
          x: e.clientX / c.zoom + c.x - e.clientX / newZoom,
          y: e.clientY / c.zoom + c.y - e.clientY / newZoom,
        }));
      }}
      onContextMenu={(e) => {
        if (e.target !== e.currentTarget) return;
        const p = screenToWorld(e.clientX, e.clientY);
        const hit = [...data.regions]
          .reverse()
          .find(
            (r) =>
              p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
          );
        if (hit === undefined) return;
        e.preventDefault();
        setMenuReq({
          x: e.clientX,
          y: e.clientY,
          items: [
            {
              label: "Delete Region",
              action: () => removeRegion(hit.id),
              danger: true,
            },
          ],
        });
      }}
    >
      <button
        className="absolute bottom-3 left-3 z-10 text-ink/40"
        onClick={() => flyTo(0, 0)}
      >
        origin
      </button>
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `scale(${camera.zoom}) translate(${-camera.x}px, ${-camera.y}px)`,
        }}
      >
        {data.regions.map((r) => {
          const tag = data.tags.find((t) => t.id === r.tagId);
          if (tag === undefined) return;
          return (
            <div
              key={r.id}
              aria-hidden
              className="pointer-events-none absolute rounded-2xl"
              style={{
                left: r.x,
                top: r.y,
                width: r.w,
                height: r.h,
                backgroundColor: tag.color + "4d",
              }}
            />
          );
        })}
        {draftRect && selectedTag && (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-2xl"
            style={{
              left: draftRect.x,
              top: draftRect.y,
              width: draftRect.w,
              height: draftRect.h,
              backgroundColor: selectedTag.color + "4d",
            }}
          />
        )}
        <svg
          width={1}
          height={1}
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
        >
          {data.links.map((l) => {
            const fromThought = data.thoughts.find((t) => t.id === l.fromId);
            const toThought = data.thoughts.find((t) => t.id === l.toId);
            if (fromThought === undefined || toThought === undefined)
              return null;

            const from = { x: fromThought.x + l.dx, y: fromThought.y + l.dy };
            const to = { x: toThought.x, y: toThought.y };

            const k = Math.min(120, Math.max(24, Math.abs(to.x - from.x) / 2));
            const d = `M ${from.x} ${from.y} C ${from.x + k} ${from.y}, ${to.x - k} ${to.y}, ${to.x} ${to.y}`;
            return (
              <g key={`${l.fromId}-${l.toId}`} className="group">
                <path
                  d={d}
                  fill="none"
                  strokeWidth={1}
                  strokeLinecap="round"
                  strokeDasharray="4 6"
                  className="stroke-ink/60 transition group-hover:stroke-ink"
                />
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  className="pointer-events-auto cursor-pointer"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenuReq({
                      x: e.clientX,
                      y: e.clientY,
                      items: [
                        {
                          label: "Delete Link",
                          action: () => removeLink(l.fromId, l.toId),
                          danger: true,
                        },
                      ],
                    });
                  }}
                />
              </g>
            );
          })}
        </svg>
        {data.thoughts.map((t) => (
          <div
            key={t.id}
            style={{ transform: `translate(${t.x}px, ${t.y}px)` }}
            className={`absolute left-0 top-0 origin-top-left
              ${focusedId === t.id ? "" : "cursor-grab active:cursor-grabbing"}
              ${linkFrom === null ? "" : "cursor-crosshair"}`}
            onPointerDown={(e) => {
              if (linkFrom !== null) {
                if (linkFrom.id !== t.id)
                  createLink(linkFrom.id, t.id, linkFrom.dx, linkFrom.dy);
                setLinkFrom(null);
                return; // No drag, no capture
              }
              if (focusedId === t.id) return;
              e.currentTarget.setPointerCapture(e.pointerId); // Route future point events to this div so cursor cant outrun it
              drag.current = { px: e.clientX, py: e.clientY, moved: false };
            }}
            onPointerMove={(e) => {
              if (drag.current === null) return;
              const dx = e.clientX - drag.current.px;
              const dy = e.clientY - drag.current.py;
              if (!drag.current.moved && Math.hypot(dx, dy) < 4) return;
              moveThought(t.id, t.x + dx / camera.zoom, t.y + dy / camera.zoom);
              drag.current = { px: e.clientX, py: e.clientY, moved: true };
            }}
            onPointerUp={(e) => {
              if (drag.current && !drag.current.moved) {
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
                  ${focusedId === t.id ? "pointer-events-auto" : "pointer-events-none"}`}
                autoFocus={focusedId === t.id}
                placeholder={"..."}
                wrap="off"
              />
            </div>
          </div>
        ))}
      </div>
      <TagPanel
        tags={data.tags}
        setSelectedTag={setSelectedTag}
        addTag={addTag}
        removeTag={removeTag}
        setTagDescription={setTagDescription}
        setTagColor={setTagColor}
        selectedTag={selectedTag}
      />
      <TodoPanel
        thoughts={data.thoughts}
        setThoughtText={setThoughtText}
        flyTo={flyTo}
      />
      <SearchPanel thoughts={data.thoughts} flyTo={flyTo} />
      <SettingsPanel data={data} importBoard={importBoard} />
      <Minimap
        thoughts={data.thoughts}
        regions={data.regions}
        tags={data.tags}
        camera={camera}
      />
      <ConfirmPanel req={menuReq} close={() => setMenuReq(null)} />
    </main>
  );
}
