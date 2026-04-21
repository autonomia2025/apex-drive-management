import { Car } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary glow-primary">
        <Car className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight text-foreground">AUTO</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Gestión</div>
        </div>
      )}
    </div>
  );
}
