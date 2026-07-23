import { useState } from "react";
import ColorSelect from "./ColorSelect";
import ContextMenu from "./ContextMenu";
import { type Tag } from "../lib/store";
import { type MenuReq } from "./ContextMenu";

export default function TagPanel({
  tags,
  setSelectedTag,
  addTag,
  removeTag,
  setTagDescription,
  setTagColor,
  selectedTag,
}: {
  tags: Tag[];
  setSelectedTag: (tag: Tag | null) => void;
  addTag: () => void;
  removeTag: (id: number) => void;
  setTagDescription: (id: number, description: string) => void;
  setTagColor: (id: number, color: string) => void;
  selectedTag: Tag | null;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);

  const [menuReq, setMenuReq] = useState<MenuReq | null>(null);

  return (
    <div onWheel={(e) => e.stopPropagation()}>
      <button
        popoverTarget="tag-panel"
        onClick={(e) => {
          if (selectedTag) {
            e.preventDefault();
            setSelectedTag(null);
          }
        }}
        className="absolute left-1/2 top-3 -translate-x-1/2 z-10 cursor-pointer rounded-md p-2
        transition hover:bg-accent/80 bg-accent text-surface shadow-sm shadow-black/30"
        style={{
          backgroundColor: selectedTag === null ? undefined : selectedTag.color,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
        >
          <path d="M13.6 6L20 12l-6.4 6H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
        </svg>
      </button>

      <div
        id="tag-panel"
        popover="auto"
        onToggle={(e) => {
          if (e.newState === "closed") setEditingId(null);
        }}
        className="fixed inset-auto top-13 sm:top-3 left-1/2 m-0 -translate-x-1/2 open:flex flex-col gap-1
        rounded-md border border-ink/15 bg-surface p-2 shadow-md shadow-black/30"
      >
        {tags.map((t) => (
          <div key={t.id} className="flex flex-col gap-1">
            <div className="group flex items-center gap-1">
              <button
                className="flex cursor-pointer items-center gap-2 px-2 py-1 font-mono text-xs text-ink/80 whitespace-nowrap"
                onClick={() => {
                  if (editingId !== t.id) setSelectedTag(t);
                }}
                popoverTarget={editingId === t.id ? undefined : "tag-panel"}
                popoverTargetAction="hide"
              >
                <span
                  className="h-3 w-3 rounded-full border border-ink"
                  style={{ backgroundColor: t.color }}
                />
                {editingId === t.id ? (
                  <input
                    autoFocus
                    value={t.description}
                    onChange={(e) => setTagDescription(t.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="w-24 bg-transparent font-mono text-xs text-ink outline-none select-text"
                  />
                ) : (
                  <span>{t.description}</span>
                )}
              </button>
              <button
                onClick={() => setEditingId(t.id)}
                className="ml-auto cursor-pointer pointer-coarse:px-2 pointer-coarse:opacity-100 pointer-coarse:text-[1.8rem] pointer-coarse:leading-none text-ink/40 opacity-30 transition group-hover:opacity-100 hover:text-ink"
              >
                ✎
              </button>
              <button
                onClick={(e) => {
                  setMenuReq({
                    x: e.clientX,
                    y: e.clientY,
                    items: [
                      {
                        label: "Confirm Delete",
                        action: () => {
                          if (selectedTag?.id === t.id) setSelectedTag(null);
                          removeTag(t.id);
                        },
                        danger: true,
                      },
                    ],
                  });
                }}
                className="cursor-pointer text-ink/40 text-xs pl-1 opacity-50 transition group-hover:opacity-100 hover:text-red-400 pointer-coarse:opacity-100 pointer-coarse:px-2 pointer-coarse:text-[1.8rem] pointer-coarse:leading-none"
              >
                ✕
              </button>
            </div>
            {editingId === t.id && (
              <ColorSelect tagId={t.id} setTagColor={setTagColor} />
            )}
          </div>
        ))}
        <button onClick={addTag} className="cursor-pointer text-ink">
          +
        </button>
      </div>
      <ContextMenu req={menuReq} close={() => setMenuReq(null)} />
    </div>
  );
}
