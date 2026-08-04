import { Hono, type Context, type Next } from "hono";
import { bodyLimit } from "hono/body-limit"
import { serve } from "@hono/node-server";
import { deleteDevice, getDevice, getGroup, getPairing, insertDevice, insertGroup, insertPairing, listDevices, touchDevice, updateBoard, usePairing, type DeviceRow, type GroupRow, type PairingRow } from "./db.ts";
import { hashToken, newToken, tokenMatches } from "./crypto.ts";

type Env = { Variables: { groupId: string; deviceId: string } };
const app = new Hono<Env>();

const requireDevice = async (c: Context<Env>, next: Next) => {
  const header = c.req.header("Authorization");
  const [deviceId, token] = header?.replace("Bearer ", "").split(":") ?? [];
  const device = getDevice.get(deviceId ?? "") as DeviceRow | undefined;
  if (!device || !token || !tokenMatches(token, device.token_hash))
    return c.json({ error: "unauthorized" }, 401);
  touchDevice.run(Date.now(), device.id);
  c.set("groupId", device.group_id);
  c.set("deviceId", device.id);
  await next();
};

app.use("/api/*", bodyLimit({ maxSize: 10 * 1024 * 1024 }))
app.use("/api/board", requireDevice);
app.use("/api/pairings", requireDevice);
app.use("/api/devices", requireDevice);
app.use("/api/devices/:id", requireDevice);

app.get("/api/health", (c) => c.text("ok"));

app.post("/api/groups", async (c) => {
  const { board, deviceName } = await c.req.json();
  if (typeof board !== "string" || typeof deviceName !== "string")
    return c.json({ error: "bad request" }, 400);
  const groupId = crypto.randomUUID();
  const deviceId = crypto.randomUUID();
  const token = newToken();
  insertGroup.run(groupId, board, Date.now());
  insertDevice.run(deviceId, groupId, hashToken(token), deviceName, Date.now());
  return c.json({ groupId, deviceId, token });
});

app.get("/api/board", (c) => {
  const g = getGroup.get(c.get("groupId")) as GroupRow;
  return c.json({ rev: g.rev, board: g.board });
});

app.put("/api/board", async (c) => {
  const { rev, board } = await c.req.json();
  if (typeof rev !== "number" || typeof board !== "string")
    return c.json({ error: "bad request" }, 400);
  const result = updateBoard.run(board, Date.now(), c.get("groupId"), rev);
  if (result.changes === 1) return c.json({ rev: rev + 1 });
  const g = getGroup.get(c.get("groupId")) as GroupRow;
  return c.json({ rev: g.rev, board: g.board }, 409);
});

app.post("/api/pairings", (c) => {
  const pairingId = crypto.randomUUID();
  const secret = newToken();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  insertPairing.run(pairingId, c.get("groupId"), hashToken(secret), expiresAt);
  return c.json({ pairingId, secret, expiresAt });
});

app.post("/api/pairings/redeem", async (c) => {
  const { pairingId, secret, deviceName } = await c.req.json();
  if (
    typeof pairingId !== "string" ||
    typeof secret !== "string" ||
    typeof deviceName !== "string"
  )
    return c.json({ error: "bad request" }, 400);

  const p = getPairing.get(pairingId) as PairingRow | undefined;
  const valid =
    p &&
    p.used_at === null &&
    p.expires_at > Date.now() &&
    tokenMatches(secret, p.secret_hash);
  if (!valid) return c.json({ error: "invalid or expired pairing" }, 400);

  // claim it atomically — two devices racing the same link can't both win
  if (usePairing.run(Date.now(), pairingId).changes !== 1)
    return c.json({ error: "invalid or expired pairing" }, 400);

  const deviceId = crypto.randomUUID();
  const token = newToken();
  insertDevice.run(deviceId, p.group_id, hashToken(token), deviceName, Date.now());
  return c.json({ groupId: p.group_id, deviceId, token });
});

app.get("/api/devices", (c) => {
  const rows = listDevices.all(c.get("groupId")) as {
    id: string;
    name: string;
    last_seen: number;
  }[];
  return c.json({
    devices: rows.map((r) => ({
      id: r.id,
      name: r.name,
      lastSeen: r.last_seen,
      self: r.id === c.get("deviceId"),
    })),
  });
});

app.delete("/api/devices/:id", (c) => {
  if (listDevices.all(c.get("groupId")).length <= 1)
    return c.json({ error: "cannot remove the last device" }, 400);
  if (deleteDevice.run(c.req.param("id"), c.get("groupId")).changes !== 1)
    return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`abstract api listening on :${info.port}`);
});