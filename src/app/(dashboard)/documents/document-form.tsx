"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { TextField, SelectField, Field } from "@/components/shared/fields";
import { createDocument } from "./actions";
import type { Option } from "@/lib/lookups";

const TYPE_OPTIONS = [
  { value: "lease", label: "Lease" },
  { value: "receipt", label: "Receipt" },
  { value: "invoice", label: "Invoice" },
  { value: "insurance", label: "Insurance" },
  { value: "formation", label: "Formation document" },
  { value: "vendor_contract", label: "Vendor contract" },
  { value: "tenant_notice", label: "Tenant notice" },
  { value: "inspection_photo", label: "Inspection photo" },
  { value: "other", label: "Other" },
];

const ENTITY_TYPE_OPTIONS = [
  { value: "child_series", label: "Child Series" },
  { value: "property", label: "Property" },
  { value: "unit", label: "Unit" },
  { value: "tenant", label: "Tenant" },
  { value: "parent_llc", label: "Parent LLC" },
];

interface Props {
  seriesOptions: Option[];
  propertyOptions: Option[];
  unitOptions: Option[];
  tenantOptions: Option[];
  parentLlcId?: string | null;
  parentLlcName?: string | null;
}

export function CreateDocumentButton({
  seriesOptions,
  propertyOptions,
  unitOptions,
  tenantOptions,
  parentLlcId,
  parentLlcName,
}: Props) {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> Upload document
        </Button>
      }
      title="Upload document"
      description="Attach a document to any entity in your portfolio. File upload is optional."
      action={createDocument}
      submitLabel="Save document"
      size="lg"
    >
      <Fields
        seriesOptions={seriesOptions}
        propertyOptions={propertyOptions}
        unitOptions={unitOptions}
        tenantOptions={tenantOptions}
        parentLlcId={parentLlcId}
        parentLlcName={parentLlcName}
      />
    </FormDialog>
  );
}

function Fields({
  seriesOptions,
  propertyOptions,
  unitOptions,
  tenantOptions,
  parentLlcId,
  parentLlcName,
}: Props) {
  const [entityType, setEntityType] = React.useState("child_series");
  const [entityId, setEntityId] = React.useState("");

  // Reset entityId when entityType changes.
  const handleEntityTypeChange = (v: string) => {
    setEntityType(v);
    setEntityId("");
  };

  // Build entity options based on selected entity type.
  const entityOptions = React.useMemo(() => {
    switch (entityType) {
      case "child_series":
        return seriesOptions.map((o) => ({ value: o.value, label: o.label }));
      case "property":
        return propertyOptions.map((o) => ({ value: o.value, label: o.label }));
      case "unit":
        return unitOptions.map((o) => ({ value: o.value, label: o.label }));
      case "tenant":
        return tenantOptions.map((o) => ({ value: o.value, label: o.label }));
      case "parent_llc":
        return parentLlcId
          ? [{ value: parentLlcId, label: parentLlcName ?? "Parent LLC" }]
          : [];
      default:
        return [];
    }
  }, [
    entityType,
    seriesOptions,
    propertyOptions,
    unitOptions,
    tenantOptions,
    parentLlcId,
    parentLlcName,
  ]);

  // When entityType === child_series, denormalize childSeriesId = entityId.
  const childSeriesId = entityType === "child_series" ? entityId : "";

  return (
    <>
      <TextField
        label="Title"
        name="title"
        required
        placeholder="e.g. Lease Agreement — Unit 1A"
      />

      <SelectField
        label="Document type"
        name="type"
        options={TYPE_OPTIONS}
        defaultValue="other"
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Attach to (type)" htmlFor="entityType">
          <select
            id="entityType"
            name="entityType"
            value={entityType}
            onChange={(e) => handleEntityTypeChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {ENTITY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Entity" htmlFor="entityId">
          <select
            id="entityId"
            name="entityId"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            required
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">— Select —</option>
            {entityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Denormalized childSeriesId for series-scoped document queries */}
      <input type="hidden" name="childSeriesId" value={childSeriesId} />

      <Field label="File (optional)" htmlFor="file">
        <input
          id="file"
          name="file"
          type="file"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
        />
      </Field>

      <Field label="" htmlFor="sharedWithTenant">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            id="sharedWithTenant"
            name="sharedWithTenant"
            type="checkbox"
            className="h-4 w-4 rounded border-input"
          />
          Share with tenant (visible in tenant portal)
        </label>
      </Field>
    </>
  );
}
