"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SelectOption } from "@/components/shared/fields";

export interface FilterDef {
  key: string;
  label: string;
  options: SelectOption[];
  /** Label for the "all" option. */
  allLabel?: string;
}

/**
 * URL-driven filter bar. Each select writes its value to a query-string param;
 * server components read `searchParams` to scope their queries. Includes
 * optional date-range and free-text search params.
 */
export function FilterBar({
  filters,
  showDateRange,
  showSearch,
}: {
  filters: FilterDef[];
  showDateRange?: boolean;
  showSearch?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const hasActive = [...searchParams.keys()].length > 0;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 p-4">
        {filters.map((f) => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {f.label}
            </label>
            <select
              value={searchParams.get(f.key) ?? "all"}
              onChange={(e) => setParam(f.key, e.target.value)}
              className="flex h-9 min-w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">{f.allLabel ?? `All ${f.label.toLowerCase()}`}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {showDateRange ? (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                From
              </label>
              <input
                type="date"
                defaultValue={searchParams.get("from") ?? ""}
                onChange={(e) => setParam("from", e.target.value)}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                To
              </label>
              <input
                type="date"
                defaultValue={searchParams.get("to") ?? ""}
                onChange={(e) => setParam("to", e.target.value)}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              />
            </div>
          </>
        ) : null}

        {showSearch ? (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Search
            </label>
            <input
              type="search"
              placeholder="Search…"
              defaultValue={searchParams.get("q") ?? ""}
              onChange={(e) => setParam("q", e.target.value)}
              className="flex h-9 min-w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            />
          </div>
        ) : null}

        {hasActive ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace(pathname)}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4" /> Clear
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
