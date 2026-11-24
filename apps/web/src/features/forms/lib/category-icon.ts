import {
  FORM_CATEGORY,
  type FieldType,
  type FormCategory,
  type MeasurementUnit,
} from "@haccp/shared";
import {
  BugIcon,
  CalendarIcon,
  CheckSquareIcon,
  ClipboardCheckIcon,
  DropletIcon,
  FlaskConicalIcon,
  GaugeIcon,
  HandIcon,
  ListChecksIcon,
  PercentIcon,
  SparklesIcon,
  ThermometerIcon,
  TimerIcon,
  TruckIcon,
  TypeIcon,
  WeightIcon,
  type LucideIcon,
} from "lucide-react";

export const FORM_CATEGORY_ICONS: Record<FormCategory, LucideIcon> = {
  [FORM_CATEGORY.TEMPERATURE]: ThermometerIcon,
  [FORM_CATEGORY.CLEANING]: SparklesIcon,
  [FORM_CATEGORY.HYGIENE]: HandIcon,
  [FORM_CATEGORY.PEST_CONTROL]: BugIcon,
  [FORM_CATEGORY.GOODS_IN]: TruckIcon,
};

/** For a task whose form is not loaded, so there is no category to pick from. */
export const FALLBACK_FORM_ICON: LucideIcon = ClipboardCheckIcon;

export const FIELD_TYPE_ICONS: Record<FieldType, LucideIcon> = {
  checkbox: CheckSquareIcon,
  measurement: GaugeIcon,
  choice: ListChecksIcon,
  text: TypeIcon,
  date: CalendarIcon,
};

/** Ppm has no fitting glyph, so it keeps the generic measurement gauge. */
export const MEASUREMENT_UNIT_ICONS: Record<MeasurementUnit, LucideIcon> = {
  celsius: ThermometerIcon,
  ph: FlaskConicalIcon,
  percent: PercentIcon,
  ppm: FIELD_TYPE_ICONS.measurement,
  water_activity: DropletIcon,
  grams: WeightIcon,
  kilograms: WeightIcon,
  minutes: TimerIcon,
};
