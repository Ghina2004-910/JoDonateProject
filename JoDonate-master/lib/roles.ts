export type UserRole = "user" | "committee" | "admin";

export function normalizeRole(value: unknown): UserRole {
  if (value === "admin" || value === "committee") return value;
  return "user";
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

export function isCommitteeRole(role: UserRole): boolean {
  return role === "committee" || role === "admin";
}
