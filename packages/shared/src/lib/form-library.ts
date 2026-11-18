import {
  CORRECTIVE_ACTION_MODE,
  FIELD_TYPE,
  FORM_APPLIES_TO,
  FORM_CATEGORY,
  type FormAppliesTo,
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
  appliesTo: FormAppliesTo;
  name: Localized;
  description: Localized;
  fields: LibraryField[];
};

const YES: Localized = { bg: "Да", en: "Yes" };
const NO: Localized = { bg: "Не", en: "No" };
const NOTES: LibraryField = {
  type: "text",
  id: "notes",
  label: { bg: "Бележки", en: "Notes" },
  required: false,
  multiline: true,
};

const CHEMICAL_USED: LibraryField = {
  type: "choice",
  id: "chemical",
  label: { bg: "Използван препарат", en: "Chemical used" },
  required: false,
  multiple: false,
  options: [
    {
      id: "detergent",
      label: { bg: "Миещ препарат", en: "Detergent" },
      fails: false,
    },
    {
      id: "disinfectant",
      label: { bg: "Дезинфектант", en: "Disinfectant" },
      fails: false,
    },
    {
      id: "combined",
      label: { bg: "Комбиниран препарат", en: "Combined product" },
      fails: false,
    },
  ],
};

const LIBRARY: LibraryEntry[] = [
  {
    key: "fridge_check",
    category: FORM_CATEGORY.TEMPERATURE,
    appliesTo: FORM_APPLIES_TO.PER_ITEM,
    name: {
      bg: "Проверка на температурата в хладилник",
      en: "Fridge temperature check",
    },
    description: {
      bg: "Температура на въздуха с граници, уплътнения на вратата и съхранение на храната.",
      en: "Air temperature with limits, door seals and how food is stored.",
    },
    fields: [
      {
        type: "measurement",
        id: "air_temperature",
        label: { bg: "Температура на въздуха", en: "Air temperature" },
        required: true,
        unit: "celsius",
        min: 0,
        max: 4,
      },
      {
        type: "checkbox",
        id: "door_seals",
        label: {
          bg: "Уплътненията на вратата са здрави",
          en: "Door seals intact",
        },
        required: true,
      },
      {
        type: "choice",
        id: "food_storage",
        label: { bg: "Как се съхранява храната?", en: "How is food stored?" },
        required: true,
        multiple: false,
        options: [
          {
            id: "covered",
            label: {
              bg: "Покрита, етикетирана и в срок",
              en: "Covered, labelled and in date",
            },
            fails: false,
          },
          {
            id: "uncovered",
            label: {
              bg: "Непокрита или без етикет",
              en: "Uncovered or unlabelled",
            },
            fails: true,
          },
          {
            id: "expired",
            label: {
              bg: "С изтекъл срок на годност",
              en: "Past its use-by date",
            },
            fails: true,
          },
        ],
      },
    ],
  },
  {
    key: "freezer_check",
    category: FORM_CATEGORY.TEMPERATURE,
    appliesTo: FORM_APPLIES_TO.PER_ITEM,
    name: {
      bg: "Проверка на температурата във фризер",
      en: "Freezer temperature check",
    },
    description: {
      bg: "Температура на въздуха с горна граница и проверка за натрупан лед.",
      en: "Air temperature with a ceiling and an ice build-up check.",
    },
    fields: [
      {
        type: "measurement",
        id: "air_temperature",
        label: { bg: "Температура на въздуха", en: "Air temperature" },
        required: true,
        unit: "celsius",
        min: null,
        max: -18,
      },
      {
        type: "checkbox",
        id: "no_ice_buildup",
        label: { bg: "Няма натрупан лед", en: "No heavy ice build-up" },
        required: true,
      },
    ],
  },
  {
    key: "cleaning",
    category: FORM_CATEGORY.CLEANING,
    appliesTo: FORM_APPLIES_TO.PER_ITEM,
    name: { bg: "Почистване и дезинфекция", en: "Cleaning & disinfection" },
    description: {
      bg: "Почистено, дезинфекцирано и какъв препарат е използван.",
      en: "Cleaned, disinfected and which chemical was used.",
    },
    fields: [
      {
        type: "checkbox",
        id: "cleaned",
        label: { bg: "Почистено", en: "Cleaned" },
        required: true,
      },
      {
        type: "checkbox",
        id: "disinfected",
        label: { bg: "Дезинфекцирано", en: "Disinfected" },
        required: true,
      },
      CHEMICAL_USED,
    ],
  },
  {
    key: "surface_cleaning",
    category: FORM_CATEGORY.CLEANING,
    appliesTo: FORM_APPLIES_TO.PER_ITEM,
    name: { bg: "Почистване на повърхности", en: "Surface cleaning" },
    description: {
      bg: "Стени, подове, тавани и врати: почистени и в добро състояние.",
      en: "Walls, floors, ceilings and doors: cleaned and in good repair.",
    },
    fields: [
      {
        type: "checkbox",
        id: "cleaned",
        label: { bg: "Почистено", en: "Cleaned" },
        required: true,
      },
      {
        type: "checkbox",
        id: "good_repair",
        label: {
          bg: "Без повреди, мухъл или лющене",
          en: "No damage, mould or flaking",
        },
        required: true,
      },
      CHEMICAL_USED,
      NOTES,
    ],
  },
  {
    key: "opening_checklist",
    category: FORM_CATEGORY.HYGIENE,
    appliesTo: FORM_APPLIES_TO.LOCATION,
    name: { bg: "Проверка при отваряне", en: "Opening checklist" },
    description: {
      bg: "Мивки за ръце, повърхности и хигиена на персонала преди започване на работа.",
      en: "Hand-wash stations, surfaces and staff hygiene before service.",
    },
    fields: [
      {
        type: "checkbox",
        id: "hand_wash",
        label: {
          bg: "Мивките за ръце са заредени със сапун и кърпи",
          en: "Hand-wash stations stocked with soap and towels",
        },
        required: true,
      },
      {
        type: "checkbox",
        id: "surfaces",
        label: {
          bg: "Работните повърхности са чисти и дезинфекцирани",
          en: "Work surfaces clean and disinfected",
        },
        required: true,
      },
      {
        type: "checkbox",
        id: "staff_hygiene",
        label: {
          bg: "Персоналът е с чисто облекло и годен за работа",
          en: "Staff in clean uniforms and fit for work",
        },
        required: true,
      },
      {
        type: "checkbox",
        id: "no_pests",
        label: { bg: "Няма следи от вредители", en: "No signs of pests" },
        required: true,
      },
      NOTES,
    ],
  },
  {
    key: "pest_control",
    category: FORM_CATEGORY.PEST_CONTROL,
    appliesTo: FORM_APPLIES_TO.PER_ITEM,
    name: { bg: "Контрол на вредители", en: "Pest control inspection" },
    description: {
      bg: "Следи от вредители, примамки и защита на отворите.",
      en: "Signs of activity, bait points and proofing.",
    },
    fields: [
      {
        type: "choice",
        id: "activity",
        label: { bg: "Следи от вредители", en: "Signs of pest activity" },
        required: true,
        multiple: false,
        options: [
          { id: "none", label: { bg: "Няма", en: "None" }, fails: false },
          { id: "found", label: { bg: "Открити", en: "Found" }, fails: true },
        ],
      },
      {
        type: "checkbox",
        id: "bait_points",
        label: {
          bg: "Примамките са проверени и цели",
          en: "Bait points checked and intact",
        },
        required: true,
      },
      {
        type: "checkbox",
        id: "proofing",
        label: {
          bg: "Вратите, прозорците и отворите са защитени",
          en: "Doors, windows and gaps proofed",
        },
        required: true,
      },
      NOTES,
    ],
  },
  {
    key: "goods_in",
    category: FORM_CATEGORY.GOODS_IN,
    appliesTo: FORM_APPLIES_TO.LOCATION,
    name: { bg: "Приемане на стоки", en: "Goods in" },
    description: {
      bg: "Доставчик, температура при доставка, опаковка и срок на годност.",
      en: "Supplier, delivery temperature, packaging and use-by date.",
    },
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
  description: string;
  category: FormCategory;
  appliesTo: FormAppliesTo;
  definition: FormDefinition;
};

export function getStarterForms(locale: LibraryLocale): StarterForm[] {
  return LIBRARY.map((entry) => ({
    key: entry.key,
    name: entry.name[locale],
    description: entry.description[locale],
    category: entry.category,
    appliesTo: entry.appliesTo,
    definition: {
      fields: entry.fields.map((field) => toField(field, locale)),
      correctiveAction: CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL,
    },
  }));
}
