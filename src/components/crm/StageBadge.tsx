import { cn } from "@/lib/utils";
import { STAGE_LABELS, STAGE_STYLES } from "@/lib/crm";
import type { CustomerStage } from "@/types";

export function StageBadge({ stage, className }: { stage: CustomerStage; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        STAGE_STYLES[stage],
        className,
      )}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}
