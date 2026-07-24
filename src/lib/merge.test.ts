import { describe, expect, it } from "vitest";
import { merge } from "./merge";
import {
  type Data,
  type Link,
  type Region,
  type Tag,
  type Thought,
  thoughtKey,
  linkKey,
} from "./store";

const board = (partial?: Partial<Omit<Data, "version">>): Data => ({
  version: 2,
  thoughts: [],
  links: [],
  tags: [],
  regions: [],
  tombstones: [],
  ...partial,
});

const thought = (id: string, updatedAt: number, text = ""): Thought => ({
  id,
  x: 0,
  y: 0,
  text,
  createdAt: 1,
  updatedAt,
});

const link = (fromId: string, toId: string, updatedAt: number): Link => ({
  fromId,
  toId,
  dx: 10,
  dy: 10,
  updatedAt,
});

const tag = (id: string, updatedAt: number): Tag => ({
  id,
  description: "tag",
  color: "#9daec1",
  updatedAt,
});

const region = (id: string, tagId: string, updatedAt: number): Region => ({
  id,
  tagId,
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  updatedAt,
});

// every scenario must merge the same in both directions (commutativity) —
// if the devices disagreed on the outcome they would ping-pong forever
const mergeBoth = (a: Data, b: Data): Data => {
  const ab = merge(a, b);
  const ba = merge(b, a);
  expect(ab).toEqual(ba);
  return ab;
};

describe("merge", () => {
  it("merging identical boards changes nothing", () => {
    const a = board({
      thoughts: [thought("a", 5, "hello"), thought("b", 3)],
      links: [link("a", "b", 4)],
      tags: [tag("t1", 2)],
      regions: [region("r1", "t1", 2)],
    });
    expect(mergeBoth(a, a)).toEqual(a);
  });

  it("keeps disjoint edits from both sides", () => {
    const one = board({
      thoughts: [thought("a", 5, "edited on one"), thought("b", 1)],
    });
    const two = board({
      thoughts: [thought("a", 1), thought("b", 6, "edited on two")],
    });
    const m = mergeBoth(one, two);
    expect(m.thoughts.find((t) => t.id === "a")?.text).toBe("edited on one");
    expect(m.thoughts.find((t) => t.id === "b")?.text).toBe("edited on two");
  });

  it("newer edit wins a same-thought conflict", () => {
    const one = board({ thoughts: [thought("a", 5, "older")] });
    const two = board({ thoughts: [thought("a", 9, "newer")] });
    expect(mergeBoth(one, two).thoughts).toEqual([thought("a", 9, "newer")]);
  });

  it("a deletion beats an older entity and the tombstone is kept", () => {
    const one = board({ thoughts: [thought("a", 1)] });
    const two = board({
      tombstones: [{ key: thoughtKey("a"), deletedAt: 5 }],
    });
    const m = mergeBoth(one, two);
    expect(m.thoughts).toEqual([]);
    expect(m.tombstones).toEqual([{ key: thoughtKey("a"), deletedAt: 5 }]);
  });

  it("an edit made after a deletion resurrects the entity", () => {
    const one = board({ thoughts: [thought("a", 9, "still here")] });
    const two = board({
      tombstones: [{ key: thoughtKey("a"), deletedAt: 5 }],
    });
    const m = mergeBoth(one, two);
    expect(m.thoughts).toEqual([thought("a", 9, "still here")]);
  });

  it("cascade tombstones kill the copies the other device still holds", () => {
    // device one deleted thought "a", which tombstoned its link too
    const one = board({
      thoughts: [thought("b", 1)],
      tombstones: [
        { key: thoughtKey("a"), deletedAt: 5 },
        { key: linkKey("a", "b"), deletedAt: 5 },
      ],
    });
    // device two never saw the deletion
    const two = board({
      thoughts: [thought("a", 1), thought("b", 1)],
      links: [link("a", "b", 1)],
    });
    const m = mergeBoth(one, two);
    expect(m.thoughts).toEqual([thought("b", 1)]);
    expect(m.links).toEqual([]);
  });

  it("prunes a link left dangling by a deletion from the other side", () => {
    // device one deleted thought "a" ...
    const one = board({
      thoughts: [thought("b", 1)],
      tombstones: [{ key: thoughtKey("a"), deletedAt: 5 }],
    });
    // ... while device two, unaware, drew a fresh link from "a"
    const two = board({
      thoughts: [thought("a", 1), thought("b", 1)],
      links: [link("a", "b", 9)],
    });
    const m = mergeBoth(one, two);
    expect(m.thoughts).toEqual([thought("b", 1)]);
    expect(m.links).toEqual([]);
  });

  it("prunes a region whose tag died on the other side", () => {
    const one = board({
      tombstones: [{ key: "tag:t1", deletedAt: 5 }],
    });
    const two = board({
      tags: [tag("t1", 1)],
      regions: [region("r1", "t1", 9)],
    });
    const m = mergeBoth(one, two);
    expect(m.tags).toEqual([]);
    expect(m.regions).toEqual([]);
  });
});
