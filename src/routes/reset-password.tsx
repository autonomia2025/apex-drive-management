import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const schema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Mínimo 8 caracteres" })
      .max(72)
      .regex(/[A-Z]/, { message: "Debe incluir una mayúscula" })
      .regex(/[0-9]/, { message: "Debe incluir un número" }),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Restablecer contraseña — AUTO Gestión" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
    mode: "onBlur",
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) {
        toast.error("No se pudo cambiar la contraseña");
        return;
      }
      await supabase.auth.signOut();
      toast.success("Contraseña actualizada", { description: "Inicia sesión con tu nueva contraseña." });
      navigate({ to: "/login" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Nueva contraseña" subtitle="Define una contraseña segura">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>Nueva contraseña</Label>
          <Input type="password" autoComplete="new-password" {...form.register("password")} />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres, una mayúscula y un número</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Confirmar contraseña</Label>
          <Input type="password" autoComplete="new-password" {...form.register("confirm")} />
          {form.formState.errors.confirm && (
            <p className="text-xs text-destructive">{form.formState.errors.confirm.message}</p>
          )}
        </div>
        <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary-hover">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cambiar contraseña"}
        </Button>
      </form>
    </AuthShell>
  );
}
