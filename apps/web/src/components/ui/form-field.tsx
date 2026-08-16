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
  TName extends FieldPath<TValues>,
> = {
  control: Control<TValues>;
  name: TName;
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  children: (props: {
    field: ControllerRenderProps<TValues, TName>;
    id: string;
    invalid: boolean;
  }) => ReactNode;
};

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
