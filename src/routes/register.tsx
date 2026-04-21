import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const schema = z
  .object({
    full_name: z.string().trim().min(3, { message: "Mínimo 3 caracteres" }).max(100),
    email: z.string().trim().email({ message: "Correo inválido" }).max(255),
    phone: z.string().trim().max(20).optional().or(z.literal("")),
    password: z
      .string()
      .min(8, { message: "Mínimo 8 caracteres" })
      .max(72)
      .regex(/[A-Z]/, { message: "Debe incluir una mayúscula" })
      .regex(/[0-9]/, { message: "Debe incluir un número" }),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden",
  });

type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Crear cuenta — AUTO Gestión" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", phone: "", password: "", confirm: "" },
    mode: "onBlur",
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: values.full_name,
            phone: values.phone || null,
          },
        },
      });
      if (error) {
        toast.error(error.message.includes("registered") ? "Este correo ya está registrado" : "No se pudo crear la cuenta");
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="¡Cuenta creada!" subtitle="Falta un último paso">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="rounded-full bg-success/15 p-3">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <p className="text-sm text-muted-foreground">
            Te enviamos un correo de verificación. Confirma tu cuenta para continuar.
          </p>
          <Button onClick={() => navigate({ to: "/login" })} className="w-full bg-primary hover:bg-primary-hover">
            Ir a iniciar sesión
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Únete a la plataforma"
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-medium text-primary hover:text-primary-hover">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Nombre completo" error={form.formState.errors.full_name?.message}>
          <Input autoComplete="name" placeholder="Juan Pérez" {...form.register("full_name")} />
        </Field>
        <Field label="Correo electrónico" error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="tu@empresa.com" {...form.register("email")} />
        </Field>
        <Field label="Teléfono (opcional)" error={form.formState.errors.phone?.message}>
          <Input type="tel" autoComplete="tel" placeholder="+52 555 000 0000" {...form.register("phone")} />
        </Field>
        <Field label="Contraseña" error={form.formState.errors.password?.message} hint="Mínimo 8 caracteres, una mayúscula y un número">
          <Input type="password" autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Field label="Confirmar contraseña" error={form.formState.errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...form.register("confirm")} />
        </Field>

        <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary-hover hover:glow-primary">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear cuenta"}
        </Button>
      </form>
    </AuthShell>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
