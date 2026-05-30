"use client";

import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import {
  TextField,
  TextareaField,
  SelectField,
  MoneyField,
} from "@/components/shared/fields";
import type { Option } from "@/lib/lookups";
import { centsToDollars } from "@/lib/money";
import { createUnit, updateUnit } from "./actions";
import type { Unit } from "@/db/schema";

const OCCUPANCY_OPTIONS = [
  { value: "vacant", label: "Vacant" },
  { value: "occupied", label: "Occupied" },
  { value: "unavailable", label: "Unavailable" },
];

export function CreateUnitButton({
  propertyOptions,
  defaultPropertyId,
}: {
  propertyOptions: Option[];
  defaultPropertyId?: string;
}) {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New unit
        </Button>
      }
      title="New unit"
      description="Add a unit to a property. The series is derived automatically from the property."
      action={createUnit}
      submitLabel="Create unit"
      size="lg"
    >
      <Fields
        propertyOptions={propertyOptions}
        defaultPropertyId={defaultPropertyId}
      />
    </FormDialog>
  );
}

export function EditUnitButton({
  unit,
  propertyOptions,
}: {
  unit: Unit;
  propertyOptions: Option[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      }
      title="Edit unit"
      action={updateUnit}
      submitLabel="Save changes"
      size="lg"
    >
      <input type="hidden" name="id" value={unit.id} />
      <Fields unit={unit} propertyOptions={propertyOptions} />
    </FormDialog>
  );
}

function Fields({
  unit,
  propertyOptions,
  defaultPropertyId,
}: {
  unit?: Unit;
  propertyOptions: Option[];
  defaultPropertyId?: string;
}) {
  const bathroomsDisplay =
    unit?.bathrooms !== null && unit?.bathrooms !== undefined
      ? String(unit.bathrooms / 10)
      : "";

  return (
    <>
      <SelectField
        label="Property"
        name="propertyId"
        options={propertyOptions}
        required
        defaultValue={unit?.propertyId ?? defaultPropertyId}
        includeBlank
        placeholder="— Select a property —"
      />
      <TextField
        label="Unit label"
        name="label"
        required
        placeholder="Unit A, 101, Front house…"
        defaultValue={unit?.label}
      />
      <div className="grid grid-cols-2 gap-4">
        <MoneyField
          label="Monthly rent"
          name="monthlyRent"
          defaultValue={centsToDollars(unit?.monthlyRentCents ?? 0)}
        />
        <SelectField
          label="Occupancy status"
          name="occupancyStatus"
          options={OCCUPANCY_OPTIONS}
          defaultValue={unit?.occupancyStatus ?? "vacant"}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <TextField
          label="Bedrooms"
          name="bedrooms"
          type="number"
          min="0"
          step="1"
          placeholder="2"
          defaultValue={
            unit?.bedrooms !== null && unit?.bedrooms !== undefined
              ? String(unit.bedrooms)
              : ""
          }
        />
        <TextField
          label="Bathrooms"
          name="bathrooms"
          type="number"
          min="0"
          step="0.5"
          placeholder="1.5"
          defaultValue={bathroomsDisplay}
          hint="e.g. 1, 1.5, 2"
        />
        <TextField
          label="Sq ft"
          name="squareFeet"
          type="number"
          min="0"
          step="1"
          placeholder="850"
          defaultValue={
            unit?.squareFeet !== null && unit?.squareFeet !== undefined
              ? String(unit.squareFeet)
              : ""
          }
        />
      </div>
      <TextareaField
        label="Notes"
        name="notes"
        placeholder="Any notes about this unit."
        defaultValue={unit?.notes ?? ""}
      />
    </>
  );
}
