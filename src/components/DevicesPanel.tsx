import { useState } from "react";
import { fmtRelative } from "../lib/format";
import {
  clearCreds,
  createPairing,
  deleteGroup,
  listDevices,
  pairingLink,
  removeDevice,
  RevokedError,
  type DeviceInfo,
  type SyncCreds,
} from "../lib/sync";

// Shows who is in this device's sync group, and hands out pairing links.
// Talks to sync.ts directly — nothing here touches board state.
export default function DevicesPanel({
  creds,
  onCredsChanged,
}: {
  creds: SyncCreds | null;
  onCredsChanged: () => void;
}) {
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const message = (e: unknown, fallback: string) =>
    e instanceof Error ? e.message : fallback;

  // this device was removed elsewhere: credentials are already cleared, so
  // just let the panel fall back to its "not syncing" state
  const handled = (e: unknown) => {
    if (!(e instanceof RevokedError)) return false;
    setDevices(null);
    onCredsChanged();
    return true;
  };

  const refresh = async () => {
    setLink(null);
    setError("");
    if (creds === null) {
      setDevices(null);
      return;
    }
    try {
      setDevices(await listDevices(creds));
    } catch (e) {
      if (handled(e)) return;
      setDevices(null);
      setError(message(e, "could not reach the sync server"));
    }
  };

  const invite = async () => {
    if (creds === null) return;
    setBusy(true);
    setError("");
    try {
      setLink(pairingLink(await createPairing(creds)));
    } catch (e) {
      if (!handled(e)) setError(message(e, "could not create a pairing link"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: DeviceInfo) => {
    if (creds === null || devices === null) return;
    const lastOne = devices.length === 1;
    if (
      !window.confirm(
        lastOne
          ? "This is the only device in the group. Removing it deletes the group and the copy of your board on the server, and turns syncing off. Your board stays on this device."
          : d.self
            ? "Stop syncing this device? Its board stays, but it leaves the group."
            : `Remove "${d.name}" from the group?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (lastOne) {
        await deleteGroup(creds); // clears credentials itself
        setDevices(null);
        onCredsChanged();
      } else if (d.self) {
        await removeDevice(creds, d.id);
        clearCreds();
        setDevices(null);
        onCredsChanged();
      } else {
        await removeDevice(creds, d.id);
        await refresh();
      }
    } catch (e) {
      if (!handled(e)) setError(message(e, "could not remove that device"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      id="devices-panel"
      popover="auto"
      onToggle={(e) => {
        if (e.newState === "open") void refresh();
      }}
      className="fixed inset-auto top-13 left-3 m-0 w-80 max-w-[calc(100vw-1.5rem)] open:flex flex-col gap-2
      rounded-md border border-ink/15 bg-surface p-3 shadow-md shadow-black/30"
    >
      {creds === null ? (
        <p className="text-sm text-ink/60">This device isn’t syncing.</p>
      ) : (
        <>
          <p className="font-mono text-[0.625rem] text-ink/30">
            group {creds.groupId.slice(0, 8)}…
          </p>

          {devices === null ? (
            <p className="text-sm text-ink/50">loading…</p>
          ) : (
            <ul className="flex flex-col">
              {devices.map((d) => (
                <li
                  key={d.id}
                  className="group flex items-center gap-2 rounded px-1 py-1.5 transition hover:bg-ink/5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink/80">
                      {d.name}
                      {d.self && (
                        <span className="ml-1.5 rounded-sm bg-accent/20 px-1 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-accent">
                          this device
                        </span>
                      )}
                    </span>
                    <span className="block font-mono text-[0.625rem] text-ink/35">
                      {fmtRelative(d.lastSeen)}
                    </span>
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => void remove(d)}
                    title={
                      devices.length === 1
                        ? "Delete this group and stop syncing"
                        : d.self
                          ? "Stop syncing this device"
                          : "Remove device"
                    }
                    className="cursor-pointer px-2 text-ink/40 opacity-50 transition
                    hover:text-red-400 group-hover:opacity-100 disabled:cursor-default
                    pointer-coarse:text-[1.35rem] pointer-coarse:leading-none pointer-coarse:opacity-100"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {link === null ? (
            <button
              disabled={busy || devices === null}
              onClick={() => void invite()}
              className="cursor-pointer rounded-md border border-ink/15 px-3 py-1.5 text-sm text-ink/80
              transition hover:bg-ink/10 disabled:cursor-default disabled:opacity-40"
            >
              {busy ? "Working…" : "Sync with new device…"}
            </button>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-ink/50">
                Open this link on the other device within 10 minutes. It works
                once.
              </p>
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full select-text rounded border border-ink/15 bg-board px-2 py-1
                font-mono text-[0.625rem] text-ink/70 outline-none"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => void navigator.clipboard.writeText(link)}
                  className="flex-1 cursor-pointer rounded-md border border-ink/15 px-3 py-1.5 text-sm
                  text-ink/80 transition hover:bg-ink/10"
                >
                  Copy link
                </button>
                <button
                  onClick={() => setLink(null)}
                  className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-ink/50 transition hover:bg-ink/10"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error !== "" && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
