import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  ScrollText,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Sparkles,
  Lock,
  Contact,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { useAuth } from "@/hooks/useAuth";
import { canAccess, type Resource } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NavItem {
  to: "/dashboard" | "/profile" | "/users" | "/activity-log" | "/crm";
  label: string;
  icon: typeof LayoutDashboard;
  resource: Resource;
}

const ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, resource: "dashboard" },
  { to: "/crm", label: "CRM", icon: Contact, resource: "crm" },
  { to: "/users", label: "Usuarios", icon: Users, resource: "users" },
  { to: "/activity-log", label: "Registro de actividad", icon: ScrollText, resource: "activity_log" },
];

const FUTURE = [
  { label: "Inventario", icon: Lock },
  { label: "Ventas", icon: Lock },
  { label: "Reportes", icon: Lock },
  { label: "Asistente IA", icon: Sparkles },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();

  const visible = ITEMS.filter((i) => canAccess(role, i.resource));

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Logo />
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {visible.map((item) => {
              const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active && "text-primary")} />
                  {item.label}
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                </Link>
              );
            })}
          </div>

          {/* Future modules */}
          <div className="mt-8">
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Próximamente
            </div>
            <div className="space-y-0.5">
              {FUTURE.map((f) => (
                <div
                  key={f.label}
                  className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
                >
                  <f.icon className="h-3.5 w-3.5" />
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        </nav>

        {/* User dropdown */}
        <div className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-sidebar-accent">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{profile?.full_name ?? "Usuario"}</div>
                  <div className="truncate text-xs text-muted-foreground">{profile?.email}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <UserIcon className="mr-2 h-4 w-4" />
                  Mi perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden">
      <Menu className="h-5 w-5" />
    </button>
  );
}

export function useSidebarState() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
