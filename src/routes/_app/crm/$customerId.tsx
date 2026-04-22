import { createFileRoute, Link, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Mail,
  Phone,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  Calendar,
  PhoneCall,
  MessageSquare,
  AtSign,
  MapPin,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/shared/states";
import { StageBadge } from "@/components/crm/StageBadge";
import { useAuth } from "@/hooks/useAuth";
import { canAccess } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import {
  INTERACTION_LABELS,
  INTERACTION_TYPES,
  SOURCE_LABELS,
  TYPE_LABELS,
} from "@/lib/crm";
import type {
  Customer,
  CustomerInteraction,
  InteractionType,
  Profile,
} from "@/types";
import { CustomerFormDialog } from "./index";

export const Route = createFileRoute("/_app/crm/$customerId")({
  head: () => ({ meta: [{ title: "Cliente — AUTO Gestión" }] }),
  component: CustomerDetailPage,
  notFoundComponent: () => (
    <div className="py-16 text-center text-muted-foreground">
      Cliente no encontrado.{" "}
      <Link to="/crm" className="text-primary hover:underline">Volver al CRM</Link>
    </div>
  ),
});

const interactionSchema = z.object({
  type: z.enum(["llamada", "email", "whatsapp", "visita", "otro"]),
  description: z.string().trim().min(2, { message: "Mínimo 2 caracteres" }).max(1000),
});
type InteractionForm = z.infer<typeof interactionSchema>;

const INTERACTION_ICONS: Record<InteractionType, typeof PhoneCall> = {
  llamada: PhoneCall,
  email: AtSign,
  whatsapp: MessageSquare,
  visita: MapPin,
  otro: Calendar,
};

function CustomerDetailPage() {
  const { customerId } = Route.useParams();
  const router = useRouter();
  const navigate = useNavigate();
  const { role, user, logActivity } = useAuth();

  if (role && !canAccess(role, "crm")) {
    throw redirect({ to: "/dashboard" });
  }

  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);
  const [interactions, setInteractions] = useState<CustomerInteraction[] | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canManage = role === "admin" || role === "gerente";

  const load = async () => {
    const [{ data: c }, { data: ints }, { data: profs }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
      supabase
        .from("customer_interactions")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("is_active", true).order("full_name"),
    ]);
    setCustomer((c as Customer) ?? null);
    setInteractions((ints ?? []) as CustomerInteraction[]);
    setProfiles((profs ?? []) as Profile[]);
  };

  useEffect(() => {
    load();
  }, [customerId]);

  const interactionForm = useForm<InteractionForm>({
    resolver: zodResolver(interactionSchema),
    defaultValues: { type: "llamada", description: "" },
    mode: "onBlur",
  });

  const onAddInteraction = interactionForm.handleSubmit(async (v) => {
    if (!user) return;
    const { error } = await supabase.from("customer_interactions").insert([
      { customer_id: customerId, type: v.type, description: v.description, author_id: user.id },
    ]);
    if (error) {
      toast.error("No se pudo registrar la interacción");
      return;
    }
    await logActivity("interaction_created", { customer_id: customerId, type: v.type });
    interactionForm.reset({ type: v.type, description: "" });
    toast.success("Interacción registrada");
    load();
  });

  const onUpdate = async (values: Parameters<typeof CustomerFormDialog>[0]["onSubmit"] extends (v: infer V) => unknown ? V : never) => {
    const payload = {
      full_name: values.full_name,
      email: values.email || null,
      phone: values.phone || null,
      type: values.type,
      stage: values.stage,
      source: values.source,
      assigned_to: values.assigned_to && values.assigned_to !== "none" ? values.assigned_to : null,
      notes: values.notes || null,
    };
    const { error } = await supabase.from("customers").update(payload).eq("id", customerId);
    if (error) {
      toast.error("No se pudo actualizar");
      return;
    }
    await logActivity("customer_updated", { customer_id: customerId });
    toast.success("Cliente actualizado");
    setEditOpen(false);
    load();
  };

  const onDelete = async () => {
    const { error } = await supabase.from("customers").delete().eq("id", customerId);
    if (error) {
      toast.error("No se pudo eliminar");
      return;
    }
    await logActivity("customer_deleted", { customer_id: customerId });
    toast.success("Cliente eliminado");
    navigate({ to: "/crm" });
  };

  const onDeleteInteraction = async (id: string) => {
    const { error } = await supabase.from("customer_interactions").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar");
      return;
    }
    load();
  };

  const onChangeStage = async (stage: Customer["stage"]) => {
    if (!customer) return;
    const { error } = await supabase.from("customers").update({ stage }).eq("id", customerId);
    if (error) {
      toast.error("No se pudo actualizar la etapa");
      return;
    }
    await logActivity("customer_stage_changed", { customer_id: customerId, stage });
    setCustomer({ ...customer, stage });
    toast.success("Etapa actualizada");
  };

  if (customer === undefined) return <LoadingSpinner label="Cargando…" />;
  if (customer === null) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Cliente no encontrado.{" "}
        <Link to="/crm" className="text-primary hover:underline">Volver al CRM</Link>
      </div>
    );
  }

  const assignee = customer.assigned_to ? profiles.find((p) => p.id === customer.assigned_to) : null;
  const profilesById = new Map(profiles.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.history.back()}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{customer.full_name}</h2>
            <span className="rounded-md border border-border bg-surface-elevated px-2 py-0.5 text-xs text-muted-foreground">
              {TYPE_LABELS[customer.type]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {customer.email && (
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{customer.email}</span>
            )}
            {customer.phone && (
              <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span>Origen: <span className="text-foreground">{SOURCE_LABELS[customer.source]}</span></span>
            <span className="text-border">·</span>
            <span>Vendedor: <span className="text-foreground">{assignee?.full_name ?? "Sin asignar"}</span></span>
            <span className="text-border">·</span>
            <span>Creado: {new Date(customer.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={customer.stage} onValueChange={(v) => onChangeStage(v as Customer["stage"])}>
            <SelectTrigger className="w-[160px] border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["nuevo", "contactado", "cotizacion", "negociacion", "ganado", "perdido"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  <StageBadge stage={s} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
            </Button>
            <CustomerFormDialog
              title="Editar cliente"
              profiles={profiles}
              defaults={{
                full_name: customer.full_name,
                email: customer.email ?? "",
                phone: customer.phone ?? "",
                type: customer.type,
                stage: customer.stage,
                source: customer.source,
                assigned_to: customer.assigned_to ?? "none",
                notes: customer.notes ?? "",
              }}
              onSubmit={onUpdate}
            />
          </Dialog>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Notas */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Notas</h3>
          {customer.notes ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{customer.notes}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground/60">Sin notas.</p>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Bitácora de interacciones</h3>
          </div>

          {/* Add interaction */}
          <form onSubmit={onAddInteraction} className="space-y-3 rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <Select
                defaultValue="llamada"
                onValueChange={(v) => interactionForm.setValue("type", v as InteractionType)}
              >
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{INTERACTION_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className="sr-only">Descripción</Label>
            </div>
            <Textarea
              rows={2}
              placeholder="Describe brevemente la interacción…"
              {...interactionForm.register("description")}
            />
            {interactionForm.formState.errors.description && (
              <p className="text-xs text-destructive">{interactionForm.formState.errors.description.message}</p>
            )}
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={interactionForm.formState.isSubmitting}
                className="bg-primary hover:bg-primary-hover"
              >
                {interactionForm.formState.isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <><Plus className="mr-1 h-3.5 w-3.5" /> Registrar</>
                )}
              </Button>
            </div>
          </form>

          {/* List */}
          {interactions === null ? (
            <LoadingSpinner />
          ) : interactions.length === 0 ? (
            <p className="py-6 text-center text-sm italic text-muted-foreground/60">
              Aún no hay interacciones registradas.
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {interactions.map((it) => {
                const Icon = INTERACTION_ICONS[it.type];
                const author = it.author_id ? profilesById.get(it.author_id) : null;
                const canDelete = it.author_id === user?.id || canManage;
                return (
                  <li key={it.id} className="relative">
                    <span className="absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background">
                      <Icon className="h-3 w-3 text-primary" />
                    </span>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-medium text-foreground">
                            {INTERACTION_LABELS[it.type]}
                            {author && <span className="ml-2 font-normal text-muted-foreground">por {author.full_name}</span>}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(it.created_at).toLocaleString("es", {
                              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </div>
                        </div>
                        {canDelete && (
                          <button
                            onClick={() => onDeleteInteraction(it.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Eliminar"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{it.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. También se eliminarán todas las interacciones registradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
