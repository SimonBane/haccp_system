import { expect, test, type Page } from "@playwright/test";
import { LOCALE_PREFIX } from "../../support/env.js";
import {
  SCRATCH_READING_FORM_NAME,
  SCRATCH_TICK_FORM_NAME,
} from "../../support/forms.js";
import { rowByKey } from "../../support/tasks.js";

const TASKS_PATH = `${LOCALE_PREFIX}/dashboard/task-templates`;

async function openNewTask(page: Page) {
  await page.goto(TASKS_PATH);
  await page.locator("main").getByRole("button", { name: "Add task" }).first().click();
  await expect(page).toHaveURL(/\/task-templates\/new$/);
}

/** Times come from the shared multi-select: pick each from the list, then close it. */
async function pickTimes(page: Page, times: string[]) {
  const input = page.getByRole("combobox", { name: "Times", exact: true });
  for (const time of times) {
    await input.fill(time);
    await page.getByRole("option", { name: time, exact: true }).click();
  }
  await page.keyboard.press("Escape");
}

/** Tasks take their form's name, so the saved one is found by the id the API returns. */
async function saveAndFindRow(page: Page, formName: string) {
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/task-templates$/.test(response.url()),
  );
  await page.getByRole("button", { name: "Save task" }).click();
  const { id } = (await (await created).json()) as { id: string };
  await expect(page).toHaveURL(new RegExp(`${TASKS_PATH}$`));
  await page.getByPlaceholder("Search tasks").fill(formName);
  return rowByKey(page, id);
}

/**
 * The full-page task builder: the time window is optional (off means available all day), times
 * are picked from a list, and equipment can be added without leaving.
 */
test.describe("Task builder", () => {
  test("a task with no window is available any time that day", async ({ page }) => {
    await openNewTask(page);

    await page.getByRole("combobox", { name: "Form" }).click();
    await page.getByRole("option", { name: new RegExp(SCRATCH_TICK_FORM_NAME) }).click();
    await pickTimes(page, ["08:00"]);
    await expect(page.getByText("1 time a day")).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Limit when each check can be done" }),
    ).not.toBeChecked();

    const row = await saveAndFindRow(page, SCRATCH_TICK_FORM_NAME);
    await expect(row).toContainText(SCRATCH_TICK_FORM_NAME);
    await expect(row).toContainText("Any time that day");
  });

  test("required parts are listed instead of saving an incomplete task", async ({ page }) => {
    await openNewTask(page);
    await page.getByRole("button", { name: "Save task" }).click();

    await expect(page).toHaveURL(/\/task-templates\/new$/);
    await expect(page.getByText("Choose a form.")).toBeVisible();
    await expect(page.getByText("Add at least one time.")).toBeVisible();
  });

  test("eight evenly spaced times with a window survive an edit", async ({ page }) => {
    const equipment = `E2E Inline ${Date.now()}`;
    await openNewTask(page);

    await page.getByRole("combobox", { name: "Form" }).click();
    await page.getByRole("option", { name: new RegExp(SCRATCH_READING_FORM_NAME) }).click();

    await page.getByRole("button", { name: "Add equipment" }).click();
    await page.getByRole("button", { name: "New equipment" }).click();
    await page.getByLabel("Name", { exact: true }).fill(equipment);
    await page.getByRole("button", { name: "Add and select" }).click();
    await expect(page.getByRole("option", { name: equipment })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: `Remove ${equipment}` })).toBeVisible();

    await pickTimes(page, ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"]);
    await expect(page.getByText("8 times a day")).toBeVisible();

    await page.getByRole("switch", { name: "Limit when each check can be done" }).click();
    await page
      .getByRole("group", { name: "Opens" })
      .getByRole("button", { name: "30 min" })
      .click();
    await page
      .getByRole("group", { name: "Overdue" })
      .getByRole("button", { name: "1 h" })
      .click();

    const row = await saveAndFindRow(page, SCRATCH_READING_FORM_NAME);
    await expect(row).toContainText("8× · every 2 h, 08:00–22:00");
    await expect(row).toContainText("From 30 min before to 1 h after");

    await row.click();
    await expect(page.getByText("8 times a day")).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Limit when each check can be done" }),
    ).toBeChecked();
  });
});
