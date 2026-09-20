export type Layer =
  | "User"
  | "Browser"
  | "Client Application"
  | "Authentication Server"
  | "Resource API"
  | "Database";
export type User = {
  id: string;
  email: string;
  password_hash: string;
  role: "user" | "admin";
  status: string;
  created_at: string;
};
export type Session = {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
};
export type Snapshot = {
  users: User[];
  sessions: Session[];
  refresh_tokens: unknown[];
  oauth_clients: unknown[];
  authorization_codes: unknown[];
};
export type Step = {
  id: string;
  at: string;
  location: Layer;
  from: Layer;
  to: Layer;
  protocol: string;
  what: string;
  why: string;
  engineer: string;
  data: Record<string, unknown>;
  generatedBy: string;
  storedBy: string;
  snapshot?: Snapshot;
  changed?: "users" | "sessions";
  evidence: "server" | "browser-model";
};
export type HttpRecord = {
  method: string;
  path: string;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
  status: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
};
export type CookieView = {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
  expires: string | null;
  source: string;
};
export type LabState = {
  snapshot: Snapshot;
  authenticated: boolean;
  user: Omit<User, "password_hash"> | null;
  cookie: CookieView | null;
  sessionStatus: string;
  sessionExpires: string | null;
  serverTime: string;
  transport: string;
};
export type Result = {
  success: boolean;
  message: string;
  trace: Step[];
  http: HttpRecord;
  state: LabState;
  requestId: string;
};
