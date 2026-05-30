"use client";

import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { TextField, TextareaField, SelectField } from "@/components/shared/fields";
import { createSeries, updateSeries } from "./actions";
import type { ChildSeries } from "@/db/schema";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "dissolved", label: "Dissolved" },
];

export function CreateSeriesButton() {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New child series
        </Button>
      }
      title="New child series"
      description="A child series isolates the finances of a property group under your parent LLC."
      action={createSeries}
      submitLabel="Create series"
    >
      <Fields />
    </FormDialog>
  );
}

export function EditSeriesButton({ series }: { series: ChildSeries }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      }
      title="Edit child series"
      action={updateSeries}
      submitLabel="Save changes"
    >
      <input type="hidden" name="id" value={series.id} />
      <Fields series={series} />
    </FormDialog>
  );
}

function Fields({ series }: { series?: ChildSeries }) {
  return (
    <>
      <TextField
        label="Series name"
        name="name"
        required
        placeholder="Series A — Maple Street"
        defaultValue={series?.name}
      />
      <TextareaField
        label="Description / notes"
        name="description"
        placeholder="What this series holds and why it's separated."
        defaultValue={series?.description ?? ""}
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Status"
          name="status"
          options={STATUS_OPTIONS}
          defaultValue={series?.status ?? "active"}
        />
        <TextField
          label="EIN (optional)"
          name="ein"
          placeholder="88-1234567"
          defaultValue={series?.ein ?? ""}
        />
      </div>
      <TextField
        label="Bank account nickname (optional)"
        name="bankAccountNickname"
        placeholder="Maple Operating ••4821"
        defaultValue={series?.bankAccountNickname ?? ""}
      />
    </>
  );
}
