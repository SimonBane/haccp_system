import {
  CORRECTIVE_ACTION_MODE,
  FORM_APPLIES_TO,
  FORM_CATEGORY,
  TARGET_KIND,
  TASK_TEMPLATE_ALL_WEEKDAYS,
  type FormAppliesTo,
  type FormCategory,
  type FormDefinition,
  type ItemLimits,
  type TargetKind,
  type TaskTemplateWeekday,
} from "@haccp/shared";

/** A Bulgarian meat-processing site modelled on the partner's paper journals (Еко Мес, ФРП 03-xx). */

export type SeedTarget = {
  key: string;
  kind: TargetKind;
  name: string;
  parent?: string;
  limits?: ItemLimits;
  /** Where a passing temperature usually sits for this item. */
  typicalTemperature?: [number, number];
};

export type SeedFormVersion = {
  /** Days before the first history day; the first version is published before any history. */
  publishedDaysAgo: number | null;
  definition: FormDefinition;
};

export type SeedForm = {
  key: string;
  name: string;
  category: FormCategory;
  appliesTo: FormAppliesTo;
  onDemand: boolean;
  versions: SeedFormVersion[];
  /** Chance that a record fails one of its failable fields. */
  failRate: number;
  /** Text answers drawn per field id; "@staff" draws an employee's full name. */
  textSamples?: Record<string, string[]>;
  /** Typical passing range per measurement field id when the item does not give one. */
  typicalMeasurements?: Record<string, [number, number]>;
};

export type SeedTemplate = {
  form: string;
  weekdays: TaskTemplateWeekday[];
  times: string[];
  targets: string[];
};

export type SeedOnDemand = {
  form: string;
  weekdays: TaskTemplateWeekday[];
  /** Entries per working day: one per employee, or a random count in the range. */
  perDay: "each_staff" | [number, number];
  window: [string, string];
  targets: string[];
};

export type SeedStaff = { firstName: string; lastName: string; slug: string };

const WORK_WEEK: TaskTemplateWeekday[] = TASK_TEMPLATE_ALL_WEEKDAYS.filter(
  (weekday) => weekday !== "sunday",
);
const MON_FRI: TaskTemplateWeekday[] = WORK_WEEK.filter(
  (weekday) => weekday !== "saturday",
);

const PRODUCTS = [
  "Кренвирши",
  "Шпек салам",
  "Телешки салам",
  "Камчия",
  "Пилешка шунка",
  "Наденица",
  "Хамбургски салам",
  "Свинска шунка",
];

function area(key: string, name: string, extra: Partial<SeedTarget> = {}): SeedTarget {
  return { key, kind: TARGET_KIND.AREA, name, ...extra };
}

function equipment(
  key: string,
  name: string,
  extra: Partial<SeedTarget> = {},
): SeedTarget {
  return { key, kind: TARGET_KIND.EQUIPMENT, name, ...extra };
}

function components(parent: string, names: [string, string][]): SeedTarget[] {
  return names.map(([suffix, name]) => ({
    key: `${parent}.${suffix}`,
    kind: TARGET_KIND.COMPONENT,
    name,
    parent,
  }));
}

const FLOOR: [string, string] = ["floor", "Под"];
const WALLS: [string, string] = ["walls", "Стени"];
const CEILING: [string, string] = ["ceiling", "Таван"];
const DOOR: [string, string] = ["door", "Врата"];

