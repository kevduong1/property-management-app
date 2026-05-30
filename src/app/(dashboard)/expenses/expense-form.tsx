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
import { expenseCategoryLabels } from "@/lib/labels";
import { centsToDollars } from "@/lib/money";
import { createExpense, updateExpense } from "./actions";
import type { Option } from "@/lib/lookups";
import type { Expense } from "@/db/schema";

const CATEGORY_OPTIONS = (
  Object.keys(expenseCategoryLabels) as Array<keyof typeof expenseCategoryLabels>
).map((kind) => ({ value: kind, label: expenseCategoryLabels[kind] }));

interface FormProps {
  expense?: Expense;
  seriesOptions: Option[];
  propertyOptions: Option[];
  unitOptions: Option[];
  vendorOptions: Option[];
  defaultDate: string;
}

function Fields({
  expense,
  seriesOptions,
  propertyOptions,
  unitOptions,
  vendorOptions,
  defaultDate,
}: FormProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Series"
          name="childSeriesId"
          options={seriesOptions}
          defaultValue={expense?.childSeriesId ?? seriesOptions[0]?.value ?? ""}
          required
        />
        <SelectField
          label="Category"
          name="categoryKind"
          options={CATEGORY_OPTIONS}
          defaultValue={expense?.categoryKind ?? "other"}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <MoneyField
          label="Amount"
          name="amount"
          required
          defaultValue={
            expense ? centsToDollars(expense.amountCents) : undefined
          }
        />
        <TextField
          label="Date"
          name="incurredDate"
          type="date"
          required
          defaultValue={expense?.incurredDate ?? defaultDate}
        />
      </div>
      <SelectField
        label="Property (optional)"
        name="propertyId"
        options={propertyOptions}
        defaultValue={expense?.propertyId ?? ""}
        includeBlank
        placeholder="— None —"
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Unit (optional)"
          name="unitId"
          options={unitOptions}
          defaultValue={expense?.unitId ?? ""}
          includeBlank
          placeholder="— None —"
        />
        <SelectField
          label="Vendor (optional)"
          name="vendorId"
          options={vendorOptions}
          defaultValue={expense?.vendorId ?? ""}
          includeBlank
          placeholder="— None —"
        />
      </div>
      <TextField
        label="Description (optional)"
        name="description"
        placeholder="Brief description of the expense"
        defaultValue={expense?.description ?? ""}
      />
      <TextareaField
        label="Notes (optional)"
        name="notes"
        placeholder="Any additional details…"
        defaultValue={expense?.notes ?? ""}
      />
    </>
  );
}

export function CreateExpenseButton(props: Omit<FormProps, "expense">) {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New expense
        </Button>
      }
      title="New expense"
      description="Record an expense against a child series."
      action={createExpense}
      submitLabel="Create expense"
      size="lg"
    >
      <Fields {...props} />
    </FormDialog>
  );
}

export function EditExpenseButton(props: FormProps) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      }
      title="Edit expense"
      action={updateExpense}
      submitLabel="Save changes"
      size="lg"
    >
      <input type="hidden" name="id" value={props.expense!.id} />
      <Fields {...props} />
    </FormDialog>
  );
}
