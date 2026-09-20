import bcrypt from "bcryptjs";
export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);
export function validCredentials(
  value: unknown,
): value is { email: string; password: string; ttl?: number } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.email === "string" &&
    v.email.length <= 254 &&
    typeof v.password === "string" &&
    Buffer.byteLength(v.password, "utf8") <= 72 &&
    v.password.length > 0 &&
    (v.ttl === undefined || v.ttl === 15 || v.ttl === 300)
  );
}
