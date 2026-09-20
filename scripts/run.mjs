// Cross-platform launcher: no shell env assignments, Docker, or external DB.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
if (existsSync(join(root, ".env"))) process.loadEnvFile(join(root, ".env"));
const dir = resolve(root, process.env.LAB_DATA_DIR ?? "data/authlab");
await mkdir(dir, { recursive: true });
const lock = join(dir, ".app-lock");
async function acquire() {
  try {
    const file = await open(lock, "wx");
    await file.writeFile(String(process.pid));
    await file.close();
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const owner = Number(await readFile(lock, "utf8"));
    if (!Number.isSafeInteger(owner) || owner <= 0)
      throw new Error(
        "DB起動ロックを確認できません。他の起動を停止してからdata/authlab/.app-lockを確認してください。",
      );
    try {
      process.kill(owner, 0);
    } catch (e) {
      if (e.code === "ESRCH") {
        await unlink(lock);
        return acquire();
      }
      throw e;
    }
    throw new Error(
      "同じデータで別のアプリが起動中です。先に終了してください。",
    );
  }
}
await acquire();
const port = process.env.PORT ?? "3000";
const env = {
  ...process.env,
  LAB_MODE: process.env.LAB_MODE ?? "true",
  APP_ORIGIN: process.env.APP_ORIGIN ?? `http://localhost:${port}`,
  COOKIE_SECURE: process.env.COOKIE_SECURE ?? "false",
  LAB_DATA_DIR: dir,
  HOSTNAME: "127.0.0.1",
  PORT: port,
  NEXT_TELEMETRY_DISABLED: "1",
};
const dev = process.argv[2] === "dev";
const args = dev
  ? [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ]
  : [".next/standalone/server.js"];
const child = spawn(process.execPath, args, {
  cwd: root,
  env,
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
let cleaned = false;
async function cleanup() {
  if (!cleaned) {
    cleaned = true;
    await unlink(lock).catch(() => {});
  }
}
child.on("error", async (error) => {
  console.error(error.message);
  await cleanup();
  process.exit(1);
});
child.on("exit", async (code) => {
  await cleanup();
  process.exit(code ?? 0);
});
