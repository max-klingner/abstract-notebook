import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(process.env.ABSTRACT_DB ?? "data.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    rev INTEGER NOT NULL,
    board TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id),
    token_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    last_seen INTEGER NOT NULL
  );
`);

export type DeviceRow = {
  id: string;
  group_id: string;
  token_hash: string;
  name: string;
  last_seen: number;
};

export const getDevice = db.prepare("SELECT * FROM devices WHERE id = ?");
export const touchDevice = db.prepare(
  "UPDATE devices SET last_seen = ? WHERE id = ?",
);

export type GroupRow = {
  id: string;
  rev: number;
  board: string;
  updated_at: number;
};

export const insertGroup = db.prepare(
  "INSERT INTO groups (id, rev, board, updated_at) VALUES (?, 1, ?, ?)",
);
export const insertDevice = db.prepare(
  "INSERT INTO devices (id, group_id, token_hash, name, last_seen) VALUES (?, ?, ?, ?, ?)",
);
export const getGroup = db.prepare("SELECT * FROM groups WHERE id = ?");
export const updateBoard = db.prepare(
  "UPDATE groups SET board = ?, rev = rev + 1, updated_at = ? WHERE id = ? AND rev = ?",
);

export default db;
