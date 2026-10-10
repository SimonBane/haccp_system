import type {
  FormResponse,
  FormVersionResponse,
  FormVersionSummaryMap,
} from "@haccp/shared";
import type {
  FormVersionRow,
  FormVersionSummaryRow,
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

export function toFormVersionSummaryMap(
  rows: FormVersionSummaryRow[],
): FormVersionSummaryMap {
  const map: FormVersionSummaryMap = {};

  for (const row of rows) {
    map[row.version.id] = {
      id: row.version.id,
      formId: row.version.formId,
      formName: row.formName,
      category: row.category as FormVersionSummaryMap[string]["category"],
      version: row.version.version,
      definition: row.version.definition,
    };
  }

  return map;
}
