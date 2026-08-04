import { useRef } from "react";
import { type Data, exportJson } from "../lib/store";
import { type SyncState } from "../lib/useSync";

export default function SettingsPanel({
  data,
  synced,
  syncNow,
  syncState,
  setSyncState,
  dirty,
  importBoard,
}: {
  data: Data;
  synced: boolean;
  syncNow: () => Promise<boolean>;
  syncState: SyncState;
  setSyncState: (s: SyncState) => void;
  dirty: boolean;
  importBoard: (raw: string) => boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportJson(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `abstract-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    const raw = await file.text();
    if (
      !window.confirm(
        "Replace everything on this board with the imported file?",
      )
    )
      return;
    if (!importBoard(raw))
      alert("That file doesn't look like an abstract export.");
  };

  return (
    <div onWheel={(e) => e.stopPropagation()}>
      <button
        popoverTarget="settings-panel"
        className="absolute left-3 top-3 z-10 cursor-pointer rounded-md bg-accent p-2
        text-surface transition hover:bg-accent/80 shadow-sm shadow-black/30"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-5"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>
      <div
        id="settings-panel"
        popover="auto"
        onToggle={(e) => {
          // don't carry a transient "syncing…"/"failed" chip into the next open
          if (e.newState === "closed") setSyncState("idle");
        }}
        className="fixed inset-auto top-13 left-3 m-0 open:flex min-w-40 flex-col py-1
        rounded-md border border-ink/15 bg-surface shadow-md shadow-black/30"
      >
        <button
          onClick={download}
          popoverTarget="settings-panel"
          popoverTargetAction="hide"
          className="block w-full cursor-pointer px-3 py-1 text-left text-sm text-ink/80 transition hover:bg-ink/10"
        >
          Export board…
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          popoverTarget="settings-panel"
          popoverTargetAction="hide"
          className="block w-full cursor-pointer px-3 py-1 text-left text-sm text-ink/80 transition hover:bg-ink/10"
        >
          Import board…
        </button>
        {synced ? (
          <>
            <button
              onClick={() => void syncNow()}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1 text-left text-sm
              text-ink/80 transition hover:bg-ink/10"
            >
              Sync
              <span
                className={`ml-auto rounded-sm px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider ${
                  syncState === "error"
                    ? "bg-red-400/15 text-red-400"
                    : syncState === "syncing"
                      ? "bg-ink/10 text-ink/50"
                      : dirty
                        ? "bg-gold/15 text-gold"
                        : "bg-green/15 text-green"
                }`}
              >
                {syncState === "error"
                  ? "failed"
                  : syncState === "syncing"
                    ? "syncing…"
                    : dirty
                      ? "unsaved changes"
                      : "up to date"}
              </span>
            </button>
            <button
              onClick={() => {
                document.getElementById("settings-panel")?.hidePopover();
                document.getElementById("devices-panel")?.showPopover();
              }}
              className="block w-full cursor-pointer px-3 py-1 text-left text-sm text-ink/80 transition hover:bg-ink/10"
            >
              Devices…
            </button>
          </>
        ) : (
          <button
            onClick={() => void syncNow()}
            className="block w-full cursor-pointer px-3 py-1 text-left text-sm text-ink/80 transition hover:bg-ink/10"
          >
            {syncState === "syncing"
              ? "Starting…"
              : syncState === "error"
                ? "Couldn’t start — retry"
                : "Start device group & sync"}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          void pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
