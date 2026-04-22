import type { UserRole } from "@/types";

export type Resource =
  | "dashboard"
  | "profile"
  | "users"
  | "activity_log"
  | "inventory"
  | "crm"
  | "sales"
  | "reports";

const MATRIX: Record<Resource, UserRole[]> = {
  dashboard: ["admin", "gerente", "vendedor", "almacen"],
  profile: ["admin", "gerente", "vendedor", "almacen"],
  users: ["admin"],
  activity_log: ["admin", "gerente"],
  crm: ["admin", "gerente", "vendedor"],
  // future phases (placeholder)
  inventory: ["admin", "gerente", "almacen"],
  sales: ["admin", "gerente", "vendedor"],
  reports: ["admin", "gerente"],
};

export function canAccess(role: UserRole | null | undefined, resource: Resource): boolean {
  if (!role) return false;
  return MATRIX[resource].includes(role);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  vendedor: "Vendedor",
  almacen: "Almacén",
};
