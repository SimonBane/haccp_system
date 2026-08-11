"use client";

import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import {
  REQUIRED_LABEL_CLASS,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";

type FormFieldProps<
  TValues extends FieldValues,
  // Generic over the field name as well as the form, so `field.value` narrows
  // to that one field's type instead of the union of every field in the form.
  TName extends FieldPath<TValues>,
> = {
  control: Control<TValues>;
  name: TName;
  label: ReactNode;
  /** Ties the label to the control. Defaults to the field name. */
  htmlFor?: string;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  /**
   * The control. Receives react-hook-form's field bindings plus the id and
   * `aria-invalid` already resolved, so a caller normally spreads and stops
   * thinking about it.
   */
  children: (props: {
    field: ControllerRenderProps<TValues, TName>;
    id: string;
    invalid: boolean;
  }) => ReactNode;
};

/**
 * One field: label, control, description and error, wired to react-hook-form.
 *
 * Every form in the app was repeating the same Controller → Field → FieldLabel
 * → control → FieldError ladder per input, which is where the small
 * inconsistencies crept in — a missing `data-invalid` here, an error rendered
 * above the control there. Binding it once makes those impossible.
 */
export function FormField<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
>({
  control,
  name,
  label,
  htmlFor,
  description,
  required = false,
  className,
  children,
}: FormFieldProps<TValues, TName>) {
  const id = htmlFor ?? name;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel
            htmlFor={id}
            className={cn(required && REQUIRED_LABEL_CLASS)}
          >
            {label}
          </FieldLabel>
          {description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
          {children({ field, id, invalid: fieldState.invalid })}
          {fieldState.error ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
}
