import { useCallback, useMemo, useState } from "react";
import {
  importJson,
  newId,
  thoughtKey,
  linkKey,
  tagKey,
  regionKey,
} from "./store";
import { type Data, loadData, saveData } from "./store";

export function useData() {
  const [data, setData] = useState<Data>(loadData);

  // Updates 'extra local' state with function passed in, and saves to local storage
  const update = useCallback(
    (fn: (d: Data) => Data) =>
      setData((d) => {
        const next = fn(d);
        saveData(next);
        return next;
      }),
    [],
  );

  // Created once, so memoized components (ThoughtCard) receiving these as
  // props keep the same function identities across renders
  const actions = useMemo(
    () => ({
      importBoard: (raw: string): boolean => {
        const d = importJson(raw);
        if (d === null) return false;
        setData(d);
        return true;
      },
      createThought: (x: number, y: number): string => {
        const id = newId();
        const now = Date.now();
        update((d) => ({
          ...d,
          thoughts: [
            ...d.thoughts,
            { id, x, y, text: "", createdAt: now, updatedAt: now },
          ],
        }));
        return id;
      },
      moveThought: (id: string, x: number, y: number) =>
        update((d) => ({
          ...d,
          thoughts: d.thoughts.map((t) =>
            t.id === id ? { ...t, x, y, updatedAt: Date.now() } : t,
          ),
        })),
      setThoughtText: (id: string, text: string) =>
        update((d) => ({
          ...d,
          thoughts: d.thoughts.map((t) =>
            t.id === id ? { ...t, text, updatedAt: Date.now() } : t,
          ),
        })),
      removeThought: (id: string) =>
        update((d) => {
          const now = Date.now();
          const deadLinks = d.links.filter(
            (l) => l.fromId === id || l.toId === id,
          );
          return {
            ...d,
            thoughts: d.thoughts.filter((t) => t.id !== id),
            links: d.links.filter((l) => l.fromId !== id && l.toId !== id),
            tombstones: [
              ...d.tombstones,
              { key: thoughtKey(id), deletedAt: now },
              ...deadLinks.map((l) => ({
                key: linkKey(l.fromId, l.toId),
                deletedAt: now,
              })),
            ],
          };
        }),
      commitThought: (id: string) => {
        update((d) => {
          const t = d.thoughts.find((x) => x.id === id);
          if (t && t.text.trim() === "") {
            const now = Date.now();
            const deadLinks = d.links.filter(
              (l) => l.fromId === id || l.toId === id,
            );
            return {
              ...d,
              thoughts: d.thoughts.filter((x) => x.id !== id),
              links: d.links.filter((l) => l.fromId !== id && l.toId !== id),
              tombstones: [
                ...d.tombstones,
                { key: thoughtKey(id), deletedAt: now },
                ...deadLinks.map((l) => ({
                  key: linkKey(l.fromId, l.toId),
                  deletedAt: now,
                })),
              ],
            };
          }
          return d;
        });
      },
      createLink: (fromId: string, toId: string, dx: number, dy: number) =>
        update((d) =>
          d.links.some((l) => l.fromId === fromId && l.toId === toId)
            ? d
            : {
                ...d,
                links: [
                  ...d.links,
                  { fromId, toId, dx, dy, updatedAt: Date.now() },
                ],
              },
        ),
      removeLink: (fromId: string, toId: string) =>
        update((d) => ({
          ...d,
          links: d.links.filter(
            (l) => !(l.fromId === fromId && l.toId === toId),
          ),
          tombstones: [
            ...d.tombstones,
            { key: linkKey(fromId, toId), deletedAt: Date.now() },
          ],
        })),
      createRegion: (
        tagId: string,
        x: number,
        y: number,
        w: number,
        h: number,
      ) =>
        update((d) => ({
          ...d,
          regions: [
            ...d.regions,
            { id: newId(), tagId, x, y, w, h, updatedAt: Date.now() },
          ],
        })),
      removeRegion: (id: string) =>
        update((d) => ({
          ...d,
          regions: d.regions.filter((r) => r.id !== id),
          tombstones: [
            ...d.tombstones,
            { key: regionKey(id), deletedAt: Date.now() },
          ],
        })),
      addTag: (): string => {
        const id = newId();
        update((d) => ({
          ...d,
          // TODO connect this to the lib/colors source of truth for default
          tags: [
            ...d.tags,
            {
              id,
              description: "Untitled Tag",
              color: "#9daec1",
              updatedAt: Date.now(),
            },
          ],
        }));
        return id;
      },
      setTagDescription: (id: string, description: string) =>
        update((d) => ({
          ...d,
          tags: d.tags.map((t) =>
            t.id === id ? { ...t, description, updatedAt: Date.now() } : t,
          ),
        })),
      setTagColor: (id: string, color: string) =>
        update((d) => ({
          ...d,
          tags: d.tags.map((t) =>
            t.id === id ? { ...t, color, updatedAt: Date.now() } : t,
          ),
        })),
      removeTag: (id: string) =>
        update((d) => {
          const now = Date.now();
          const deadRegions = d.regions.filter((r) => r.tagId === id);
          return {
            ...d,
            tags: d.tags.filter((t) => t.id !== id),
            regions: d.regions.filter((r) => r.tagId !== id),
            tombstones: [
              ...d.tombstones,
              { key: tagKey(id), deletedAt: now },
              ...deadRegions.map((r) => ({
                key: regionKey(r.id),
                deletedAt: now,
              })),
            ],
          };
        }),
    }),
    [update],
  );

  return { data, update, ...actions };
}
