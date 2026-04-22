import type { CustomerSource, CustomerStage, CustomerType, InteractionType } from "@/types";

export const STAGE_LABELS: Record<CustomerStage, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  cotizacion: "Cotización",
  negociacion: "Negociación",
  ganado: "Ganado",
  perdido: "Perdido",
};

export const STAGE_ORDER: CustomerStage[] = [
  "nuevo",
  "contactado",
  "cotizacion",
  "negociacion",
  "ganado",
  "perdido",
];

// Tailwind classes per stage (uses semantic tokens + a few colored badges)
export const STAGE_STYLES: Record<CustomerStage, string> = {
  nuevo: "bg-surface-elevated text-foreground border-border",
  contactado: "bg-primary/10 text-primary border-primary/30",
  cotizacion: "bg-warning/10 text-warning border-warning/30",
  negociacion: "bg-warning/15 text-warning border-warning/40",
  ganado: "bg-success/15 text-success border-success/30",
  perdido: "bg-muted text-muted-foreground border-border",
};

export const TYPE_LABELS: Record<CustomerType, string> = {
  lead: "Lead",
  cliente: "Cliente",
};

export const SOURCE_LABELS: Record<CustomerSource, string> = {
  referido: "Referido",
  web: "Sitio web",
  redes: "Redes sociales",
  showroom: "Showroom",
  otro: "Otro",
};

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  llamada: "Llamada",
  email: "Email",
  whatsapp: "WhatsApp",
  visita: "Visita",
  otro: "Otro",
};

export const STAGES: CustomerStage[] = STAGE_ORDER;
export const TYPES: CustomerType[] = ["lead", "cliente"];
export const SOURCES: CustomerSource[] = ["referido", "web", "redes", "showroom", "otro"];
export const INTERACTION_TYPES: InteractionType[] = [
  "llamada",
  "email",
  "whatsapp",
  "visita",
  "otro",
];

export const PAGE_SIZE = 20;
