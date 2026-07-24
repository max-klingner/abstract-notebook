import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit"
import { serve } from "@hono/node-server";
import { getDevice, getGroup, insertDevice, insertGroup, touchDevice, updateBoard, type DeviceRow, type GroupRow } from "./db.ts";
import { hashToken, newToken, tokenMatches } from "./crypto.ts";

const app = new Hono<{ Variables: { groupId: string } }>();

app.use("/api/*", bodyLimit({ maxSize: 10 * 1024 * 1024 }))

app.use("/api/board", async (c, next) => {
  const header = c.req.header("Authorization");
  const [deviceId, token] = header?.replace("Bearer ", "").split(":") ?? [];
  const device = getDevice.get(deviceId ?? "") as DeviceRow | undefined;
  if (!device || !token || !tokenMatches(token, device.token_hash))
    return c.json({ error: "unauthorized" }, 401);
  touchDevice.run(Date.now(), device.id);
  c.set("groupId", device.group_id);
  await next();
});

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

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`abstract api listening on :${info.port}`);
});