export type WorkspaceRole = "OWNER" | "ADMIN" | "MANAGER" | "STAFF";

export function canManageFleet(role: string): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER";
}

export function canManageTeam(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageWorkspaceSettings(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageBilling(role: string): boolean {
  return role === "OWNER";
}
