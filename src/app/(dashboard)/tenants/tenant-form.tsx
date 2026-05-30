"use client";

import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import {
  TextField,
  TextareaField,
} from "@/components/shared/fields";
import { createTenant, updateTenant } from "./actions";
import type { Tenant } from "@/db/schema";

export function CreateTenantButton() {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New tenant
        </Button>
      }
      title="New tenant"
      description="Add a tenant to the system. You can link them to a unit via a lease."
      action={createTenant}
      submitLabel="Create tenant"
      size="lg"
    >
      <Fields />
    </FormDialog>
  );
}

export function EditTenantButton({ tenant }: { tenant: Tenant }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      }
      title="Edit tenant"
      action={updateTenant}
      submitLabel="Save changes"
      size="lg"
    >
      <input type="hidden" name="id" value={tenant.id} />
      <Fields tenant={tenant} />
    </FormDialog>
  );
}

function Fields({ tenant }: { tenant?: Tenant }) {
  return (
    <>
      <TextField
        label="Full name"
        name="fullName"
        required
        placeholder="Jane Smith"
        defaultValue={tenant?.fullName}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Email"
          name="email"
          type="email"
          placeholder="jane@example.com"
          defaultValue={tenant?.email ?? ""}
        />
        <TextField
          label="Phone"
          name="phone"
          type="tel"
          placeholder="(555) 555-5555"
          defaultValue={tenant?.phone ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Emergency contact name"
          name="emergencyContactName"
          placeholder="John Smith"
          defaultValue={tenant?.emergencyContactName ?? ""}
        />
        <TextField
          label="Emergency contact phone"
          name="emergencyContactPhone"
          type="tel"
          placeholder="(555) 555-5555"
          defaultValue={tenant?.emergencyContactPhone ?? ""}
        />
      </div>
      <TextareaField
        label="Notes"
        name="notes"
        placeholder="Any additional notes about this tenant."
        defaultValue={tenant?.notes ?? ""}
      />
    </>
  );
}
