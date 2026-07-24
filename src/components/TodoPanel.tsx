import { collectTodos } from "../lib/todos";
import { TODO_RE } from "../lib/todos";
import { type Thought } from "../lib/store";
import { type Todo } from "../lib/todos";

export default function TodoPanel({
  thoughts,
  setThoughtText,
  flyTo,
}: {
  thoughts: Thought[];
  setThoughtText: (id: string, text: string) => void;
  flyTo: (x: number, y: number) => void;
}) {
  const todos = collectTodos(thoughts);

  const toggle = (todo: Todo) => {
    const thought = thoughts.find((th) => th.id === todo.thoughtId);
    if (!thought) return;
    const lines = thought.text.split("\n");
    lines[todo.line] = lines[todo.line].replace(TODO_RE, (m) =>
      m.endsWith("✓") ? m.slice(0, -1) : `${m}✓`,
    );
    setThoughtText(todo.thoughtId, lines.join("\n"));
  };

  return (
    <div onWheel={(e) => e.stopPropagation()}>
      <button
        popoverTarget="todo-panel"
        className="absolute left-[calc(50%-3rem)] top-3 z-10 -translate-x-1/2 cursor-pointer rounded-md
        bg-accent p-2 text-surface transition hover:bg-accent/80 shadow-sm shadow-black/30"
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
          <path d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          <polyline points="9 11 12 14 22 4" />
        </svg>
      </button>
      <div
        id="todo-panel"
        popover="auto"
        className="fixed inset-auto top-13 sm:top-3 left-1/2 m-0 sm:left-[calc(50%-3rem)] -translate-x-1/2 open:flex flex-col
        rounded-md border border-ink/15 bg-surface py-1 shadow-md shadow-black/30"
      >
        {todos.length === 0 ? (
          <p className="px-3 py-2 font-mono text-xs uppercase tracking-[0.25em] text-ink/30">
            — no todos —
          </p>
        ) : (
          <ul>
            {todos.map((t) => (
              <li
                key={`${t.thoughtId}:${t.line}`}
                className="flex items-center transition-colors hover:bg-ink/10"
                onClick={() => {
                  const thought = thoughts.find((th) => th.id === t.thoughtId);
                  if (thought !== undefined) flyTo(thought.x, thought.y);
                }}
              >
                <button
                  className={`ml-3 grid size-3.5 shrink-0 cursor-pointer place-items-center rounded-sm border transition ${
                    t.done
                      ? "border-green/60 bg-green/80 text-surface"
                      : "border-ink/30 hover:border-gold"
                  }`}
                  onClick={() => toggle(t)}
                >
                  {t.done && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span
                  className={`min-w-0 flex-1 truncate px-2.5 py-1.5 font-note text-sm ${
                    t.done ? "text-ink/35 line-through" : "text-ink/80"
                  }`}
                >
                  {t.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
