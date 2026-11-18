import { expect, test, type Page } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";

const TASKS_PATH = `${LOCALE_PREFIX}/dashboard/task-templates`;
const CLEANING_FORM = `${E2E_PREFIX} Cleaning tick`;
const FRIDGE_FORM = `${E2E_PREFIX} Fridge reading`;

async function openNewTask(page: Page) {
  await page.goto(TASKS_PATH);
  await page.locator("main").getByRole("button", { name: "Add task" }).first().click();
  await expect(page).toHaveURL(/\/task-templates\/new$/);
}

async function saveAndFindRow(page: Page, title: string) {
  await page.getByRole("button", { name: "Save task" }).click();
  await expect(page).toHaveURL(new RegExp(`${TASKS_PATH}$`));
  // Repeated runs accumulate rows past the default page size — search narrows to ours.
  await page.getByPlaceholder("Search tasks").fill(title);
  return page.getByRole("button").filter({ hasText: title });
}

/**
 * The full-page task builder: the time window is optional (off means available all day), times
 * can be listed or repeated beyond four a day, and equipment can be added without leaving.
 */
test.describe("Task builder", () => {
  test("a task with no window is available any time that day", async ({ page }) => {
    const title = `E2E Anytime ${Date.now()}`;
    await openNewTask(page);

    await page.getByRole("combobox", { name: "Form" }).click();
    await page.getByRole("option", { name: new RegExp(CLEANING_FORM) }).click();
    await page.getByLabel("Task name").fill(title);
    await page.getByLabel("Time to add").fill("08:00");
    await page.getByRole("button", { name: "Add time" }).click();
    await expect(page.getByRole("button", { name: "Remove 08:00" })).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Limit when each check can be done" }),
    ).not.toBeChecked();

    const row = await saveAndFindRow(page, title);
    await expect(row).toContainText("Any time that day");
  });

  test("required parts are listed instead of saving an incomplete task", async ({ page }) => {
    await openNewTask(page);
    await page.getByRole("button", { name: "Save task" }).click();

    await expect(page).toHaveURL(/\/task-templates\/new$/);
    await expect(page.getByText("Choose a form.")).toBeVisible();
    await expect(page.getByText("Add at least one time.")).toBeVisible();
  });

  test("repeating every 2 hours with a window survives an edit", async ({ page }) => {
    const title = `E2E Repeat ${Date.now()}`;
    const equipment = `E2E Inline ${Date.now()}`;
    await openNewTask(page);

    await page.getByRole("combobox", { name: "Form" }).click();
    await page.getByRole("option", { name: new RegExp(FRIDGE_FORM) }).click();
    await page.getByLabel("Task name").fill(title);

    await page.getByRole("button", { name: "Add equipment" }).click();
    await page.getByRole("button", { name: "New equipment" }).click();
    await page.getByLabel("Name", { exact: true }).fill(equipment);
    await page.getByRole("button", { name: "Add and select" }).click();
    await expect(page.getByRole("option", { name: equipment })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: `Remove ${equipment}` })).toBeVisible();

    await page.getByRole("tab", { name: "Repeat every…" }).click();
    await page.getByRole("button", { name: "2 h", exact: true }).click();
    await page.getByLabel("From").fill("08:00");
    await page.getByLabel("Until").fill("22:00");
    await expect(page.getByText("8 checks a day, every 2 h from 08:00 to 22:00")).toBeVisible();

    await page.getByRole("switch", { name: "Limit when each check can be done" }).click();
    await page
      .getByRole("group", { name: "Opens" })
      .getByRole("button", { name: "30 min" })
      .click();
    await page
      .getByRole("group", { name: "Overdue" })
      .getByRole("button", { name: "1 h" })
      .click();

    const row = await saveAndFindRow(page, title);
    await expect(row).toContainText("8× · every 2 h, 08:00–22:00");
    await expect(row).toContainText("From 30 min before to 1 h after");

    await row.click();
    await expect(page.getByRole("tab", { name: "Repeat every…" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("switch", { name: "Limit when each check can be done" }),
    ).toBeChecked();
  });
});
