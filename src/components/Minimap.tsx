import { useEffect, useState } from "react";
import { collectTodos } from "../lib/todos";
import { type Thought, type Region, type Tag } from "../lib/store";

// rough world-size estimate for a thought: menlo text-sm metrics plus box padding.
// only the minimap needs sizes, so an estimate beats measuring the DOM
const approxBox = (t: Thought) => {
  const lines = t.text.split("\n");
  const longest = lines.reduce((n, l) => Math.max(n, l.length), 0);
  return { w: Math.max(112, longest * 8.4 + 28), h: lines.length * 20 + 42 };
};

export default function Minimap({
  thoughts,
  regions,
  tags,
  camera,
}: {
  thoughts: Thought[];
  regions: Region[];
  tags: Tag[];
  camera: { x: number; y: number; zoom: number };
}) {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () =>
      setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const view = {
    x: camera.x,
    y: camera.y,
    w: vp.w / camera.zoom,
    h: vp.h / camera.zoom,
  };

  let minX = view.x;
  let minY = view.y;
  let maxX = view.x + view.w;
  let maxY = view.y + view.h;
  for (const r of regions) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  for (const t of thoughts) {
    const b = approxBox(t);
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + b.w);
    maxY = Math.max(maxY, t.y + b.h);
  }
  const pad = Math.max(maxX - minX, maxY - minY) * 0.03;
  const bb = {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };

  const colorOf = (tagId: number) =>
    tags.find((t) => t.id === tagId)?.color ?? "#9daec1";

  const openTodoIds = new Set(
    collectTodos(thoughts)
      .filter((td) => !td.done)
      .map((td) => td.thoughtId),
  );

  return (
    <div
      className="absolute right-3 bottom-3 sm:top-3 sm:bottom-auto z-10 h-20 w-32
      sm:h-28 sm:w-44 overflow-hidden rounded-md border border-ink/15
      bg-board shadow-sm shadow-black/30"
    >
      <svg
        viewBox={`${bb.x} ${bb.y} ${bb.w} ${bb.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        {regions.map((r) => (
          <rect
            key={`r${r.id}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            stroke={colorOf(r.tagId)}
            strokeWidth={0.5}
            strokeOpacity={0.8}
            style={{
              fill: `color-mix(in srgb, ${colorOf(r.tagId)} 22%, var(--color-board))`,
            }}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {thoughts.map((t) => {
          const b = approxBox(t);
          return (
            <rect
              key={`t${t.id}`}
              x={t.x}
              y={t.y}
              width={b.w}
              height={b.h}
              fill="var(--color-ink)"
              fillOpacity={0.55}
            />
          );
        })}
        {thoughts
          .filter((t) => openTodoIds.has(t.id))
          .map((t) => {
            const b = approxBox(t);
            return (
              <circle
                key={`todo${t.id}`}
                cx={t.x + b.w / 2}
                cy={t.y + b.h / 2}
                r={Math.max(bb.w, bb.h) * 0.01}
                fill="var(--color-gold)"
                fillOpacity={0.95}
              />
            );
          })}
        <rect
          x={view.x}
          y={view.y}
          width={view.w}
          height={view.h}
          fill="var(--color-ink)"
          fillOpacity={0.08}
          stroke="var(--color-ink)"
          strokeOpacity={0.7}
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
