import type { FormResponse, FormVersionResponse } from "@haccp/shared";
import type {
  FormVersionRow,
  FormWithLatestVersion,
} from "./form.repository.js";

export function toFormVersionResponse(
  row: FormVersionRow,
): FormVersionResponse {
  return {
    id: row.id,
    formId: row.formId,
    version: row.version,
    definition: row.definition,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toFormResponse({
  form,
  latestVersion,
}: FormWithLatestVersion): FormResponse {
  return {
    id: form.id,
    name: form.name,
    category: form.category as FormResponse["category"],
    latestVersion: toFormVersionResponse(latestVersion),
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
  };
}
