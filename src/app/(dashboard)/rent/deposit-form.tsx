"use client";

import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import {
  MoneyField,
  TextField,
  TextareaField,
  SelectField,
} from "@/components/shared/fields";
import { centsToDollars } from "@/lib/money";
import { createSecurityDeposit, updateSecurityDeposit } from "./actions";
import type { Option } from "@/lib/lookups";
import type { SecurityDeposit } from "@/db/schema";

interface DepositFormProps {
  seriesOptions: Option[];
  tenantOptions: Option[];
  unitOptions: Option[];
  defaultDate?: string;
}

export function CreateDepositButton({
  seriesOptions,
  tenantOptions,
  unitOptions,
  defaultDate,
}: DepositFormProps) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline">
          <Plus className="h-4 w-4" /> New deposit
        </Button>
      }
      title="New security deposit"
      description="Record a security deposit received from a tenant."
      action={createSecurityDeposit}
      submitLabel="Create deposit"
    >
      <Fields
        seriesOptions={seriesOptions}
        tenantOptions={tenantOptions}
        unitOptions={unitOptions}
        defaultDate={defaultDate}
      />
    </FormDialog>
  );
}

export function EditDepositButton({
  deposit,
  seriesOptions,
  tenantOptions,
  unitOptions,
  defaultDate,
}: DepositFormProps & { deposit: SecurityDeposit }) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon" aria-label="Edit deposit">
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
      }
      title="Edit security deposit"
      action={updateSecurityDeposit}
      submitLabel="Save changes"
    >
      <input type="hidden" name="id" value={deposit.id} />
      <Fields
        seriesOptions={seriesOptions}
        tenantOptions={tenantOptions}
        unitOptions={unitOptions}
        defaultDate={defaultDate}
        deposit={deposit}
      />
    </FormDialog>
  );
}

function Fields({
  seriesOptions,
  tenantOptions,
  unitOptions,
  defaultDate,
  deposit,
}: DepositFormProps & { deposit?: SecurityDeposit }) {
  return (
    <>
      <SelectField
        label="Series"
        name="childSeriesId"
        options={seriesOptions.map((o) => ({ value: o.value, label: o.label }))}
        required
        includeBlank
        placeholder="— Select series —"
        defaultValue={deposit?.childSeriesId}
      />
      <SelectField
        label="Tenant"
        name="tenantId"
        options={tenantOptions.map((o) => ({ value: o.value, label: o.label }))}
        required
        includeBlank
        placeholder="— Select tenant —"
        defaultValue={deposit?.tenantId}
      />
      <SelectField
        label="Unit (optional)"
        name="unitId"
        options={unitOptions.map((o) => ({ value: o.value, label: o.label }))}
        includeBlank
        placeholder="— Select unit —"
        defaultValue={deposit?.unitId ?? ""}
      />
      <div className="grid grid-cols-2 gap-4">
        <MoneyField
          label="Deposit amount"
          name="amount"
          required
          defaultValue={
            deposit ? centsToDollars(deposit.amountCents) : undefined
          }
        />
        <TextField
          label="Received date"
          name="receivedDate"
          type="date"
          defaultValue={deposit?.receivedDate ?? defaultDate}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <MoneyField
          label="Refund amount"
          name="refundAmount"
          defaultValue={
            deposit ? centsToDollars(deposit.refundAmountCents) : 0
          }
          hint="Leave 0 if not yet refunded."
        />
        <TextField
          label="Refund date"
          name="refundDate"
          type="date"
          defaultValue={deposit?.refundDate ?? ""}
        />
      </div>
      <TextareaField
        label="Notes"
        name="notes"
        placeholder="Optional notes…"
        defaultValue={deposit?.notes ?? ""}
      />
    </>
  );
}
