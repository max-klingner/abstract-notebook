import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const newToken = () => randomBytes(32).toString("base64url");

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const tokenMatches = (presented: string, storedHash: string): boolean =>
  timingSafeEqual(
    Buffer.from(hashToken(presented), "hex"),
    Buffer.from(storedHash, "hex"),
  );
