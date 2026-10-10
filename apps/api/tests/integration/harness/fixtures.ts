import { ORG_ROLE, type FormDefinition } from "@haccp/shared";
import { randomUUID } from "node:crypto";
import type { Db } from "../../../src/core/db/client.js";
import {
  forms,
  formVersions,
  locations,
  organizationMemberLocations,
  organizationMemberships,
  organizations,
  targets,
  targetTypes,
  taskOccurrences,
  taskTemplates,
  taskTemplateTargets,
  users,
} from "../../../src/core/db/schema/index.js";
import { MEMBERSHIP_STATUS } from "../../../src/core/db/schema/organization-memberships.js";
import { clerkFake } from "./clerk-fake.js";

export type SeededLocation = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type SeededActor = {
  /** `users.id` — the internal row. */
  userId: string;
  clerkUserId: string;
  email: string;
  membershipId: string;
  role: (typeof ORG_ROLE)[keyof typeof ORG_ROLE];
  /** Empty for admins, who reach every location. */
  locationIds: string[];
};

export type SeededOrg = {
  organizationId: string;
  clerkOrgId: string;
  name: string;
  timeZone: string;
  locations: { main: SeededLocation; annex: SeededLocation };
  admin: SeededActor;
  /** Assigned to `main` only, so "assigned" and "same tenant" can be told apart. */
  employee: SeededActor;
  targetTypes: { fridge: { id: string } };
  targets: { fridge: { id: string; name: string } };
  forms: {
    fridgeCheck: { id: string; versionId: string };
    cleaning: { id: string; versionId: string };
  };
  templates: {
    temperature: { id: string; title: string };
    cleaning: { id: string; title: string };
  };
};

export const FRIDGE_FIELD_ID = "temperature";
export const CLEANING_FIELD_ID = "cleaned";

/** 0–5 °C, corrective action required when out of range: the old temperature task as a form. */
export const FRIDGE_CHECK_DEFINITION: FormDefinition = {
  fields: [
    {
      id: FRIDGE_FIELD_ID,
      type: "measurement",
      label: "Temperature",
      required: true,
      unit: "celsius",
      limits: { min: 0, max: 5 },
    },
  ],
  correctiveAction: "required_on_fail",
};

export const CLEANING_DEFINITION: FormDefinition = {
  fields: [
    {
      id: CLEANING_FIELD_ID,
      type: "checkbox",
      label: "Cleaned",
      required: true,
    },
  ],
  correctiveAction: "required_on_fail",
};

export type TwoTenantWorld = { alpha: SeededOrg; beta: SeededOrg };

const ALL_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export type SeedOrganizationOptions = {
  /** Namespaces emails and Clerk ids. */
  slug?: string;
  name?: string;
  timeZone?: string;
  multipleLocationsEnabled?: boolean;
};

/**
 * Seeds one complete tenant and registers it with the Clerk fake. Identifiers are
 * minted per call: `users.email` is unique on lower(email) **globally, not per
 * tenant**, and single-flight keys provisioning by Clerk id in a process-global map.
 */
