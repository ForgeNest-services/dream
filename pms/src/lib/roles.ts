export type RoleCode = "app_owner" | "manager" | "front_desk";

export const ROLE_LABELS: Record<RoleCode, string> = {
  app_owner: "App Owner",
  manager: "Manager",
  front_desk: "Front Desk",
};

export const ALL_ROLES: RoleCode[] = ["app_owner", "manager", "front_desk"];

export function roleLabel(code: string): string {
  return ROLE_LABELS[code as RoleCode] ?? code;
}
