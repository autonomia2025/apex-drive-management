import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  email: z.string().trim().email({ message: "Correo inválido" }).max(255),
  password: z.string().min(1, { message: "Ingresa tu contraseña" }).max(100),
  remember: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión — AUTO Gestión" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: true },
    mode: "onBlur",
  });

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          toast.error("Verifica tu correo primero", {
            description: "Te enviamos un enlace al registrarte.",
          });
        } else {
          toast.error("Credenciales inválidas");
        }
        return;
      }

      // Check if active
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active, full_name")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile && !profile.is_active) {
        await supabase.auth.signOut();
        toast.error("Tu cuenta está desactivada", {
          description: "Contacta al administrador.",
        });
        return;
      }

      await supabase.from("activity_log").insert([
        { user_id: data.user.id, action: "login", details: null as never },
      ]);

      toast.success(`Bienvenido${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`);
      navigate({ to: "/dashboard" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Accede a la plataforma de gestión"
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="font-medium text-primary hover:text-primary-hover">
            Crear cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" placeholder="tu@empresa.com" className="pl-9" {...form.register("email")} />
          </div>
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:text-primary-hover">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type="password" autoComplete="current-password" className="pl-9" {...form.register("password")} />
          </div>
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="remember" defaultChecked onCheckedChange={(v) => form.setValue("remember", !!v)} />
          <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
            Recordarme
          </Label>
        </div>

        <Button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground hover:bg-primary-hover hover:glow-primary">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar sesión"}
        </Button>
      </form>
    </AuthShell>
  );
}