export async function seedOrganization(
  db: Db,
  options: SeedOrganizationOptions = {},
): Promise<SeededOrg> {
  const slug = options.slug ?? "org";
  const runId = randomUUID().slice(0, 8);
  const clerkOrgId = `org_${slug}_${runId}`;
  const name = options.name ?? `${slug} organization`;
  const timeZone = options.timeZone ?? "Europe/Sofia";

  return db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values({
        clerkOrgId,
        name,
        timezone: timeZone,
        multipleLocationsEnabled: options.multipleLocationsEnabled ?? true,
      })
      .returning();

    const organizationId = organization!.id;

    // Partial unique index: a second isDefault row in one org is a 23505.
    const insertedLocations = await tx
      .insert(locations)
      .values([
        { organizationId, name: "Main site", isDefault: true },
        { organizationId, name: "Annex", isDefault: false },
      ])
      .returning();

    const main = insertedLocations.find((row) => row.isDefault)!;
    const annex = insertedLocations.find((row) => !row.isDefault)!;

    const adminClerkUserId = `user_${slug}_admin_${runId}`;
    const employeeClerkUserId = `user_${slug}_employee_${runId}`;
    const adminEmail = `admin@${slug}-${runId}.test`;
    const employeeEmail = `employee@${slug}-${runId}.test`;

    const insertedUsers = await tx
      .insert(users)
      .values([
        {
          clerkUserId: adminClerkUserId,
          firstName: "Ada",
          lastName: "Admin",
          email: adminEmail,
        },
        {
          clerkUserId: employeeClerkUserId,
          firstName: "Emil",
          lastName: "Employee",
          email: employeeEmail,
        },
      ])
      .returning();

    const adminUser = insertedUsers.find(
      (row) => row.clerkUserId === adminClerkUserId,
    )!;
    const employeeUser = insertedUsers.find(
      (row) => row.clerkUserId === employeeClerkUserId,
    )!;

    const insertedMemberships = await tx
      .insert(organizationMemberships)
      .values([
        {
          organizationId,
          userId: adminUser.id,
          role: ORG_ROLE.ADMIN,
          status: MEMBERSHIP_STATUS.ACTIVE,
        },
        {
          organizationId,
          userId: employeeUser.id,
          role: ORG_ROLE.EMPLOYEE,
          status: MEMBERSHIP_STATUS.ACTIVE,
        },
      ])
      .returning();

    const adminMembership = insertedMemberships.find(
      (row) => row.userId === adminUser.id,
    )!;
    const employeeMembership = insertedMemberships.find(
      (row) => row.userId === employeeUser.id,
    )!;

    // Only the employee is assigned; admins carry [], read as "every location".
    await tx.insert(organizationMemberLocations).values({
      membershipId: employeeMembership.id,
      locationId: main.id,
      organizationId,
    });

    const [fridgeType] = await tx
      .insert(targetTypes)
      .values({ organizationId, name: "Fridge", kind: "equipment" })
      .returning();

    const [fridge] = await tx
      .insert(targets)
      .values({
        locationId: main.id,
        targetTypeId: fridgeType!.id,
        name: "Fridge 1",
      })
      .returning();

    const insertedForms = await tx
      .insert(forms)
      .values([
        { organizationId, name: "Fridge check", category: "temperature" },
        { organizationId, name: "Cleaning", category: "cleaning" },
      ])
      .returning();
    const fridgeForm = insertedForms.find(
      (row) => row.category === "temperature",
    )!;
    const cleaningForm = insertedForms.find(
      (row) => row.category === "cleaning",
    )!;

    const insertedVersions = await tx
      .insert(formVersions)
      .values([
        {
          formId: fridgeForm.id,
          version: 1,
          definition: FRIDGE_CHECK_DEFINITION,
        },
        {
          formId: cleaningForm.id,
          version: 1,
          definition: CLEANING_DEFINITION,
        },
      ])
      .returning();
    const fridgeVersion = insertedVersions.find(
      (row) => row.formId === fridgeForm.id,
    )!;
    const cleaningVersion = insertedVersions.find(
      (row) => row.formId === cleaningForm.id,
    )!;

    const insertedTemplates = await tx
      .insert(taskTemplates)
      .values([
        {
          locationId: main.id,
          title: "Morning fridge check",
          formId: fridgeForm.id,
          weekdays: ALL_WEEKDAYS,
          scheduledTimes: ["08:00"],
        },
        {
          locationId: main.id,
          title: "Clean prep surface",
          formId: cleaningForm.id,
          weekdays: ALL_WEEKDAYS,
          scheduledTimes: ["09:00"],
        },
      ])
      .returning();

    const temperatureTemplate = insertedTemplates.find(
      (row) => row.formId === fridgeForm.id,
    )!;
    const cleaningTemplate = insertedTemplates.find(
      (row) => row.formId === cleaningForm.id,
    )!;

    await tx.insert(taskTemplateTargets).values({
      taskTemplateId: temperatureTemplate.id,
      targetId: fridge!.id,
      locationId: main.id,
    });

    // Clerk must agree, or a cache miss sends provisioning to the fake and 404s.
    clerkFake.setOrganization(clerkOrgId, { name });
    clerkFake.setUser(adminClerkUserId, {
      firstName: "Ada",
      lastName: "Admin",
      emailAddresses: [
        { id: `idn_${adminClerkUserId}`, emailAddress: adminEmail },
      ],
      primaryEmailAddressId: `idn_${adminClerkUserId}`,
    });
    clerkFake.setUser(employeeClerkUserId, {
      firstName: "Emil",
      lastName: "Employee",
      emailAddresses: [
        { id: `idn_${employeeClerkUserId}`, emailAddress: employeeEmail },
      ],
      primaryEmailAddressId: `idn_${employeeClerkUserId}`,
    });

    return {
      organizationId,
      clerkOrgId,
      name,
      timeZone,
      locations: {
        main: { id: main.id, name: main.name, isDefault: main.isDefault },
        annex: { id: annex.id, name: annex.name, isDefault: annex.isDefault },
      },
      admin: {
        userId: adminUser.id,
        clerkUserId: adminClerkUserId,
        email: adminEmail,
        membershipId: adminMembership.id,
        role: ORG_ROLE.ADMIN,
        locationIds: [],
      },
      employee: {
        userId: employeeUser.id,
        clerkUserId: employeeClerkUserId,
        email: employeeEmail,
        membershipId: employeeMembership.id,
        role: ORG_ROLE.EMPLOYEE,
        locationIds: [main.id],
      },
      targetTypes: { fridge: { id: fridgeType!.id } },
      targets: { fridge: { id: fridge!.id, name: fridge!.name } },
      forms: {
        fridgeCheck: { id: fridgeForm.id, versionId: fridgeVersion.id },
        cleaning: { id: cleaningForm.id, versionId: cleaningVersion.id },
      },
      templates: {
        temperature: {
          id: temperatureTemplate.id,
          title: temperatureTemplate.title,
        },
        cleaning: { id: cleaningTemplate.id, title: cleaningTemplate.title },
      },
    } satisfies SeededOrg;
  });
}

