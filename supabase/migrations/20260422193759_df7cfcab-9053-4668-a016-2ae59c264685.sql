-- Extension first
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enums
CREATE TYPE public.customer_type AS ENUM ('lead', 'cliente');
CREATE TYPE public.customer_stage AS ENUM ('nuevo', 'contactado', 'cotizacion', 'negociacion', 'ganado', 'perdido');
CREATE TYPE public.customer_source AS ENUM ('referido', 'web', 'redes', 'showroom', 'otro');
CREATE TYPE public.interaction_type AS ENUM ('llamada', 'email', 'whatsapp', 'visita', 'otro');

-- Customers
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  type public.customer_type NOT NULL DEFAULT 'lead',
  stage public.customer_stage NOT NULL DEFAULT 'nuevo',
  source public.customer_source NOT NULL DEFAULT 'otro',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_assigned_to ON public.customers(assigned_to);
CREATE INDEX idx_customers_stage ON public.customers(stage);
CREATE INDEX idx_customers_type ON public.customers(type);
CREATE INDEX idx_customers_created_at ON public.customers(created_at DESC);
CREATE INDEX idx_customers_full_name_trgm ON public.customers USING gin (full_name public.gin_trgm_ops);

-- Interactions
CREATE TABLE public.customer_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type public.interaction_type NOT NULL,
  description TEXT NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interactions_customer ON public.customer_interactions(customer_id, created_at DESC);

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_customer(_customer_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin') OR
    public.has_role(_user_id, 'gerente') OR
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = _customer_id
        AND public.has_role(_user_id, 'vendedor')
        AND (c.assigned_to = _user_id OR c.assigned_to IS NULL)
    )
$$;

-- CUSTOMERS RLS
CREATE POLICY "Admins and gerentes view all customers"
  ON public.customers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "Vendedores view assigned or unassigned customers"
  ON public.customers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor')
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  );

CREATE POLICY "Admins gerentes vendedores can create customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gerente') OR
    public.has_role(auth.uid(), 'vendedor')
  );

CREATE POLICY "Admins and gerentes update any customer"
  ON public.customers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "Vendedores update assigned customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor')
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
  );

CREATE POLICY "Admins and gerentes delete customers"
  ON public.customers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

-- INTERACTIONS RLS
CREATE POLICY "View interactions if can access customer"
  ON public.customer_interactions FOR SELECT TO authenticated
  USING (public.can_access_customer(customer_id, auth.uid()));

CREATE POLICY "Insert interactions if can access customer"
  ON public.customer_interactions FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_customer(customer_id, auth.uid())
    AND author_id = auth.uid()
  );

CREATE POLICY "Authors and admins/gerentes delete interactions"
  ON public.customer_interactions FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
  );