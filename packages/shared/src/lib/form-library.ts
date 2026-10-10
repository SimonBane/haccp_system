import {
  CORRECTIVE_ACTION_MODE,
  FIELD_TYPE,
  FORM_CATEGORY,
  type FormCategory,
  type FormDefinition,
  type FormField,
  type MeasurementUnit,
} from "../schemas/form.js";

export type LibraryLocale = "bg" | "en";

type Localized = { bg: string; en: string };

type LibraryField =
  | { type: "checkbox"; id: string; label: Localized; required: boolean }
  | {
      type: "measurement";
      id: string;
      label: Localized;
      required: boolean;
      unit: MeasurementUnit;
      min: number | null;
      max: number | null;
    }
  | {
      type: "choice";
      id: string;
      label: Localized;
      required: boolean;
      multiple: boolean;
      options: { id: string; label: Localized; fails: boolean }[];
    }
  | {
      type: "text";
      id: string;
      label: Localized;
      required: boolean;
      multiline: boolean;
    }
  | { type: "date"; id: string; label: Localized; required: boolean };

type LibraryEntry = {
  key: string;
  category: FormCategory;
  name: Localized;
  fields: LibraryField[];
};

const YES: Localized = { bg: "Да", en: "Yes" };
const NO: Localized = { bg: "Не", en: "No" };

const LIBRARY: LibraryEntry[] = [
  {
    key: "fridge_check",
    category: FORM_CATEGORY.TEMPERATURE,
    name: { bg: "Проверка на хладилник", en: "Fridge check" },
    fields: [
      {
        type: "measurement",
        id: "temperature",
        label: { bg: "Температура", en: "Temperature" },
        required: true,
        unit: "celsius",
        min: 0,
        max: 4,
      },
    ],
  },
  {
    key: "freezer_check",
    category: FORM_CATEGORY.TEMPERATURE,
    name: { bg: "Проверка на фризер", en: "Freezer check" },
    fields: [
      {
        type: "measurement",
        id: "temperature",
        label: { bg: "Температура", en: "Temperature" },
        required: true,
        unit: "celsius",
        min: -25,
        max: -18,
      },
    ],
  },
  {
    key: "cleaning",
    category: FORM_CATEGORY.CLEANING,
    name: { bg: "Почистване", en: "Cleaning" },
    fields: [
      {
        type: "checkbox",
        id: "cleaned",
        label: {
          bg: "Почистено и дезинфекцирано",
          en: "Cleaned and disinfected",
        },
        required: true,
      },
    ],
  },
  {
    key: "goods_in",
    category: FORM_CATEGORY.GOODS_IN,
    name: { bg: "Приемане на стоки", en: "Goods-in check" },
    fields: [
      {
        type: "text",
        id: "supplier",
        label: { bg: "Доставчик", en: "Supplier" },
        required: true,
        multiline: false,
      },
      {
        type: "text",
        id: "product",
        label: { bg: "Продукт", en: "Product" },
        required: true,
        multiline: false,
      },
      {
        type: "measurement",
        id: "product_temperature",
        label: { bg: "Температура на продукта", en: "Product temperature" },
        required: false,
        unit: "celsius",
        min: null,
        max: 5,
      },
      {
        type: "choice",
        id: "packaging_intact",
        label: { bg: "Опаковката е цяла", en: "Packaging intact" },
        required: true,
        multiple: false,
        options: [
          { id: "yes", label: YES, fails: false },
          { id: "no", label: NO, fails: true },
        ],
      },
      {
        type: "date",
        id: "use_by",
        label: { bg: "Годен до", en: "Use-by date" },
        required: false,
      },
      {
        type: "choice",
        id: "decision",
        label: { bg: "Решение", en: "Decision" },
        required: true,
        multiple: false,
        options: [
          {
            id: "accepted",
            label: { bg: "Приета", en: "Accepted" },
            fails: false,
          },
          {
            id: "partially_accepted",
            label: { bg: "Частично приета", en: "Partially accepted" },
            fails: true,
          },
          {
            id: "rejected",
            label: { bg: "Отказана", en: "Rejected" },
            fails: true,
          },
        ],
      },
    ],
  },
  {
    key: "cooking",
    category: FORM_CATEGORY.COOKING,
    name: { bg: "Термична обработка", en: "Cooking check" },
    fields: [
      {
        type: "text",
        id: "product",
        label: { bg: "Продукт", en: "Product" },
        required: true,
        multiline: false,
      },
      {
        type: "measurement",
        id: "core_temperature",
        label: { bg: "Температура в центъра", en: "Core temperature" },
        required: true,
        unit: "celsius",
        min: 75,
        max: null,
      },
    ],
  },
  {
    key: "hot_holding",
    category: FORM_CATEGORY.COOKING,
    name: { bg: "Топло съхранение", en: "Hot holding check" },
    fields: [
      {
        type: "measurement",
        id: "temperature",
        label: { bg: "Температура", en: "Temperature" },
        required: true,
        unit: "celsius",
        min: 63,
        max: null,
      },
    ],
  },
  {
    key: "cooling",
    category: FORM_CATEGORY.COOLING,
    name: { bg: "Охлаждане", en: "Cooling check" },
    fields: [
      {
        type: "text",
        id: "product",
        label: { bg: "Продукт", en: "Product" },
        required: true,
        multiline: false,
      },
      {
        type: "measurement",
        id: "end_temperature",
        label: {
          bg: "Температура в края на охлаждането",
          en: "Temperature at end of cooling",
        },
        required: true,
        unit: "celsius",
        min: null,
        max: 5,
      },
      {
        type: "measurement",
        id: "cooling_time",
        label: { bg: "Време за охлаждане", en: "Cooling time" },
        required: true,
        unit: "minutes",
        min: null,
        max: 120,
      },
    ],
  },
  {
    key: "frying_oil",
    category: FORM_CATEGORY.OTHER,
    name: { bg: "Качество на олиото за пържене", en: "Frying oil quality" },
    fields: [
      {
        type: "measurement",
        id: "polar_compounds",
        label: { bg: "Полярни съединения", en: "Polar compounds" },
        required: true,
        unit: "percent",
        min: null,
        max: 24,
      },
      {
        type: "checkbox",
        id: "oil_changed",
        label: { bg: "Олиото е сменено", en: "Oil changed" },
        required: false,
      },
    ],
  },
];

