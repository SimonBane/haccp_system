import {
  FORM_CATEGORY,
  type FieldType,
  type FormCategory,
} from "@haccp/shared";
import {
  BugIcon,
  CalendarIcon,
  CheckSquareIcon,
  ClipboardCheckIcon,
  FlameIcon,
  GaugeIcon,
  HandIcon,
  ListChecksIcon,
  SnowflakeIcon,
  SparklesIcon,
  ThermometerIcon,
  TruckIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react";

export const FORM_CATEGORY_ICONS: Record<FormCategory, LucideIcon> = {
  [FORM_CATEGORY.TEMPERATURE]: ThermometerIcon,
  [FORM_CATEGORY.CLEANING]: SparklesIcon,
  [FORM_CATEGORY.GOODS_IN]: TruckIcon,
  [FORM_CATEGORY.COOKING]: FlameIcon,
  [FORM_CATEGORY.COOLING]: SnowflakeIcon,
  [FORM_CATEGORY.HYGIENE]: HandIcon,
  [FORM_CATEGORY.PEST_CONTROL]: BugIcon,
  [FORM_CATEGORY.OTHER]: ClipboardCheckIcon,
};

export const FIELD_TYPE_ICONS: Record<FieldType, LucideIcon> = {
  checkbox: CheckSquareIcon,
  measurement: GaugeIcon,
  choice: ListChecksIcon,
  text: TypeIcon,
  date: CalendarIcon,
};
