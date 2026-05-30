import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Lightweight form fields built on native inputs/selects so they submit
 * reliably inside a plain <form> (used by FormDialog). Optimized for fast
 * manual data entry — labels, sensible widths, grid-friendly.
 */

export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  hint,
  required,
  className,
  ...props
}: {
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field
      label={label}
      htmlFor={name}
      hint={hint}
      required={required}
      className={className}
    >
      <Input id={name} name={name} required={required} {...props} />
    </Field>
  );
}

export function MoneyField({
  label,
  name,
  hint,
  required,
  defaultValue,
  className,
}: {
  label: string;
  name: string;
  hint?: string;
  required?: boolean;
  defaultValue?: number | string;
  className?: string;
}) {
  return (
    <Field
      label={label}
      htmlFor={name}
      hint={hint}
      required={required}
      className={className}
    >
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={name}
          name={name}
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          className="pl-6"
          defaultValue={defaultValue}
          required={required}
        />
      </div>
    </Field>
  );
}

export function TextareaField({
  label,
  name,
  hint,
  required,
  className,
  ...props
}: {
  label: string;
  hint?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field
      label={label}
      htmlFor={name}
      hint={hint}
      required={required}
      className={className}
    >
      <Textarea id={name} name={name} required={required} {...props} />
    </Field>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  name,
  options,
  hint,
  required,
  defaultValue,
  placeholder,
  className,
  includeBlank,
}: {
  label: string;
  name: string;
  options: SelectOption[];
  hint?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  includeBlank?: boolean;
}) {
  return (
    <Field
      label={label}
      htmlFor={name}
      hint={hint}
      required={required}
      className={className}
    >
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue ?? (includeBlank ? "" : undefined)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {includeBlank ? (
          <option value="">{placeholder ?? "— Select —"}</option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
