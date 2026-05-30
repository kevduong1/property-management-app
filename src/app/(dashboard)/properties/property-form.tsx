"use client";

import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import {
  TextField,
  TextareaField,
  SelectField,
} from "@/components/shared/fields";
import type { Option } from "@/lib/lookups";
import { createProperty, updateProperty } from "./actions";
import type { Property } from "@/db/schema";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "sold", label: "Sold" },
];

export function CreatePropertyButton({
  seriesOptions,
}: {
  seriesOptions: Option[];
}) {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New property
        </Button>
      }
      title="New property"
      description="Add a property to a child series. Each series keeps its books separate."
      action={createProperty}
      submitLabel="Create property"
      size="lg"
    >
      <Fields seriesOptions={seriesOptions} />
    </FormDialog>
  );
}

export function EditPropertyButton({
  property,
  seriesOptions,
}: {
  property: Property;
  seriesOptions: Option[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      }
      title="Edit property"
      action={updateProperty}
      submitLabel="Save changes"
      size="lg"
    >
      <input type="hidden" name="id" value={property.id} />
      <Fields property={property} seriesOptions={seriesOptions} />
    </FormDialog>
  );
}

function Fields({
  property,
  seriesOptions,
}: {
  property?: Property;
  seriesOptions: Option[];
}) {
  return (
    <>
      <SelectField
        label="Child series"
        name="childSeriesId"
        options={seriesOptions}
        required
        defaultValue={property?.childSeriesId}
        includeBlank
        placeholder="— Select a series —"
      />
      <TextField
        label="Property name"
        name="name"
        required
        placeholder="123 Maple St — Duplex"
        defaultValue={property?.name}
      />
      <TextField
        label="Address line 1"
        name="addressLine1"
        placeholder="123 Maple Street"
        defaultValue={property?.addressLine1 ?? ""}
      />
      <TextField
        label="Address line 2"
        name="addressLine2"
        placeholder="Apt / Suite / Unit"
        defaultValue={property?.addressLine2 ?? ""}
      />
      <div className="grid grid-cols-3 gap-4">
        <TextField
          label="City"
          name="city"
          placeholder="Springfield"
          defaultValue={property?.city ?? ""}
          className="col-span-1"
        />
        <TextField
          label="State"
          name="state"
          placeholder="IL"
          maxLength={2}
          defaultValue={property?.state ?? ""}
          className="col-span-1"
        />
        <TextField
          label="ZIP code"
          name="postalCode"
          placeholder="62701"
          defaultValue={property?.postalCode ?? ""}
          className="col-span-1"
        />
      </div>
      <SelectField
        label="Status"
        name="status"
        options={STATUS_OPTIONS}
        defaultValue={property?.status ?? "active"}
      />
      <TextareaField
        label="Notes"
        name="notes"
        placeholder="Any notes about this property."
        defaultValue={property?.notes ?? ""}
      />
    </>
  );
}
