"use client";

import * as React from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import {
  Field,
  MoneyField,
  TextareaField,
  SelectField,
} from "@/components/shared/fields";
import { centsToDollars } from "@/lib/money";
import { createLease, updateLease } from "./actions";
import type { Lease } from "@/db/schema";
import type { Option } from "@/lib/lookups";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "upcoming", label: "Upcoming" },
  { value: "month_to_month", label: "Month-to-month" },
  { value: "expired", label: "Expired" },
  { value: "terminated", label: "Terminated" },
];

interface LeaseFormProps {
  tenantOptions: Option[];
  unitOptions: Option[];
  lease?: Lease;
}

export function CreateLeaseButton({
  tenantOptions,
  unitOptions,
}: {
  tenantOptions: Option[];
  unitOptions: Option[];
}) {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New lease
        </Button>
      }
      title="New lease"
      description="Link a tenant to a unit and define the lease terms."
      action={createLease}
      submitLabel="Create lease"
      size="lg"
    >
      <Fields tenantOptions={tenantOptions} unitOptions={unitOptions} />
    </FormDialog>
  );
}

export function EditLeaseButton({
  lease,
  tenantOptions,
  unitOptions,
}: {
  lease: Lease;
  tenantOptions: Option[];
  unitOptions: Option[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      }
      title="Edit lease"
      action={updateLease}
      submitLabel="Save changes"
      size="lg"
    >
      <input type="hidden" name="id" value={lease.id} />
      <Fields
        tenantOptions={tenantOptions}
        unitOptions={unitOptions}
        lease={lease}
      />
    </FormDialog>
  );
}

function Fields({ tenantOptions, unitOptions, lease }: LeaseFormProps) {
  // When a unit is selected, populate the rent default from unit meta.
  const [rentDefault, setRentDefault] = React.useState<number | undefined>(
    lease ? centsToDollars(lease.monthlyRentCents) : undefined,
  );

  function handleUnitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selectedValue = e.target.value;
    const opt = unitOptions.find((o) => o.value === selectedValue);
    if (opt?.meta?.rent != null && !lease) {
      setRentDefault(Number(opt.meta.rent) / 100);
    }
  }

  return (
    <>
      <SelectField
        label="Tenant"
        name="tenantId"
        options={tenantOptions}
        required
        defaultValue={lease?.tenantId}
        includeBlank
        placeholder="— Select tenant —"
      />

      <div className="space-y-1.5">
        <label
          htmlFor="unitId"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Unit <span className="text-destructive"> *</span>
        </label>
        <select
          id="unitId"
          name="unitId"
          required
          defaultValue={lease?.unitId ?? ""}
          onChange={handleUnitChange}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">— Select unit —</option>
          {unitOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" htmlFor="startDate" required>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={lease?.startDate ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </Field>
        <Field
          label="End date"
          htmlFor="endDate"
          hint="Leave blank for month-to-month"
        >
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={lease?.endDate ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MoneyField
          label="Monthly rent"
          name="monthlyRent"
          required
          defaultValue={rentDefault}
        />
        <MoneyField
          label="Security deposit"
          name="securityDeposit"
          defaultValue={
            lease ? centsToDollars(lease.securityDepositCents) : undefined
          }
        />
      </div>

      <SelectField
        label="Status"
        name="status"
        options={STATUS_OPTIONS}
        defaultValue={lease?.status ?? "active"}
      />

      <TextareaField
        label="Notes"
        name="notes"
        placeholder="Any additional notes about this lease."
        defaultValue={lease?.notes ?? ""}
      />
    </>
  );
}
