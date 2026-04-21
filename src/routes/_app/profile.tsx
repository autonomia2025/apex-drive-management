import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Upload, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { RoleBadge } from "@/components/shared/RoleBadge";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Mi perfil — AUTO Gestión" }] }),
  component: ProfilePage,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(3, { message: "Mínimo 3 caracteres" }).max(100),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});

const passwordSchema = z
  .object({
    current: z.string().min(1, { message: "Requerido" }),
    next: z
      .string()
      .min(8, { message: "Mínimo 8 caracteres" })
      .regex(/[A-Z]/, { message: "Debe incluir una mayúscula" })
      .regex(/[0-9]/, { message: "Debe incluir un número" }),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { path: ["confirm"], message: "No coinciden" });

function ProfilePage() {
  const { user, profile, role, refreshProfile } = useAuth();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: profile?.full_name ?? "", phone: profile?.phone ?? "" },
    values: { full_name: profile?.full_name ?? "", phone: profile?.phone ?? "" },
    mode: "onBlur",
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: "", next: "", confirm: "" },
    mode: "onBlur",
  });

  const onSaveProfile = async (values: z.infer<typeof profileSchema>) => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: values.full_name, phone: values.phone || null })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Perfil actualizado");
    } catch {
      toast.error("No se pudo actualizar el perfil");
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (values: z.infer<typeof passwordSchema>) => {
    if (!user?.email) return;
    setSavingPassword(true);
    try {
      // Verify current password by re-authenticating
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: values.current,
      });
      if (authErr) {
        toast.error("La contraseña actual es incorrecta");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: values.next });
      if (error) throw error;
      await supabase.from("activity_log").insert([
        { user_id: user.id, action: "password_changed", details: null as never },
      ]);
      passwordForm.reset();
      toast.success("Contraseña actualizada");
    } catch {
      toast.error("No se pudo cambiar la contraseña");
    } finally {
      setSavingPassword(false);
    }
  };

  const onUploadAvatar = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 2 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
      if (updErr) throw updErr;
      await refreshProfile();
      toast.success("Avatar actualizado");
    } catch {
      toast.error("No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Avatar + identity */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="relative">
            <Avatar className="h-24 w-24 ring-2 ring-border">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-2xl font-bold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow hover:bg-primary-hover disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && onUploadAvatar(e.target.files[0])}
            />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground">{profile?.full_name}</h2>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <div className="mt-2">{role && <RoleBadge role={role} />}</div>
          </div>
        </div>
      </div>

      {/* Personal info */}
      <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <div>
          <h3 className="text-base font-semibold text-foreground">Información personal</h3>
          <p className="text-sm text-muted-foreground">Actualiza tu nombre y teléfono.</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input {...profileForm.register("full_name")} />
            {profileForm.formState.errors.full_name && (
              <p className="text-xs text-destructive">{profileForm.formState.errors.full_name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input {...profileForm.register("phone")} placeholder="+52 555 000 0000" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-muted-foreground">
              <Lock className="h-3 w-3" /> Correo electrónico
            </Label>
            <Input value={profile?.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">El correo no se puede modificar.</p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={savingProfile} className="bg-primary hover:bg-primary-hover">
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
          </Button>
        </div>
      </form>

      {/* Password */}
      <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <div>
          <h3 className="text-base font-semibold text-foreground">Cambiar contraseña</h3>
          <p className="text-sm text-muted-foreground">Necesitas tu contraseña actual.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Contraseña actual</Label>
            <Input type="password" autoComplete="current-password" {...passwordForm.register("current")} />
            {passwordForm.formState.errors.current && (
              <p className="text-xs text-destructive">{passwordForm.formState.errors.current.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Nueva contraseña</Label>
            <Input type="password" autoComplete="new-password" {...passwordForm.register("next")} />
            {passwordForm.formState.errors.next && (
              <p className="text-xs text-destructive">{passwordForm.formState.errors.next.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Confirmar</Label>
            <Input type="password" autoComplete="new-password" {...passwordForm.register("confirm")} />
            {passwordForm.formState.errors.confirm && (
              <p className="text-xs text-destructive">{passwordForm.formState.errors.confirm.message}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={savingPassword} className="bg-primary hover:bg-primary-hover">
            {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cambiar contraseña"}
          </Button>
        </div>
      </form>
    </div>
  );
}
