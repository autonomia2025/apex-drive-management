import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  Filter,
  X,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Loader2,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { LoadingSpinner, EmptyState } from "@/components/shared/states";
import { StageBadge } from "@/components/crm/StageBadge";
import { useAuth } from "@/hooks/useAuth";
import { canAccess } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import {
  PAGE_SIZE,
  SOURCES,
  SOURCE_LABELS,
  STAGES,
  STAGE_LABELS,
  TYPES,
  TYPE_LABELS,
} from "@/lib/crm";
import type { Customer, CustomerSource, CustomerStage, CustomerType, Profile } from "@/types";
import { cn } from "@/lib/utils";

import { zodValidator, fallback } from "@tanstack/zod-adapter";

type SortKey = "created_at" | "updated_at" | "full_name";
type SortDir = "asc" | "desc";

const stageEnum = z.enum(["all", ...STAGES] as [string, ...string[]]);
const typeEnum = z.enum(["all", ...TYPES] as [string, ...string[]]);
const sourceEnum = z.enum(["all", ...SOURCES] as [string, ...string[]]);

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  stage: fallback(stageEnum, "all").default("all"),
  type: fallback(typeEnum, "all").default("all"),
  source: fallback(sourceEnum, "all").default("all"),
  assignee: fallback(z.string(), "all").default("all"),
  sort: fallback(z.enum(["created_at", "updated_at", "full_name"]), "created_at").default(
    "created_at",
  ),
  dir: fallback(z.enum(["asc", "desc"]), "desc").default("desc"),
  page: fallback(z.coerce.number().int().min(1), 1).default(1),
});

type SearchParams = {
  q: string;
  stage: CustomerStage | "all";
  type: CustomerType | "all";
  source: CustomerSource | "all";
  assignee: string;
  sort: SortKey;
  dir: SortDir;
  page: number;
};

export const Route = createFileRoute("/_app/crm/")({
  head: () => ({ meta: [{ title: "CRM — AUTO Gestión" }] }),
  validateSearch: zodValidator(searchSchema),
  component: CrmListPage,
});

