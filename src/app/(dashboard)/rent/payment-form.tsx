"use client";

import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import {
  MoneyField,
  TextField,
  SelectField,
  TextareaField,
} from "@/components/shared/fields";
import { formatCents } from "@/lib/money";
import { paymentMethodLabels } from "@/lib/labels";
import { createRentPayment } from "./actions";

const METHOD_OPTIONS = Object.entries(paymentMethodLabels).map(
  ([value, label]) => ({ value, label }),
);

export interface PaymentChargeRef {
  id: string;
  tenantLabel: string;
  balanceCents: number;
}

export function RecordPaymentButton({
  charge,
  defaultDate,
}: {
  charge: PaymentChargeRef;
  defaultDate: string;
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <DollarSign className="h-4 w-4" /> Record payment
        </Button>
      }
      title="Record payment"
      description={`Tenant: ${charge.tenantLabel} · Balance: ${formatCents(charge.balanceCents)}`}
      action={createRentPayment}
      submitLabel="Save payment"
    >
      <input type="hidden" name="rentChargeId" value={charge.id} />
      <MoneyField
        label="Amount"
        name="amount"
        required
        defaultValue={(charge.balanceCents / 100).toFixed(2)}
        hint="Partial payments are supported."
      />
      <TextField
        label="Received date"
        name="receivedDate"
        type="date"
        required
        defaultValue={defaultDate}
      />
      <SelectField
        label="Payment method"
        name="method"
        options={METHOD_OPTIONS}
        defaultValue="check"
        required
      />
      <TextField
        label="Reference / check #"
        name="reference"
        placeholder="Optional reference number"
      />
      <TextareaField label="Notes" name="notes" placeholder="Optional notes…" />
    </FormDialog>
  );
}
