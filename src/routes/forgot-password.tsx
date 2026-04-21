import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  email: z.string().trim().email({ message: "Correo inválido" }).max(255),
});

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Recuperar contraseña — AUTO Gestión" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
    mode: "onBlur",
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error("No se pudo enviar el correo");
        return;
      }
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={sent ? "Revisa tu correo" : "Recuperar contraseña"}
      subtitle={sent ? "Te enviamos un enlace para restablecerla" : "Ingresa tu correo y te enviaremos instrucciones"}
      footer={
        <Link to="/login" className="font-medium text-primary hover:text-primary-hover">
          Volver a iniciar sesión
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="rounded-full bg-primary/15 p-3">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Si el correo existe, recibirás un enlace en los próximos minutos.
          </p>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary-hover">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar enlace"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
