"use client";

import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import {
  TextField,
  TextareaField,
  SelectField,
} from "@/components/shared/fields";
import {
  maintenancePriorityLabels,
  maintenanceStatusLabels,
} from "@/lib/labels";
import { createMaintenanceRequest, updateMaintenanceRequest } from "./actions";
import type { Option } from "@/lib/lookups";
import type { MaintenanceRequest } from "@/db/schema";

const PRIORITY_OPTIONS = (
  Object.keys(maintenancePriorityLabels) as Array<
    keyof typeof maintenancePriorityLabels
  >
).map((p) => ({ value: p, label: maintenancePriorityLabels[p] }));

const STATUS_OPTIONS = (
  Object.keys(maintenanceStatusLabels) as Array<
    keyof typeof maintenanceStatusLabels
  >
).map((s) => ({ value: s, label: maintenanceStatusLabels[s] }));

interface FormProps {
  request?: MaintenanceRequest;
  propertyOptions: Option[];
  unitOptions: Option[];
  tenantOptions: Option[];
}

function Fields({
  request,
  propertyOptions,
  unitOptions,
  tenantOptions,
}: FormProps) {
  return (
    <>
      <TextField
        label="Title"
        name="title"
        required
        placeholder="e.g. Leaky faucet in bathroom"
        defaultValue={request?.title ?? ""}
      />
      <SelectField
        label="Property"
        name="propertyId"
        options={propertyOptions}
        defaultValue={request?.propertyId ?? propertyOptions[0]?.value ?? ""}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Unit (optional)"
          name="unitId"
          options={unitOptions}
          defaultValue={request?.unitId ?? ""}
          includeBlank
          placeholder="— None —"
        />
        <SelectField
          label="Tenant (optional)"
          name="tenantId"
          options={tenantOptions}
          defaultValue={request?.tenantId ?? ""}
          includeBlank
          placeholder="— None —"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Priority"
          name="priority"
          options={PRIORITY_OPTIONS}
          defaultValue={request?.priority ?? "medium"}
          required
        />
        <SelectField
          label="Status"
          name="status"
          options={STATUS_OPTIONS}
          defaultValue={request?.status ?? "open"}
          required
        />
      </div>
      <TextareaField
        label="Description (optional)"
        name="description"
        placeholder="Describe the issue in detail…"
        defaultValue={request?.description ?? ""}
      />
      <TextareaField
        label="Resolution notes (optional)"
        name="resolutionNotes"
        placeholder="Notes on how the issue was resolved…"
        defaultValue={request?.resolutionNotes ?? ""}
      />
    </>
  );
}

export function CreateMaintenanceButton(props: Omit<FormProps, "request">) {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New request
        </Button>
      }
      title="New maintenance request"
      description="Log a maintenance issue against a property."
      action={createMaintenanceRequest}
      submitLabel="Create request"
      size="lg"
    >
      <Fields {...props} />
    </FormDialog>
  );
}

export function EditMaintenanceButton(props: FormProps) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      }
      title="Edit maintenance request"
      action={updateMaintenanceRequest}
      submitLabel="Save changes"
      size="lg"
    >
      <input type="hidden" name="id" value={props.request!.id} />
      <Fields {...props} />
    </FormDialog>
  );
}
