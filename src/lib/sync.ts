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
  const auth = { Authorization: `Bearer ${creds.deviceId}:${creds.token}` };

  const res = await fetch("/api/board", { headers: auth });
  if (!res.ok) throw new Error(`sync failed: ${res.status}`);
  let { rev, board } = await res.json();
  let merged = merge(local, JSON.parse(board));

  for (let attempt = 0; attempt < 3; attempt++) {
    const put = await fetch("/api/board", {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ rev, board: JSON.stringify(merged) }),
    });
    if (put.ok) return merged;
    if (put.status !== 409) throw new Error(`sync failed: ${put.status}`);
    ({ rev, board } = await put.json()); // someone beat us — take their state,
    merged = merge(merged, JSON.parse(board)); // fold it in, go again
  }
  return merged; // gave up pushing after 3 races; local state is still correct
}
