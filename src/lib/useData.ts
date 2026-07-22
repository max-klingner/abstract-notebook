import { useState } from "react";
import { importJson } from "./store";
import { type Data, loadData, saveData } from "./store";

export function useData() {
  const [data, setData] = useState<Data>(loadData);

  // Updates 'extra local' state with function passed in, and saves to local storage
  const update = (fn: (d: Data) => Data) =>
    setData((d) => {
      const next = fn(d);
      saveData(next);
      return next;
    });
  
  const importBoard = (raw: string): boolean => {
    const d = importJson(raw);
    if (d === null) return false;
    setData(d);
    return true;
  }

  const createThought = (x: number, y: number) => {
    const id = data.nextId;
    update((d) => ({
      ...d,
      nextId: d.nextId + 1,
      thoughts: [...d.thoughts, { id, x, y, text: "", createdAt: Date.now() }],
    }));
    return id;
  };
  const moveThought = (id: number, x: number, y: number) =>
    update((d) => ({
      ...d,
      thoughts: d.thoughts.map((t) => (t.id === id ? { ...t, x, y } : t)),
    }));
  const setThoughtText = (id: number, text: string) =>
    update((d) => ({
      ...d,
      thoughts: d.thoughts.map((t) => (t.id === id ? { ...t, text } : t)),
    }));
  const removeThought = (id: number) =>
    update((d) => ({
      ...d,
      thoughts: d.thoughts.filter((t) => t.id !== id),
      links: d.links.filter((l) => l.fromId !== id && l.toId !== id),
    }));
  const commitThought = (id: number) => {
    update((d) => {
      const t = d.thoughts.find((x) => x.id === id);
      if (t && t.text.trim() === "")
        return {
          ...d,
          thoughts: d.thoughts.filter((x) => x.id !== id),
          links: d.links.filter((l) => l.fromId !== id && l.toId !== id),
        };
      return d;
    });
  };

  const createLink = (fromId: number, toId: number, dx: number, dy: number) =>
    update((d) =>
      d.links.some((l) => l.fromId === fromId && l.toId === toId)
        ? d
        : { ...d, links: [...d.links, { fromId, toId, dx, dy }] },
    );
  const removeLink = (fromId: number, toId: number) =>
    update((d) => ({
      ...d,
      links: d.links.filter((l) => !(l.fromId === fromId && l.toId === toId)),
    }));

  const createRegion = (
    tagId: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ) =>
    update((d) => ({
      ...d,
      nextId: d.nextId + 1,
      regions: [...d.regions, { id: d.nextId, tagId, x, y, w, h }],
    }));
  const removeRegion = (id: number) =>
    update((d) => ({ ...d, regions: d.regions.filter((r) => r.id !== id) }));

  const addTag = (): number => {
    const id = data.nextId;
    update((d) => ({
      ...d,
      nextId: d.nextId + 1,
      // TODO connect this to the lib/colors source of truth for default
      tags: [...d.tags, { id, description: "Untitled Tag", color: "#9daec1" }],
    }));
    return id;
  };
  const setTagDescription = (id: number, description: string) =>
    update((d) => ({
      ...d,
      tags: d.tags.map((t) => (t.id === id ? { ...t, description } : t)),
    }));
  const setTagColor = (id: number, color: string) =>
    update((d) => ({
      ...d,
      tags: d.tags.map((t) => (t.id === id ? { ...t, color } : t)),
    }));
  const removeTag = (id: number) =>
    update((d) => ({
      ...d,
      tags: d.tags.filter((t) => t.id !== id),
      regions: d.regions.filter((r) => r.tagId !== id),
    }));

  return {
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
  };
}
