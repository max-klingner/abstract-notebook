import {
  type Data,
  type Tombstone,
  thoughtKey,
  linkKey,
  tagKey,
  regionKey,
} from "./store";

// deterministic "newer wins": timestamp first, then a stable tiebreak so
// merge(a, b) and merge(b, a) always pick the same winner
const newer = <T extends { updatedAt: number }>(x: T, y: T): T => {
  if (x.updatedAt !== y.updatedAt) return x.updatedAt > y.updatedAt ? x : y;
  return JSON.stringify(x) <= JSON.stringify(y) ? x : y;
};

// union of one entity kind from both boards: newest version per key wins,
// then anything deleted more recently than it was last touched is dropped
function mergeKind<T extends { updatedAt: number }>(
  as: T[],
  bs: T[],
  keyOf: (t: T) => string,
  dead: Map<string, number>,
): T[] {
  const byKey = new Map<string, T>();
  for (const item of [...as, ...bs]) {
    const k = keyOf(item);
    const prev = byKey.get(k);
    byKey.set(k, prev === undefined ? item : newer(prev, item));
  }
  return [...byKey.entries()]
    .filter(([k, item]) => {
      const deletedAt = dead.get(k);
      return deletedAt === undefined || item.updatedAt > deletedAt;
    })
    .map(([, item]) => item)
    .sort((p, q) => (keyOf(p) < keyOf(q) ? -1 : 1));
}

export function merge(a: Data, b: Data): Data {
  // latest deletion per key, across both sides
  const dead = new Map<string, number>();
  for (const t of [...a.tombstones, ...b.tombstones]) {
    const prev = dead.get(t.key);
    if (prev === undefined || t.deletedAt > prev) dead.set(t.key, t.deletedAt);
  }

  const thoughts = mergeKind(
    a.thoughts,
    b.thoughts,
    (t) => thoughtKey(t.id),
    dead,
  );
  const tags = mergeKind(a.tags, b.tags, (t) => tagKey(t.id), dead);

  const thoughtIds = new Set(thoughts.map((t) => t.id));
  const tagIds = new Set(tags.map((t) => t.id));

  // prune entities orphaned by a deletion that arrived from the other side
  const links = mergeKind(
    a.links,
    b.links,
    (l) => linkKey(l.fromId, l.toId),
    dead,
  ).filter((l) => thoughtIds.has(l.fromId) && thoughtIds.has(l.toId));
  const regions = mergeKind(
    a.regions,
    b.regions,
    (r) => regionKey(r.id),
    dead,
  ).filter((r) => tagIds.has(r.tagId));

  const tombstones: Tombstone[] = [...dead.entries()]
    .map(([key, deletedAt]) => ({ key, deletedAt }))
    .sort((p, q) => (p.key < q.key ? -1 : 1));

  return { version: 2, thoughts, links, tags, regions, tombstones };
}
