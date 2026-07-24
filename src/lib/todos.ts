import { type Thought } from "./store";

export const TODO_RE = /\btodo\b✓?/i;

export type Todo = { thoughtId: string; line: number; text: string; done: boolean };

export const collectTodos = (thoughts: Thought[]): Todo[] =>
  thoughts
    .flatMap((t) =>
      t.text
        .split("\n")
        .map((text, line) => ({ text: text.trim(), line }))
        .flatMap((l) => {
          const m = TODO_RE.exec(l.text);
          return m
            ? [{ thoughtId: t.id, line: l.line, text: l.text, done: m[0].endsWith("✓") }]
            : [];
        }),
    )
    .sort((a, b) => Number(a.done) - Number(b.done));