/** Direct template inserts skip reconciliation, so tests mint the stored occurrence themselves. */
export async function seedOccurrence(
  db: Db,
  org: SeededOrg,
  overrides: {
    type: "temperature" | "cleaning";
    locationId?: string;
    occurrenceDate: string;
    scheduledTime?: string;
    availableAt?: Date;
    dueAt?: Date | null;
    title?: string;
  },
): Promise<string> {
  const locationId = overrides.locationId ?? org.locations.main.id;
  const scheduledTime = overrides.scheduledTime ?? "08:00";
  const isTemperature = overrides.type === "temperature";

  const [row] = await db
    .insert(taskOccurrences)
    .values({
      locationId,
      taskTemplateId: isTemperature
        ? org.templates.temperature.id
        : org.templates.cleaning.id,
      occurrenceDate: overrides.occurrenceDate,
      scheduledTime,
      availableAt:
        overrides.availableAt ??
        new Date(`${overrides.occurrenceDate}T00:00:00Z`),
      dueAt:
        overrides.dueAt === undefined
          ? new Date(`${overrides.occurrenceDate}T${scheduledTime}:00Z`)
          : overrides.dueAt,
      title:
        overrides.title ??
        (isTemperature
          ? org.templates.temperature.title
          : org.templates.cleaning.title),
      formVersionId: isTemperature
        ? org.forms.fridgeCheck.versionId
        : org.forms.cleaning.versionId,
      targetId: isTemperature ? org.targets.fridge.id : null,
      targetName: isTemperature ? org.targets.fridge.name : null,
      resolvedLimits: isTemperature
        ? { [FRIDGE_FIELD_ID]: { min: 0, max: 5 } }
        : {},
    })
    .returning({ id: taskOccurrences.id });

  return row!.id;
}

/**
 * Two complete, unrelated tenants — the starting point for cross-tenant assertions.
 * With one tenant, "it worked" and "it was scoped" look identical.
 */
export async function seedTwoTenants(db: Db): Promise<TwoTenantWorld> {
  const alpha = await seedOrganization(db, {
    slug: "alpha",
    name: "Alpha Foods",
  });
  const beta = await seedOrganization(db, {
    slug: "beta",
    name: "Beta Catering",
  });

  return { alpha, beta };
}
