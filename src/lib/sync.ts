import { type Data } from "./store";
import { merge } from "./merge";

const CREDS_KEY = "abstract:sync";

export type SyncCreds = { groupId: string; deviceId: string; token: string };

export const loadCreds = (): SyncCreds | null => {
  try {
    return JSON.parse(localStorage.getItem(CREDS_KEY) ?? "null");
  } catch {
    return null;
  }
};
const saveCreds = (c: SyncCreds) =>
  localStorage.setItem(CREDS_KEY, JSON.stringify(c));
export const clearCreds = () => localStorage.removeItem(CREDS_KEY);

const authHeaders = (creds: SyncCreds) => ({
  Authorization: `Bearer ${creds.deviceId}:${creds.token}`,
});

// thrown when the server no longer recognizes this device — it was removed
// from its group, or the group was deleted
export class RevokedError extends Error {
  constructor() {
    super("this device is no longer part of a sync group");
    this.name = "RevokedError";
  }
}

// dead credentials are never worth retrying, so a 401 forgets them here
const assertOk = async (res: Response, fallback: string) => {
  if (res.status === 401) {
    clearCreds();
    throw new RevokedError();
  }
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "" }));
    throw new Error(error || `${fallback}: ${res.status}`);
  }
};

// browsers hide the machine's real name (fingerprinting), so derive a
// readable label from the user agent — a "device" is one browser anyway
export const defaultDeviceName = (): string => {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "device";
  const browser = /Firefox\//.test(ua)
    ? "Firefox"
    : /Edg\//.test(ua)
      ? "Edge"
      : /OPR\//.test(ua)
        ? "Opera"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  return `${browser} on ${os}`;
};

export async function startGroup(
  board: Data,
  deviceName: string,
): Promise<SyncCreds> {
  const res = await fetch("/api/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ board: JSON.stringify(board), deviceName }),
  });
  if (!res.ok) throw new Error(`enable sync failed: ${res.status}`);
  const creds: SyncCreds = await res.json();
  saveCreds(creds);
  return creds;
}

export async function syncOnce(local: Data, creds: SyncCreds): Promise<Data> {
  const auth = authHeaders(creds);

  const res = await fetch("/api/board", { headers: auth });
  await assertOk(res, "sync failed");
  let { rev, board } = await res.json();
  let merged = merge(local, JSON.parse(board));

  for (let attempt = 0; attempt < 3; attempt++) {
    const put = await fetch("/api/board", {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ rev, board: JSON.stringify(merged) }),
    });
    if (put.ok) return merged;
    if (put.status !== 409) await assertOk(put, "sync failed"); // always throws
    ({ rev, board } = await put.json()); // someone beat us — take their state,
    merged = merge(merged, JSON.parse(board)); // fold it in, go again
  }
  return merged; // gave up pushing after 3 races; local state is still correct
}

export type Pairing = { pairingId: string; secret: string; expiresAt: number };

export async function createPairing(creds: SyncCreds): Promise<Pairing> {
  const res = await fetch("/api/pairings", {
    method: "POST",
    headers: authHeaders(creds),
  });
  await assertOk(res, "could not create pairing");
  return res.json();
}

export const pairingLink = (p: Pairing) =>
  `${location.origin}/#pair=${p.pairingId}.${p.secret}`;

export const readPairingFromUrl = (): {
  pairingId: string;
  secret: string;
} | null => {
  const m = /^#pair=([^.]+)\.(.+)$/.exec(location.hash);
  return m ? { pairingId: m[1], secret: m[2] } : null;
};

export async function redeemPairing(
  pairingId: string,
  secret: string,
  deviceName: string,
): Promise<SyncCreds> {
  const res = await fetch("/api/pairings/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingId, secret, deviceName }),
  });
  if (!res.ok) throw new Error("this pairing link is invalid or expired");
  const creds: SyncCreds = await res.json();
  saveCreds(creds);
  return creds;
}

export type DeviceInfo = {
  id: string;
  name: string;
  lastSeen: number;
  self: boolean;
};

export async function listDevices(creds: SyncCreds): Promise<DeviceInfo[]> {
  const res = await fetch("/api/devices", { headers: authHeaders(creds) });
  await assertOk(res, "could not list devices");
  const { devices } = await res.json();
  return devices;
}

export async function removeDevice(
  creds: SyncCreds,
  id: string,
): Promise<void> {
  const res = await fetch(`/api/devices/${id}`, {
    method: "DELETE",
    headers: authHeaders(creds),
  });
  await assertOk(res, "could not remove device");
}

// leaving as the last device: delete the group and the server's copy of the
// board, then forget the credentials. The local board is untouched.
export async function deleteGroup(creds: SyncCreds): Promise<void> {
  const res = await fetch("/api/groups", {
    method: "DELETE",
    headers: authHeaders(creds),
  });
  await assertOk(res, "could not disable syncing");
  clearCreds();
}
