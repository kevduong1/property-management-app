"use client";

import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import {
  TextField,
  MoneyField,
  TextareaField,
  SelectField,
} from "@/components/shared/fields";
import { centsToDollars } from "@/lib/money";
import { createRentCharge, updateRentCharge } from "./actions";
import type { Option } from "@/lib/lookups";
import type { RentCharge } from "@/db/schema";

interface RentChargeFormProps {
  unitOptions: Option[];
  tenantOptions: Option[];
  defaultDate?: string;
}

export function CreateRentChargeButton({
  unitOptions,
  tenantOptions,
  defaultDate,
}: RentChargeFormProps) {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New rent charge
        </Button>
      }
      title="New rent charge"
      description="Create a rent charge for a unit and tenant. Series and property are derived from the unit."
      action={createRentCharge}
      submitLabel="Create charge"
    >
      <Fields
        unitOptions={unitOptions}
        tenantOptions={tenantOptions}
        defaultDate={defaultDate}
      />
    </FormDialog>
  );
}

export function EditRentChargeButton({
  charge,
  unitOptions,
  tenantOptions,
  defaultDate,
}: RentChargeFormProps & { charge: RentCharge }) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon" aria-label="Edit charge">
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
      }
      title="Edit rent charge"
      action={updateRentCharge}
      submitLabel="Save changes"
    >
      <input type="hidden" name="id" value={charge.id} />
      {/* Keep unitId/tenantId so the schema can parse them (they won't be changed here) */}
      <input type="hidden" name="unitId" value={charge.unitId} />
      <input type="hidden" name="tenantId" value={charge.tenantId} />
      <EditFields charge={charge} defaultDate={defaultDate} />
    </FormDialog>
  );
}

function Fields({
  unitOptions,
  tenantOptions,
  defaultDate,
}: RentChargeFormProps) {
  return (
    <>
      <SelectField
        label="Unit"
        name="unitId"
        options={unitOptions.map((o) => ({ value: o.value, label: o.label }))}
        required
        includeBlank
        placeholder="— Select unit —"
      />
      <SelectField
        label="Tenant"
        name="tenantId"
        options={tenantOptions.map((o) => ({ value: o.value, label: o.label }))}
        required
        includeBlank
        placeholder="— Select tenant —"
      />
      <TextField
        label="Due date"
        name="dueDate"
        type="date"
        required
        defaultValue={defaultDate}
      />
      <div className="grid grid-cols-2 gap-4">
        <MoneyField label="Rent amount" name="rentAmount" required />
        <MoneyField label="Late fee" name="lateFee" defaultValue={0} />
      </div>
      <TextareaField label="Notes" name="notes" placeholder="Optional notes…" />
    </>
  );
}

function EditFields({
  charge,
  defaultDate,
}: {
  charge: RentCharge;
  defaultDate?: string;
}) {
  return (
    <>
      <TextField
        label="Due date"
        name="dueDate"
        type="date"
        required
        defaultValue={charge.dueDate ?? defaultDate}
      />
      <div className="grid grid-cols-2 gap-4">
        <MoneyField
          label="Rent amount"
          name="rentAmount"
          required
          defaultValue={centsToDollars(charge.rentAmountCents)}
        />
        <MoneyField
          label="Late fee"
          name="lateFee"
          defaultValue={centsToDollars(charge.lateFeeCents)}
        />
      </div>
      <TextareaField
        label="Notes"
        name="notes"
        placeholder="Optional notes…"
        defaultValue={charge.notes ?? ""}
      />
    </>
  );
}
