import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "./password";
import type { Snapshot, User, Session } from "./types";

// One embedded PostgreSQL engine per Next.js process, including hot reloads.
const runtime = globalThis as unknown as {
  authLabEmbeddedDb?: Promise<PGlite>;
};
/**
 * DBをメモリ上だけで動かすか。
 *
 * Vercel などのサーバーレス環境はファイルシステムに書き込めないため、
 * LAB_MEMORY_DB=true でメモリ動作に切り替える。
 * 学習空間は使い捨てでよく、消えても最初からやり直せる。
 * ローカルでは未設定のままにして、進捗をファイルに残す。
 */
const useMemoryDb = process.env.LAB_MEMORY_DB === "true";

export async function database(): Promise<PGlite> {
  runtime.authLabEmbeddedDb ??= (async () => {
    // 保存先を渡さなければメモリ上に作られる
    let db: PGlite;
    if (useMemoryDb) {
      db = await PGlite.create();
    } else {
      const dir = resolve(process.env.LAB_DATA_DIR ?? "./data/authlab");
      await mkdir(dir, { recursive: true });
      db = await PGlite.create(dir);
    }
    try {
      await db.exec(await readFile(`${process.cwd()}/db/schema.sql`, "utf8"));
    } catch (error) {
      await db.close();
      throw error;
    }
    return db;
  })().catch((error) => {
    runtime.authLabEmbeddedDb = undefined;
    throw error;
  });
  return runtime.authLabEmbeddedDb;
}
export async function initialize() {
  await database();
}
const json = <T>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T;
export async function createSpace(): Promise<string> {
  const db = await database();
  const id = randomBytes(32).toString("hex");
  const hashes = await Promise.all([
    hashPassword("LearnSession!2026"),
    hashPassword("LearnSession!2026"),
  ]);
  // PGlite serializes interactive transactions; never interleave manual BEGINs.
  await db.transaction(async (tx) => {
    await tx.query("INSERT INTO lab_spaces(id) VALUES($1)", [id]);
    for (const [i, role] of ["user", "admin"].entries())
      await tx.query(
        "INSERT INTO users(id,lab_id,email,password_hash,role) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          id,
          role === "user" ? "sample@example.com" : "admin@example.com",
          hashes[i],
          role,
        ],
      );
  });
  return id;
}
export async function spaceExists(id: string) {
  const db = await database();
  return (
    (await db.query("SELECT 1 FROM lab_spaces WHERE id=$1", [id])).rows
      .length === 1
  );
}
export async function snapshot(lab: string): Promise<Snapshot> {
  const db = await database();
  return db.transaction(async (tx) => {
    const u = await tx.query(
      "SELECT id,email,password_hash,role,status,created_at FROM users WHERE lab_id=$1 ORDER BY email",
      [lab],
    );
    const s = await tx.query(
      "SELECT id,user_id,expires_at,created_at FROM sessions WHERE lab_id=$1 ORDER BY created_at",
      [lab],
    );
    const refresh = await tx.query(
      "SELECT id,user_id,family_id,generation,token_hash,expires_at,used_at,revoked_at FROM refresh_tokens WHERE lab_id=$1 AND family_id IS NOT NULL ORDER BY created_at,generation,id",
      [lab],
    );
    return json<Snapshot>({
      users: u.rows,
      sessions: s.rows,
      refresh_tokens: refresh.rows,
      oauth_clients: [],
      authorization_codes: [],
    });
  });
}
export async function findUser(
  lab: string,
  email: string,
): Promise<User | undefined> {
  const db = await database();
  const r = await db.query(
    "SELECT id,email,password_hash,role,status,created_at FROM users WHERE lab_id=$1 AND email=$2",
    [lab, email],
  );
  return json<User[]>(r.rows)[0];
}
export async function findSession(
  lab: string,
  id: string,
): Promise<Session | undefined> {
  const db = await database();
  const r = await db.query(
    "SELECT id,user_id,expires_at,created_at FROM sessions WHERE lab_id=$1 AND id=$2",
    [lab, id],
  );
  return json<Session[]>(r.rows)[0];
}
export function isSessionValid(s: Session | undefined, now = Date.now()) {
  return !!s && new Date(s.expires_at).getTime() > now;
}
export async function issueSession(
  lab: string,
  user: User,
  oldId: string | undefined,
  ttl: number,
  id = randomBytes(32).toString("hex"),
): Promise<Session> {
  const db = await database();
  return db.transaction(async (tx) => {
    if (oldId)
      await tx.query("DELETE FROM sessions WHERE lab_id=$1 AND id=$2", [
        lab,
        oldId,
      ]);
    const r = await tx.query(
      "INSERT INTO sessions(id,lab_id,user_id,expires_at) VALUES($1,$2,$3,now()+($4 * interval '1 second')) RETURNING id,user_id,expires_at,created_at",
      [id, lab, user.id, ttl],
    );
    return json<Session[]>(r.rows)[0];
  });
}
export async function deleteSession(lab: string, id: string) {
  const db = await database();
  await db.query("DELETE FROM sessions WHERE lab_id=$1 AND id=$2", [lab, id]);
}
export async function expireSession(lab: string, id: string) {
  const db = await database();
  await db.query(
    "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE lab_id=$1 AND id=$2",
    [lab, id],
  );
}
export async function resetSpace(lab: string) {
  const db = await database();
  await db.query("DELETE FROM sessions WHERE lab_id=$1", [lab]);
}
