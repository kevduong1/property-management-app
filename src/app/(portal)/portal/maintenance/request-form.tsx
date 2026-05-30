"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { TextField, TextareaField, SelectField } from "@/components/shared/fields";
import { submitMaintenanceRequest } from "./actions";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "emergency", label: "Emergency" },
];

export function NewRequestButton() {
  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          New Request
        </Button>
      }
      title="Submit Maintenance Request"
      description="Describe the issue and we'll notify your property manager."
      action={submitMaintenanceRequest}
      submitLabel="Submit request"
    >
      <TextField
        label="Title"
        name="title"
        placeholder="e.g. Leaking faucet in bathroom"
        required
      />
      <SelectField
        label="Priority"
        name="priority"
        options={PRIORITY_OPTIONS}
        defaultValue="medium"
        required
      />
      <TextareaField
        label="Description"
        name="description"
        placeholder="Describe the problem in detail — location, when it started, etc."
        rows={4}
      />
    </FormDialog>
  );
}
