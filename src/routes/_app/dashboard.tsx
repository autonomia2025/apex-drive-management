import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, Package, Users2, ShoppingCart, Sparkles, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { RoleBadge } from "@/components/shared/RoleBadge";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — AUTO Gestión" }] }),
  component: DashboardPage,
});

const MODULES = [
  { name: "Inventario", desc: "Catálogo de vehículos, stock y disponibilidad.", icon: Package },
  { name: "CRM", desc: "Gestión de leads, prospectos y seguimiento.", icon: Users2 },
  { name: "Ventas", desc: "Cotizaciones, contratos y cierre de operaciones.", icon: ShoppingCart },
  { name: "Asistente IA", desc: "Recomendaciones y análisis automatizados.", icon: Sparkles },
];

function DashboardPage() {
  const { profile, role } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Hero */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-surface to-background p-8">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Bienvenido</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Hola, <span className="text-gradient-red">{firstName}</span>
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {role && <RoleBadge role={role} />}
          <span className="text-sm text-muted-foreground">{profile?.email}</span>
        </div>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          El sistema está en construcción progresiva. Esta fase cubre la gestión de usuarios y accesos.
          Próximamente se habilitarán los módulos de inventario, CRM, ventas y asistente inteligente.
        </p>
      </div>

      {/* Modules */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Módulos disponibles próximamente
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <div
              key={m.name}
              className="group relative overflow-hidden rounded-lg border border-border bg-surface p-5 transition-colors hover:border-border/80"
            >
              <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Lock className="h-2.5 w-2.5" />
                Próximamente
              </div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <m.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{m.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