function toField(field: LibraryField, locale: LibraryLocale): FormField {
  const base = {
    id: field.id,
    label: field.label[locale],
    required: field.required,
  };

  switch (field.type) {
    case "checkbox":
      return { ...base, type: FIELD_TYPE.CHECKBOX };
    case "measurement":
      return {
        ...base,
        type: FIELD_TYPE.MEASUREMENT,
        unit: field.unit,
        limits: { min: field.min, max: field.max },
      };
    case "choice":
      return {
        ...base,
        type: FIELD_TYPE.CHOICE,
        multiple: field.multiple,
        options: field.options.map((option) => ({
          id: option.id,
          label: option.label[locale],
          fails: option.fails,
        })),
      };
    case "text":
      return { ...base, type: FIELD_TYPE.TEXT, multiline: field.multiline };
    case "date":
      return { ...base, type: FIELD_TYPE.DATE };
  }
}

export type StarterForm = {
  key: string;
  name: string;
  category: FormCategory;
  definition: FormDefinition;
};

export function getStarterForms(locale: LibraryLocale): StarterForm[] {
  return LIBRARY.map((entry) => ({
    key: entry.key,
    name: entry.name[locale],
    category: entry.category,
    definition: {
      fields: entry.fields.map((field) => toField(field, locale)),
      correctiveAction: CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL,
    },
  }));
}
