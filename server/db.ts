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
  CREATE TABLE IF NOT EXISTS pairings (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id),
    secret_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
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
export const listDevices = db.prepare(
  "SELECT id, name, last_seen FROM devices WHERE group_id = ? ORDER BY last_seen DESC",
);
export const deleteDevice = db.prepare(
  "DELETE FROM devices WHERE id = ? AND group_id = ?",
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

export type PairingRow = {
  id: string;
  group_id: string;
  secret_hash: string;
  expires_at: number;
  used_at: number | null;
};

export const insertPairing = db.prepare(
  "INSERT INTO pairings (id, group_id, secret_hash, expires_at) VALUES (?, ?, ?, ?)",
);
export const getPairing = db.prepare("SELECT * FROM pairings WHERE id = ?");
export const usePairing = db.prepare(
  "UPDATE pairings SET used_at = ? WHERE id = ? AND used_at IS NULL",
);

export default db;
