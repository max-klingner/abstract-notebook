import { useState, useRef } from "react";
import { useData } from "./lib/useData";
import { useLongPress } from "./lib/useLongPress";
import TagPanel from "./components/TagPanel";
import TodoPanel from "./components/TodoPanel";
import SearchPanel from "./components/SearchPanel";
import SettingsPanel from "./components/SettingsPanel";
import Minimap from "./components/Minimap";
import ContextMenu from "./components/ContextMenu";
import ThoughtCard, { type DragState } from "./components/ThoughtCard";
import { type Tag } from "./lib/store";
import { type MenuReq } from "./components/ContextMenu";

export default function App() {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const drag = useRef<DragState | null>(null);
  const pan = useRef<{ px: number; py: number } | null>(null);
  const touches = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lp = useLongPress();

  const [linkFrom, setLinkFrom] = useState<{
    id: string;
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
  // mirror of camera.zoom for ThoughtCard's drag math — reading zoom through
  // a ref keeps camera changes from re-rendering every memoized card
  const zoomRef = useRef(camera.zoom);
  zoomRef.current = camera.zoom;
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
    syncNow,
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
      className={`touch-none relative w-screen h-dvh overflow-hidden bg-board select-none ${selectedTag ? "cursor-crosshair" : ""}`}
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
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        e.currentTarget.setPointerCapture(e.pointerId);
        if (touches.current.size === 2) {
          pan.current = null;
          lp.end(); // second finger means pinch, not hold
          return;
        }
        pan.current = { px: e.clientX, py: e.clientY };
        const { clientX, clientY, pointerId } = e;
        lp.begin(e, () => {
          pan.current = null;
          touches.current.delete(pointerId); // this finger is now the menu's, not the camera's
          const p = screenToWorld(clientX, clientY);
          const hit = [...data.regions]
            .reverse()
            .find(
              (r) =>
                p.x >= r.x &&
                p.x <= r.x + r.w &&
                p.y >= r.y &&
                p.y <= r.y + r.h,
            );
          setMenuReq({
            x: clientX,
            y: clientY,
            items: hit
              ? [
                  {
                    label: "Delete Region",
                    action: () => removeRegion(hit.id),
                    danger: true,
                  },
                ]
              : [
                  {
                    label: "New thought here",
                    action: () => {
                      const id = createThought(p.x, p.y);
                      setFocusedId(id);
                    },
                  },
                ],
          });
        });
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
        if (!touches.current.has(e.pointerId)) return;
        lp.move(e);
        if (touches.current.size === 2) {
          const [a, b] = [...touches.current.values()];
          const oldDist = Math.hypot(a.x - b.x, a.y - b.y);
          const oldMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

          touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

          const [a2, b2] = [...touches.current.values()];
          const newDist = Math.hypot(a2.x - b2.x, a2.y - b2.y);
          const newMid = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };

          if (oldDist === 0) return;

          const newZoom = Math.max(
            0.25,
            Math.min(camera.zoom * (newDist / oldDist), 4),
          );
          setCamera((c) => ({
            zoom: newZoom,
            x: oldMid.x / c.zoom + c.x - newMid.x / newZoom,
            y: oldMid.y / c.zoom + c.y - newMid.y / newZoom,
          }));
          return;
        }
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
      onPointerUp={(e) => {
        lp.end();
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
        touches.current.delete(e.pointerId);
        const rest = [...touches.current.values()];
        pan.current =
          rest.length === 1 ? { px: rest[0].x, py: rest[0].y } : null;
      }}
      onPointerCancel={(e) => {
        lp.end();
        touches.current.delete(e.pointerId);
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
          vectorEffect="non-scaling-stroke"
          className="pointer-events-none absolute left-0 top-0 overflow-visible pointer-coarse:[stroke-widht:2rem]"
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
                  vectorEffect="non-scaling-stroke"
                  className="pointer-events-auto cursor-pointer pointer-coarse:stroke-[2rem]"
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
                  onPointerDown={(e) => {
                    if (e.pointerType !== "touch") return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const { clientX, clientY } = e;
                    lp.begin(e, () =>
                      setMenuReq({
                        x: clientX,
                        y: clientY,
                        items: [
                          {
                            label: "Delete Link",
                            action: () => removeLink(l.fromId, l.toId),
                            danger: true,
                          },
                        ],
                      }),
                    );
                  }}
                  onPointerMove={(e) => lp.move(e)}
                  onPointerUp={() => lp.end()}
                />
              </g>
            );
          })}
        </svg>
        {data.thoughts.map((t) => (
          <ThoughtCard
            key={t.id}
            t={t}
            focused={focusedId === t.id}
            linkFrom={linkFrom}
            drag={drag}
            zoomRef={zoomRef}
            lp={lp}
            moveThought={moveThought}
            setThoughtText={setThoughtText}
            removeThought={removeThought}
            commitThought={commitThought}
            createLink={createLink}
            setFocusedId={setFocusedId}
            setLinkFrom={setLinkFrom}
            setMenuReq={setMenuReq}
          />
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
      <SettingsPanel data={data} syncNow={syncNow} importBoard={importBoard} />
      <Minimap
        thoughts={data.thoughts}
        regions={data.regions}
        tags={data.tags}
        camera={camera}
      />
      <ContextMenu req={menuReq} close={() => setMenuReq(null)} />
    </main>
  );
}
