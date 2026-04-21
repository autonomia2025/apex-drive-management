import type { UserRole } from "@/types";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const STYLES: Record<UserRole, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  gerente: "bg-warning/15 text-warning border-warning/30",
  vendedor: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  almacen: "bg-success/15 text-success border-success/30",
};

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wider",
        STYLES[role],
        className,
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
