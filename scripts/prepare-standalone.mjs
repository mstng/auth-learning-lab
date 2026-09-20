import { cp, mkdir } from "node:fs/promises";
await mkdir(".next/standalone/.next", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
await cp("public", ".next/standalone/public", { recursive: true });
await cp("db", ".next/standalone/db", { recursive: true });
console.log("Standalone server, assets and DB schema prepared.");

await mkdir(".next/standalone/node_modules/@electric-sql", { recursive: true });
await cp(
  "node_modules/@electric-sql/pglite",
  ".next/standalone/node_modules/@electric-sql/pglite",
  { recursive: true },
);
