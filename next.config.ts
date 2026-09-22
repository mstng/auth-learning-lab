import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  // db/schema.sql は実行時に readFile で読むため、静的解析では検出されない。
  // 明示的に同梱しないとサーバーレス環境で ENOENT になる。
  outputFileTracingIncludes: {
    "/api/**": ["./db/schema.sql"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
