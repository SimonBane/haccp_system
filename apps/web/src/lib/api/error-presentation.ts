import { API_ERROR_CODE } from "@haccp/shared";
import { ApiRequestError, WEB_API_ERROR_CODE } from "./api-utils";

type ApiErrorMessageKey =
  | "generic"
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "unavailable"
  | "reference"
  | "codes.equipmentNameExists"
  | "codes.employeeEmailExists"
  | "codes.locationNameExists"
  | "codes.multipleLocationsDisabled"
  | "codes.defaultLocationDeleteForbidden"
  | "codes.lastLocationDeleteForbidden"
  | "codes.locationHasDependencies"
  | "codes.taskRecordAlreadyExists";

type Translate = (
  key: ApiErrorMessageKey,
  values?: { requestId: string },
) => string;

export type ApiErrorPresentation = {
  message: string;
  description?: string;
};

const actionableCodeKeys: Record<string, ApiErrorMessageKey> = {
  [API_ERROR_CODE.EQUIPMENT_NAME_EXISTS]: "codes.equipmentNameExists",
  [API_ERROR_CODE.EMPLOYEE_EMAIL_EXISTS]: "codes.employeeEmailExists",
  [API_ERROR_CODE.LOCATION_NAME_EXISTS]: "codes.locationNameExists",
  [API_ERROR_CODE.MULTIPLE_LOCATIONS_DISABLED]:
    "codes.multipleLocationsDisabled",
  [API_ERROR_CODE.DEFAULT_LOCATION_DELETE_FORBIDDEN]:
    "codes.defaultLocationDeleteForbidden",
  [API_ERROR_CODE.LAST_LOCATION_DELETE_FORBIDDEN]:
    "codes.lastLocationDeleteForbidden",
  [API_ERROR_CODE.LOCATION_HAS_DEPENDENCIES]: "codes.locationHasDependencies",
  [API_ERROR_CODE.TASK_RECORD_ALREADY_EXISTS]: "codes.taskRecordAlreadyExists",
};

function fallbackKey(error: ApiRequestError): ApiErrorMessageKey {
  if (error.code === WEB_API_ERROR_CODE.NETWORK || error.status === 503) {
    return "unavailable";
  }

  switch (error.status) {
    case 400:
      return "validation";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "notFound";
    case 409:
      return "conflict";
    default:
      return "generic";
  }
}

export function getApiErrorPresentation(
  error: unknown,
  t: Translate,
): ApiErrorPresentation {
  if (!(error instanceof ApiRequestError)) {
    return { message: t("generic") };
  }

  const codeKey = actionableCodeKeys[error.code];
  const message = t(codeKey ?? fallbackKey(error));
  const description =
    error.status !== undefined &&
    error.status >= 500 &&
    error.status !== 503 &&
    error.requestId !== undefined
      ? t("reference", { requestId: error.requestId })
      : undefined;

  return { message, ...(description ? { description } : {}) };
}
