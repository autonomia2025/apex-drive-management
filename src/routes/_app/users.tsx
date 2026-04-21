import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, MoreVertical, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { LoadingSpinner, EmptyState } from "@/components/shared/states";
import { useAuth } from "@/hooks/useAuth";
import { canAccess, ROLE_LABELS } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, UserRole } from "@/types";

export const Route = createFileRoute("/_app/users")({
  head: () => ({ meta: [{ title: "Usuarios — AUTO Gestión" }] }),
  component: UsersPage,
});

interface Row extends Profile {
  role: UserRole | null;
  last_activity: string | null;
}

const inviteSchema = z.object({
  full_name: z.string().trim().min(3, { message: "Mínimo 3 caracteres" }).max(100),
  email: z.string().trim().email({ message: "Correo inválido" }).max(255),
  role: z.enum(["admin", "gerente", "vendedor", "almacen"]),
});

const ROLES: UserRole[] = ["admin", "gerente", "vendedor", "almacen"];

function UsersPage() {
  const { role: currentRole, user: currentUser } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  // Guard
  if (currentRole && !canAccess(currentRole, "users")) {
    throw redirect({ to: "/dashboard" });
  }

  const load = async () => {
    setRows(null);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const { data: activity } = await supabase
      .from("activity_log")
      .select("user_id, created_at")
      .order("created_at", { ascending: false });

    const roleMap = new Map<string, UserRole>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as UserRole));
    const lastMap = new Map<string, string>();
    (activity ?? []).forEach((a) => {
      if (a.user_id && !lastMap.has(a.user_id)) lastMap.set(a.user_id, a.created_at);
    });

    setRows(
      ((profiles ?? []) as Profile[]).map((p) => ({
        ...p,
        role: roleMap.get(p.id) ?? null,
        last_activity: lastMap.get(p.id) ?? null,
      })),
    );
  };

  useEffect(() => {
    load();
  }, []);

  const onInvite = async (values: z.infer<typeof inviteSchema>) => {
    // Use Supabase auth resetPassword as invite mechanism: we create the user via signUp
    // (with random password) which sends a verification email, then the user uses
    // forgot-password to set their own. This avoids needing service role on the client.
    const tempPassword = crypto.randomUUID() + "Aa1!";
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: tempPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: { full_name: values.full_name, invited: true },
      },
    });
    if (error || !data.user) {
      toast.error(error?.message.includes("registered") ? "Este correo ya existe" : "No se pudo crear el usuario");
      return;
    }

    // Update role from default 'vendedor' to chosen one
    if (values.role !== "vendedor") {
      await supabase.from("user_roles").delete().eq("user_id", data.user.id);
      await supabase.from("user_roles").insert([{ user_id: data.user.id, role: values.role }]);
    }

    // Send password recovery email so they can set their password
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (currentUser) {
      await supabase.from("activity_log").insert([
        {
          user_id: currentUser.id,
          action: "user_invited",
          details: { email: values.email, role: values.role } as never,
        },
      ]);
    }

    toast.success("Invitación enviada", {
      description: "El usuario recibirá un correo para configurar su contraseña.",
    });
    setInviteOpen(false);
    load();
  };

  const onChangeRole = async (userId: string, newRole: UserRole) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert([{ user_id: userId, role: newRole }]);
    if (error) {
      toast.error("No se pudo actualizar el rol");
      return;
    }
    if (currentUser) {
      await supabase.from("activity_log").insert([
        { user_id: currentUser.id, action: "role_changed", details: { target: userId, role: newRole } as never },
      ]);
    }
    toast.success("Rol actualizado");
    load();
  };

  const onToggleActive = async (row: Row) => {
    const next = !row.is_active;
    const { error } = await supabase.from("profiles").update({ is_active: next }).eq("id", row.id);
    if (error) {
      toast.error("No se pudo actualizar el estado");
      return;
    }
    if (currentUser) {
      await supabase.from("activity_log").insert([
        { user_id: currentUser.id, action: next ? "user_activated" : "user_deactivated", details: { target: row.id } as never },
      ]);
    }
    toast.success(next ? "Usuario activado" : "Usuario desactivado");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Gestión de usuarios</h2>
          <p className="text-sm text-muted-foreground">Invita, edita roles y controla accesos.</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary-hover hover:glow-primary">
              <Plus className="mr-1.5 h-4 w-4" />
              Crear usuario
            </Button>
          </DialogTrigger>
          <InviteDialog onSubmit={onInvite} />
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {rows === null ? (
          <LoadingSpinner label="Cargando usuarios…" />
        ) : rows.length === 0 ? (
          <EmptyState title="Sin usuarios" description="Crea el primer usuario para comenzar." icon={UserPlus} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Creado</TableHead>
                <TableHead className="hidden md:table-cell">Última actividad</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const initials = row.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <TableRow key={row.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={row.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-surface-elevated text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium text-foreground">{row.full_name}</div>
                          <div className="text-xs text-muted-foreground">{row.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{row.role && <RoleBadge role={row.role} />}</TableCell>
                    <TableCell>
                      <span
                        className={
                          "inline-flex items-center gap-1.5 text-xs " +
                          (row.is_active ? "text-success" : "text-muted-foreground")
                        }
                      >
                        <span className={"h-1.5 w-1.5 rounded-full " + (row.is_active ? "bg-success" : "bg-muted-foreground")} />
                        {row.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {new Date(row.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {row.last_activity
                        ? new Date(row.last_activity).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(row)}>Editar rol</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onToggleActive(row)}
                            className={row.is_active ? "text-destructive focus:text-destructive" : ""}
                          >
                            {row.is_active ? "Desactivar" : "Activar"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit role */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent className="bg-surface">
            <DialogHeader>
              <DialogTitle>Editar rol</DialogTitle>
              <DialogDescription>{editing.full_name} — {editing.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                defaultValue={editing.role ?? undefined}
                onValueChange={(v) => onChangeRole(editing.id, v as UserRole).then(() => setEditing(null))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function InviteDialog({ onSubmit }: { onSubmit: (v: z.infer<typeof inviteSchema>) => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { full_name: "", email: "", role: "vendedor" },
    mode: "onBlur",
  });

  return (
    <DialogContent className="bg-surface">
      <DialogHeader>
        <DialogTitle>Invitar usuario</DialogTitle>
        <DialogDescription>El usuario recibirá un correo para configurar su contraseña.</DialogDescription>
      </DialogHeader>
      <form
        id="invite-form"
        onSubmit={form.handleSubmit(async (v) => {
          setSubmitting(true);
          try {
            await onSubmit(v);
            form.reset();
          } finally {
            setSubmitting(false);
          }
        })}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label>Nombre completo</Label>
          <Input {...form.register("full_name")} />
          {form.formState.errors.full_name && (
            <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Correo electrónico</Label>
          <Input type="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Rol</Label>
          <Select defaultValue="vendedor" onValueChange={(v) => form.setValue("role", v as UserRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </form>
      <DialogFooter>
        <Button form="invite-form" type="submit" disabled={submitting} className="bg-primary hover:bg-primary-hover">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar invitación"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