export const SEED_TARGETS: SeedTarget[] = [
  area("chamber1", "Хладилна камера №1 – месни суровини", {
    limits: { temperature: { min: null, max: -12 } },
    typicalTemperature: [-19, -14.5],
  }),
  ...components("chamber1", [FLOOR, WALLS, CEILING, DOOR]),
  area("chamber2", "Хладилна камера №2 – охладени суровини", {
    limits: { temperature: { min: 0, max: 7 } },
    typicalTemperature: [1.5, 5],
  }),
  ...components("chamber2", [FLOOR, WALLS, CEILING, DOOR]),
  area("finished", "Хладилник за готова продукция", {
    limits: { temperature: { min: 0, max: 7 } },
    typicalTemperature: [2, 5.5],
  }),
  ...components("finished", [FLOOR, WALLS, CEILING, DOOR, ["shelves", "Стелажи"]]),
  area("defrost", "Помещение за дефростиране и измиване"),
  ...components("defrost", [FLOOR, WALLS, CEILING, DOOR, ["sinks", "Мивки"]]),
  area("mincing", "Помещение за смилане, омесване и пълнене", {
    limits: { temperature: { min: null, max: 16 } },
    typicalTemperature: [10, 14.5],
  }),
  ...components("mincing", [FLOOR, WALLS, CEILING, ["sink", "Мивка"]]),
  area("packing", "Помещение за пакетиране и етикетиране", {
    limits: { temperature: { min: null, max: 16 } },
    typicalTemperature: [11, 15],
  }),
  ...components("packing", [FLOOR, WALLS, CEILING, DOOR]),
  area("lockers", "Съблекалня"),
  ...components("lockers", [FLOOR, WALLS, ["shower", "Душ"], ["toilet", "Тоалетна"]]),
  equipment("mincer", "Волф (месомелачка)", { parent: "mincing" }),
  equipment("mixer", "Бъркачка", { parent: "mincing" }),
  equipment("filler", "Пълначка", { parent: "mincing" }),
  equipment("scale", "Везна за размерване", { parent: "packing" }),
  equipment("sterilizerDeboning", "Стерилизатор за ножове – обезкостяване"),
  equipment("sterilizerShaping", "Стерилизатор за ножове – оформяне"),
  equipment("atmos24", "Атмосна камера №24"),
  equipment("atmos25", "Атмосна камера №25"),
  equipment("atmos26", "Атмосна камера №26"),
];

const CLEANING_DEFINITION: FormDefinition = {
  fields: [
    {
      id: "before",
      type: "choice",
      label: "Състояние преди почистване",
      required: true,
      multiple: false,
      options: [
        { id: "clean", label: "Чисто", fails: false },
        { id: "soiled", label: "Замърсено", fails: false },
      ],
    },
    {
      id: "procedures",
      type: "choice",
      label: "Извършени процедури",
      required: true,
      multiple: true,
      options: [
        { id: "cleaning", label: "Почистване (П)", fails: false },
        { id: "washing", label: "Измиване (И)", fails: false },
        { id: "disinfection", label: "Дезинфекция (Д)", fails: false },
        { id: "rinsing", label: "Изплакване (Из)", fails: false },
      ],
    },
    {
      id: "after",
      type: "choice",
      label: "Резултат от почистването",
      required: true,
      multiple: false,
      options: [
        { id: "ok", label: "Добре почистено", fails: false },
        { id: "not_ok", label: "Замърсено", fails: true },
      ],
    },
  ],
  correctiveAction: CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL,
  corrective: {
    answers: [
      { id: "reclean", label: "Повторно почистване" },
      { id: "redisinfect", label: "Повторна дезинфекция" },
      { id: "manager", label: "Уведомен ръководител" },
    ],
    multiple: true,
    allowNote: true,
  },
};

const STORAGE_TEMPERATURE_V1: FormDefinition = {
  fields: [
    {
      id: "temperature",
      type: "measurement",
      label: "Температура",
      required: true,
      parameter: "temperature",
      unit: "celsius",
      limits: { min: null, max: 7 },
    },
  ],
  correctiveAction: CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL,
  corrective: {
    answers: [
      { id: "thermostat", label: "Регулиране на термостата" },
      { id: "moved", label: "Продуктите са преместени в друга камера" },
      { id: "service", label: "Повикан сервиз" },
      { id: "manager", label: "Уведомен ръководител" },
    ],
    multiple: true,
    allowNote: true,
  },
};

