import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingSpinner, EmptyState } from "@/components/shared/states";
import { useAuth } from "@/hooks/useAuth";
import { canAccess } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/activity-log")({
  head: () => ({ meta: [{ title: "Registro de actividad — AUTO Gestión" }] }),
  component: ActivityLogPage,
});

const PAGE_SIZE = 25;

interface Entry {
  id: string;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user_name?: string;
}

const ACTIONS = ["login", "logout", "user_invited", "role_changed", "user_activated", "user_deactivated", "password_changed"];

function ActivityLogPage() {
  const { role } = useAuth();
  if (role && !canAccess(role, "activity_log")) {
    throw redirect({ to: "/dashboard" });
  }

  const [rows, setRows] = useState<Entry[] | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("id, full_name").order("full_name").then(({ data }) => {
      setUsers((data ?? []) as { id: string; full_name: string }[]);
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      setRows(null);
      let q = supabase
        .from("activity_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (filterUser) q = q.eq("user_id", filterUser);
      if (filterAction !== "all") q = q.eq("action", filterAction);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to + "T23:59:59");

      const { data, count: c } = await q;
      const userMap = new Map(users.map((u) => [u.id, u.full_name]));
      setRows(
        ((data ?? []) as Entry[]).map((e) => ({ ...e, user_name: e.user_id ? userMap.get(e.user_id) : "—" })),
      );
      setCount(c ?? 0);
    };
    load();
  }, [page, filterUser, filterAction, from, to, users]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / PAGE_SIZE)), [count]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Registro de actividad</h2>
        <p className="text-sm text-muted-foreground">Auditoría de eventos críticos del sistema.</p>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Usuario</Label>
          <Select value={filterUser || "all"} onValueChange={(v) => { setFilterUser(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Acción</Label>
          <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Desde</Label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Hasta</Label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {rows === null ? (
          <LoadingSpinner label="Cargando registro…" />
        ) : rows.length === 0 ? (
          <EmptyState title="Sin actividad" description="Aún no hay eventos registrados con estos filtros." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead className="hidden md:table-cell">Detalles</TableHead>
                <TableHead className="hidden md:table-cell">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id} className="border-border">
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("es", {
                      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-sm">{e.user_name ?? "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-md bg-surface-elevated px-2 py-0.5 font-mono text-xs text-foreground">
                      {e.action}
                    </span>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {e.details ? JSON.stringify(e.details) : "—"}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {e.ip_address ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {count > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Página {page + 1} de {totalPages} · {count} eventos
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
