"use client";

import { useTransition } from "react";
import { Layers } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setActiveSeries } from "@/app/actions/context";
import type { ChildSeries } from "@/db/schema";

export function SeriesSwitcher({
  list,
  currentSeriesId,
}: {
  list: Pick<ChildSeries, "id" | "name">[];
  currentSeriesId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Layers className="h-4 w-4 text-muted-foreground" />
      <Select
        value={currentSeriesId ?? "all"}
        onValueChange={(v) => startTransition(() => setActiveSeries(v))}
      >
        <SelectTrigger
          className="h-9 w-[230px] font-medium"
          aria-label="Active child series"
          data-pending={pending}
        >
          <SelectValue placeholder="All series" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All child series</SelectItem>
          {list.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