const STORAGE_TEMPERATURE_V2: FormDefinition = {
  ...STORAGE_TEMPERATURE_V1,
  fields: [
    ...STORAGE_TEMPERATURE_V1.fields,
    {
      id: "shelf_life",
      type: "choice",
      label: "Съответствие срок на годност",
      required: false,
      multiple: false,
      options: [
        { id: "yes", label: "Да", fails: false },
        { id: "no", label: "Не", fails: true },
      ],
    },
  ],
};

const STERILIZER_DEFINITION: FormDefinition = {
  fields: [
    {
      id: "temperature",
      type: "measurement",
      label: "Температура на водата",
      help: "Измерва се с калибриран термометър.",
      required: true,
      parameter: "temperature",
      unit: "celsius",
      limits: { min: 82, max: null },
    },
    {
      id: "water_changed",
      type: "checkbox",
      label: "Водата е сменена",
      required: false,
    },
  ],
  correctiveAction: CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL,
  corrective: {
    answers: [
      { id: "reheat", label: "Повторно загряване и измерване" },
      { id: "knives", label: "Ножовете са стерилизирани повторно" },
      { id: "manager", label: "Уведомен ръководител" },
    ],
    multiple: true,
    allowNote: true,
  },
};

const COOKING_DEFINITION: FormDefinition = {
  fields: [
    {
      id: "product",
      type: "text",
      label: "Продукт",
      required: true,
      multiline: false,
    },
    {
      id: "batch",
      type: "text",
      label: "Партида",
      required: false,
      multiline: false,
    },
    {
      id: "core_temperature",
      type: "measurement",
      label: "Температура в центъра на продукта",
      help: "Критична граница: не по-малко от 72 °C.",
      required: true,
      parameter: "temperature",
      unit: "celsius",
      limits: { min: 72, max: null },
    },
  ],
  correctiveAction: CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL,
  corrective: {
    answers: [
      { id: "extend", label: "Удължаване на термичната обработка" },
      { id: "blocked", label: "Партидата е блокирана" },
      { id: "haccp_lead", label: "Уведомен ръководител екип HACCP" },
    ],
    multiple: true,
    allowNote: true,
  },
};

const HYGIENE_DEFINITION: FormDefinition = {
  fields: [
    {
      id: "employee",
      type: "text",
      label: "Служител",
      required: true,
      multiline: false,
    },
    {
      id: "clothing",
      type: "choice",
      label: "Работно облекло",
      required: true,
      multiple: false,
      options: [
        { id: "clean", label: "Чисто", fails: false },
        { id: "dirty", label: "Замърсено", fails: true },
      ],
    },
    {
      id: "personal_hygiene",
      type: "choice",
      label: "Лична хигиена",
      required: true,
      multiple: false,
      options: [
        { id: "good", label: "Добра", fails: false },
        { id: "poor", label: "Лоша", fails: true },
      ],
    },
    {
      id: "health",
      type: "choice",
      label: "Здравословно състояние",
      required: true,
      multiple: false,
      options: [
        { id: "healthy", label: "Здрав", fails: false },
        { id: "ill", label: "Болен", fails: true },
        { id: "skin_injury", label: "Кожни наранявания", fails: true },
      ],
    },
    {
      id: "jewellery",
      type: "choice",
      label: "Накити",
      required: true,
      multiple: false,
      options: [
        { id: "none", label: "Без накити", fails: false },
        { id: "worn", label: "С накити", fails: true },
      ],
    },
  ],
  correctiveAction: CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL,
  corrective: {
    answers: [
      { id: "change_clothes", label: "Сменено работно облекло" },
      { id: "jewellery_removed", label: "Свалени накити" },
      { id: "wound_covered", label: "Превързана рана и ръкавици" },
      { id: "sent_home", label: "Отстранен от работа" },
    ],
    multiple: true,
    allowNote: true,
  },
};

