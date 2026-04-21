import { useLocation } from "@tanstack/react-router";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { useAuth } from "@/hooks/useAuth";
import { MobileMenuButton } from "./Sidebar";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/profile": "Mi perfil",
  "/users": "Usuarios",
  "/activity-log": "Registro de actividad",
};

export function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();
  const { role } = useAuth();
  const title = TITLES[location.pathname] ?? "AUTO Gestión";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        <MobileMenuButton onClick={onMenuClick} />
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            AUTO Gestión
          </div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {role && <RoleBadge role={role} />}
      </div>
    </header>
  );
}
