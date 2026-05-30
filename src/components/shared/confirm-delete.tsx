"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

/** Confirmation dialog that invokes a server action to delete `id`. */
export function ConfirmDelete({
  action,
  id,
  label = "Delete",
  title = "Delete this record?",
  description = "This action cannot be undone.",
  trigger,
}: {
  action: (id: string) => Promise<ActionResult>;
  id: string;
  label?: string;
  title?: string;
  description?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await action(id);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" aria-label={label}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Deleting…" : label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
