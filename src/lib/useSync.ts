import { useEffect, useRef, useState } from "react";
import { merge } from "./merge";
import { type Data } from "./store";
import {
  defaultDeviceName,
  loadCreds,
  readPairingFromUrl,
  redeemPairing,
  RevokedError,
  startGroup,
  syncOnce,
  type SyncCreds,
} from "./sync";

export type PairStatus = "none" | "pairing" | "paired" | "error";
export type SyncState = "idle" | "syncing" | "error";

export function useSync(data: Data, update: (fn: (d: Data) => Data) => void) {
  const [creds, setCreds] = useState<SyncCreds | null>(loadCreds);
  const [pairStatus, setPairStatus] = useState<PairStatus>("none");
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [revoked, setRevoked] = useState(false);

  // live mirror of the board, so long-lived callbacks (the pairing listener
  // below) never push a snapshot captured at mount
  const dataRef = useRef(data);
  dataRef.current = data;

  // the exact board object last reconciled with the server — every edit makes
  // a new object, so identity alone tells us whether changes are unpushed
  const syncedRef = useRef<Data | null>(null);
  const dirty = creds !== null && data !== syncedRef.current;

  const syncNow = async (): Promise<boolean> => {
    setSyncState("syncing");
    try {
      const c =
        loadCreds() ?? (await startGroup(dataRef.current, defaultDeviceName()));
      setCreds(c);
      const merged = await syncOnce(dataRef.current, c);
      // merge into whatever is current rather than replacing — edits made
      // while the network round-trip was in flight must survive
      update((d) => {
        const next = merge(d, merged);
        syncedRef.current = next;
        return next;
      });
      setSyncState("idle");
      return true;
    } catch (e) {
      // removed from the group (or the group is gone): sync.ts already threw
      // the credentials away, so fall back to "not syncing" instead of
      // retrying forever against a server that doesn't know us
      if (e instanceof RevokedError) {
        setCreds(null);
        syncedRef.current = null;
        setSyncState("idle");
        setRevoked(true);
        return false;
      }
      console.error("sync:", e);
      setSyncState("error");
      return false;
    }
  };

  // called after the devices panel leaves or destroys a group
  const refreshCreds = () => {
    setCreds(loadCreds());
    syncedRef.current = null;
    setSyncState("idle");
  };

  // redeem a #pair=... link, whether it arrives with a page load or is pasted
  // into an already-open page (a fragment-only navigation never remounts)
  useEffect(() => {
    const tryPair = () => {
      const pairing = readPairingFromUrl();
      if (pairing === null) return;
      // scrub before any await: invites are single-use, so a lingering fragment
      // would retry a burned link on reload — and it keeps the secret out of
      // the address bar and history. Also makes StrictMode's second run a no-op.
      // (replaceState deliberately does not fire hashchange, so no loop.)
      history.replaceState(null, "", location.pathname + location.search);
      if (
        loadCreds() !== null &&
        !window.confirm(
          "This device already syncs with a group. Join the new one instead?",
        )
      )
        return;
      setPairStatus("pairing");
      void (async () => {
        try {
          const c = await redeemPairing(
            pairing.pairingId,
            pairing.secret,
            defaultDeviceName(),
          );
          setCreds(c);
          await syncNow();
          setPairStatus("paired");
        } catch (e) {
          console.error("pairing:", e);
          setPairStatus("error");
        }
      })();
    };

    tryPair(); // fresh load carrying a fragment
    window.addEventListener("hashchange", tryPair); // pasted into an open page
    return () => window.removeEventListener("hashchange", tryPair);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    creds,
    syncNow,
    refreshCreds,
    syncState,
    setSyncState,
    dirty,
    pairStatus,
    setPairStatus,
    revoked,
    setRevoked,
  };
}
