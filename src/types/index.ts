export type UserRole = "admin" | "gerente" | "vendedor" | "almacen";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// CRM
export type CustomerType = "lead" | "cliente";
export type CustomerStage = "nuevo" | "contactado" | "cotizacion" | "negociacion" | "ganado" | "perdido";
export type CustomerSource = "referido" | "web" | "redes" | "showroom" | "otro";
export type InteractionType = "llamada" | "email" | "whatsapp" | "visita" | "otro";

export interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  type: CustomerType;
  stage: CustomerStage;
  source: CustomerSource;
  assigned_to: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerInteraction {
  id: string;
  customer_id: string;
  type: InteractionType;
  description: string;
  author_id: string | null;
  created_at: string;
}