export const SEED_FORMS: SeedForm[] = [
  {
    key: "cleaning",
    name: "Контролна карта за почистване и дезинфекция",
    category: FORM_CATEGORY.CLEANING,
    appliesTo: FORM_APPLIES_TO.PER_ITEM,
    onDemand: false,
    versions: [{ publishedDaysAgo: null, definition: CLEANING_DEFINITION }],
    failRate: 0.02,
  },
  {
    key: "storage",
    name: "Чек лист ККТ – температура на хладилници и работни помещения",
    category: FORM_CATEGORY.TEMPERATURE,
    appliesTo: FORM_APPLIES_TO.PER_ITEM,
    onDemand: false,
    versions: [
      { publishedDaysAgo: null, definition: STORAGE_TEMPERATURE_V1 },
      { publishedDaysAgo: 14, definition: STORAGE_TEMPERATURE_V2 },
    ],
    failRate: 0.04,
  },
  {
    key: "sterilizer",
    name: "Стерилизатор за ножове – обезкостяване и оформяне",
    category: FORM_CATEGORY.TEMPERATURE,
    appliesTo: FORM_APPLIES_TO.PER_ITEM,
    onDemand: false,
    versions: [{ publishedDaysAgo: null, definition: STERILIZER_DEFINITION }],
    failRate: 0.03,
    typicalMeasurements: { temperature: [83, 89] },
  },
  {
    key: "cooking",
    name: "ККТ №2Б – термична обработка (варене)",
    category: FORM_CATEGORY.TEMPERATURE,
    appliesTo: FORM_APPLIES_TO.PER_ITEM,
    onDemand: true,
    versions: [{ publishedDaysAgo: null, definition: COOKING_DEFINITION }],
    failRate: 0.04,
    textSamples: { product: PRODUCTS, batch: ["@batch"] },
    typicalMeasurements: { core_temperature: [72.5, 78] },
  },
  {
    key: "hygiene",
    name: "Контролна карта за лична хигиена и здраве на персонала",
    category: FORM_CATEGORY.HYGIENE,
    appliesTo: FORM_APPLIES_TO.LOCATION,
    onDemand: true,
    versions: [{ publishedDaysAgo: null, definition: HYGIENE_DEFINITION }],
    failRate: 0.03,
    textSamples: { employee: ["@staff"] },
  },
];

const CLEANING_TARGETS = SEED_TARGETS.filter(
  (target) =>
    target.kind === TARGET_KIND.COMPONENT ||
    ["mincer", "mixer", "filler", "scale"].includes(target.key),
).map((target) => target.key);

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    form: "cleaning",
    weekdays: WORK_WEEK,
    times: ["17:30"],
    targets: CLEANING_TARGETS,
  },
  {
    form: "storage",
    weekdays: TASK_TEMPLATE_ALL_WEEKDAYS,
    times: ["08:00", "14:00", "20:00"],
    targets: ["chamber1", "chamber2", "finished", "mincing", "packing"],
  },
  {
    form: "sterilizer",
    weekdays: WORK_WEEK,
    times: ["09:00", "15:00"],
    targets: ["sterilizerDeboning", "sterilizerShaping"],
  },
];

export const SEED_ON_DEMAND: SeedOnDemand[] = [
  {
    form: "cooking",
    weekdays: MON_FRI,
    perDay: [3, 6],
    window: ["09:00", "16:30"],
    targets: ["atmos24", "atmos25", "atmos26"],
  },
  {
    form: "hygiene",
    weekdays: WORK_WEEK,
    perDay: "each_staff",
    window: ["07:00", "07:45"],
    targets: [],
  },
];

export const SEED_STAFF: SeedStaff[] = [
  { firstName: "Иван", lastName: "Петров", slug: "ivan" },
  { firstName: "Мария", lastName: "Георгиева", slug: "maria" },
  { firstName: "Георги", lastName: "Димитров", slug: "georgi" },
  { firstName: "Елена", lastName: "Николова", slug: "elena" },
];

/** Seed users carry this domain so a reset can find them; example.com never receives mail. */
export const SEED_EMAIL_DOMAIN = "example.com";

export function seedStaffEmail(slug: string, organizationId: string): string {
  return `haccp-seed+${slug}-${organizationId.slice(0, 8)}@${SEED_EMAIL_DOMAIN}`;
}

export const SEED_EMAIL_PREFIX = "haccp-seed+";
