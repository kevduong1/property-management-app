import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const toneClasses: Record<string, string> = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
    info: "text-sky-600 dark:text-sky-400",
  };
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={cn("text-2xl font-semibold", toneClasses[tone])}>
            {value}
          </p>
          {sublabel ? (
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          ) : null}
        </div>
        {Icon ? (
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