const customerSchema = z.object({
  full_name: z.string().trim().min(2, { message: "Mínimo 2 caracteres" }).max(120),
  email: z
    .string()
    .trim()
    .email({ message: "Correo inválido" })
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  type: z.enum(["lead", "cliente"]),
  stage: z.enum(["nuevo", "contactado", "cotizacion", "negociacion", "ganado", "perdido"]),
  source: z.enum(["referido", "web", "redes", "showroom", "otro"]),
  assigned_to: z.string().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
type CustomerForm = z.infer<typeof customerSchema>;

function CrmListPage() {
  const { role, user, logActivity } = useAuth();
  const navigate = useNavigate({ from: "/crm" });
  const search = Route.useSearch();

  if (role && !canAccess(role, "crm")) {
    throw redirect({ to: "/dashboard" });
  }

  const [rows, setRows] = useState<Customer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // Load assignable profiles (active sales staff)
  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setProfiles((data ?? []) as Profile[]));
  }, []);

  // Load customers based on filters
  useEffect(() => {
    let cancelled = false;
    setRows(null);

    const run = async () => {
      let query = supabase.from("customers").select("*", { count: "exact" });

      if (search.q.trim()) {
        const term = `%${search.q.trim()}%`;
        query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
      }
      if (search.stage !== "all") query = query.eq("stage", search.stage);
      if (search.type !== "all") query = query.eq("type", search.type);
      if (search.source !== "all") query = query.eq("source", search.source);
      if (search.assignee === "unassigned") query = query.is("assigned_to", null);
      else if (search.assignee !== "all") query = query.eq("assigned_to", search.assignee);

      query = query.order(search.sort, { ascending: search.dir === "asc" });

      const from = (search.page - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, count, error } = await query;
      if (cancelled) return;
      if (error) {
        toast.error("Error al cargar clientes");
        setRows([]);
        return;
      }
      setRows((data ?? []) as Customer[]);
      setTotal(count ?? 0);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    search.q,
    search.stage,
    search.type,
    search.source,
    search.assignee,
    search.sort,
    search.dir,
    search.page,
  ]);

  const setParam = <K extends keyof SearchParams>(key: K, value: SearchParams[K]) => {
    navigate({
      search: (prev: SearchParams) => ({
        ...prev,
        [key]: value,
        page: key === "page" ? (value as number) : 1,
      }),
    });
  };

  const toggleSort = (key: SortKey) => {
    if (search.sort === key) {
      setParam("dir", search.dir === "asc" ? "desc" : "asc");
    } else {
      navigate({ search: (prev: SearchParams) => ({ ...prev, sort: key, dir: "desc", page: 1 }) });
    }
  };

  const clearFilters = () => {
    navigate({
      search: {
        q: "",
        stage: "all",
        type: "all",
        source: "all",
        assignee: "all",
        sort: "created_at",
        dir: "desc",
        page: 1,
      },
    });
  };

  const hasFilters =
    search.q ||
    search.stage !== "all" ||
    search.type !== "all" ||
    search.source !== "all" ||
    search.assignee !== "all";

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onCreate = async (values: CustomerForm) => {
    if (!user) return;
    const payload = {
      full_name: values.full_name,
      email: values.email || null,
      phone: values.phone || null,
      type: values.type,
      stage: values.stage,
      source: values.source,
      assigned_to: values.assigned_to && values.assigned_to !== "none" ? values.assigned_to : null,
      notes: values.notes || null,
      created_by: user.id,
    };
    const { data, error } = await supabase.from("customers").insert([payload]).select().single();
    if (error) {
      toast.error("No se pudo crear el cliente");
      return;
    }
    await logActivity("customer_created", { customer_id: data.id, full_name: data.full_name });
    toast.success("Cliente creado");
    setCreateOpen(false);
    navigate({ search: (prev: SearchParams) => ({ ...prev, page: 1 }) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">CRM</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona prospectos y clientes.{" "}
            {total > 0 && `${total} ${total === 1 ? "registro" : "registros"}`}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary-hover hover:glow-primary">
              <Plus className="mr-1.5 h-4 w-4" />
              Nuevo cliente
            </Button>
          </DialogTrigger>
          <CustomerFormDialog
            title="Crear cliente"
            description="Captura un prospecto o cliente nuevo."
            profiles={profiles}
            onSubmit={onCreate}
          />
        </Dialog>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search.q}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Buscar por nombre, email o teléfono…"
              className="pl-9"
            />
          </div>

          <Select
            value={search.stage}
            onValueChange={(v) => setParam("stage", v as SearchParams["stage"])}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las etapas</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={search.type}
            onValueChange={(v) => setParam("type", v as SearchParams["type"])}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Lead y cliente</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={search.source}
            onValueChange={(v) => setParam("source", v as SearchParams["source"])}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Origen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los orígenes</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={search.assignee} onValueChange={(v) => setParam("assignee", v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los vendedores</SelectItem>
              <SelectItem value="unassigned">Sin asignar</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {rows === null ? (
          <LoadingSpinner label="Cargando clientes…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title={hasFilters ? "Sin resultados" : "Aún no hay clientes"}
            description={
              hasFilters
                ? "Prueba ajustando o limpiando los filtros."
                : "Crea el primer cliente para empezar."
            }
            icon={hasFilters ? Filter : UserCircle2}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("full_name")}
                  >
                    Cliente
                    <ArrowUpDown
                      className={cn("h-3 w-3", search.sort === "full_name" && "text-primary")}
                    />
                  </button>
                </TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="hidden lg:table-cell">Origen</TableHead>
                <TableHead className="hidden md:table-cell">Vendedor</TableHead>
                <TableHead className="hidden md:table-cell">
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("updated_at")}
                  >
                    Actualizado
                    <ArrowUpDown
                      className={cn("h-3 w-3", search.sort === "updated_at" && "text-primary")}
                    />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const assignee = c.assigned_to ? profilesById.get(c.assigned_to) : null;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer border-border"
                    onClick={() =>
                      navigate({ to: "/crm/$customerId", params: { customerId: c.id } })
                    }
                  >
                    <TableCell>
                      <div className="font-medium text-foreground">{c.full_name}</div>
                      <div className="text-xs text-muted-foreground">{TYPE_LABELS[c.type]}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {c.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </div>
                        )}
                        {!c.email && !c.phone && <span>—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={c.stage} />
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {SOURCE_LABELS[c.source]}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {assignee?.full_name ?? <span className="italic">Sin asignar</span>}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {new Date(c.updated_at).toLocaleDateString("es", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {rows && rows.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Página {search.page} de {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={search.page <= 1}
              onClick={() => setParam("page", search.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={search.page >= totalPages}
              onClick={() => setParam("page", search.page + 1)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomerFormDialog({
  title,
  description,
  profiles,
  defaults,
  onSubmit,
}: {
  title: string;
  description?: string;
  profiles: Profile[];
  defaults?: Partial<CustomerForm>;
  onSubmit: (v: CustomerForm) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      type: "lead",
      stage: "nuevo",
      source: "otro",
      assigned_to: "none",
      notes: "",
      ...defaults,
    },
    mode: "onBlur",
  });

  return (
    <DialogContent className="max-w-lg bg-surface">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <form
        id="customer-form"
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
          <Label>Nombre completo *</Label>
          <Input {...form.register("full_name")} />
          {form.formState.errors.full_name && (
            <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input {...form.register("phone")} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              defaultValue={form.getValues("type")}
              onValueChange={(v) => form.setValue("type", v as CustomerType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select
              defaultValue={form.getValues("stage")}
              onValueChange={(v) => form.setValue("stage", v as CustomerStage)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Origen</Label>
            <Select
              defaultValue={form.getValues("source")}
              onValueChange={(v) => form.setValue("source", v as CustomerSource)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Vendedor asignado</Label>
          <Select
            defaultValue={form.getValues("assigned_to") ?? "none"}
            onValueChange={(v) => form.setValue("assigned_to", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Notas</Label>
          <Textarea
            rows={3}
            {...form.register("notes")}
            placeholder="Información relevante del cliente…"
          />
        </div>
      </form>
      <DialogFooter>
        <Button
          form="customer-form"
          type="submit"
          disabled={submitting}
          className="bg-primary hover:bg-primary-hover"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
