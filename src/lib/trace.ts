import { randomUUID } from "node:crypto";
import type { Layer, Step, Snapshot } from "./types";
export class Trace {
  steps: Step[] = [];
  constructor(private protocol: string) {}
  add(
    location: Layer,
    from: Layer,
    to: Layer,
    what: string,
    why: string,
    engineer: string,
    data: Record<string, unknown> = {},
    generatedBy = from as string,
    storedBy = to as string,
    snapshot?: Snapshot,
    changed?: "users" | "sessions",
    evidence: Step["evidence"] = "server",
  ) {
    this.steps.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      location,
      from,
      to,
      what,
      why,
      engineer,
      data,
      generatedBy,
      storedBy,
      snapshot,
      changed,
      evidence,
      protocol:
        from === "User"
          ? "UI入力（Browser内）"
          : from === "Client Application" && to === "Browser"
            ? "JavaScript / fetch"
            : from === to
          ? "内部処理"
          : from === "Database" || to === "Database"
            ? "SQL / PGlite（同一プロセス内）"
            : this.protocol,
    });
  }
}
