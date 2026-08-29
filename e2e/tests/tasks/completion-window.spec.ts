import { expect, test } from "@playwright/test";
import { LOCALE_PREFIX } from "../../support/env.js";

const TASKS_PATH = `${LOCALE_PREFIX}/dashboard/task-templates`;

/**
 * HACCP-70: the admin's Completion window section on the task-template form — preset
 * Available/Deadline dropdowns (including the No deadline preset), that both are required with
 * no prefilled default, and that the chosen window persists through create/edit/duplicate.
 */
test.describe("Task template completion window", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TASKS_PATH);
  });

  test("admin configures a window from presets and it persists through edit", async ({
    page,
  }) => {
    const title = `E2E Window ${Date.now()}`;

    await page.locator("main").getByRole("button", { name: "Add" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder("Check walk-in chiller").fill(title);
    await dialog.getByRole("button", { name: "Cleaning" }).click();
    await dialog.getByRole("button", { name: "Every day" }).click();

    await dialog.getByRole("button", { name: "Add time" }).click();
    await dialog.locator('input[type="time"]').fill("08:00");

    const available = dialog.getByRole("combobox", { name: "Available" });
    const deadline = dialog.getByRole("combobox", { name: "Deadline" });

    await available.click();
    await page.getByRole("option", { name: "30 minutes before" }).click();
    await expect(available).toContainText("30 minutes before");

    await deadline.click();
    await page.getByRole("option", { name: "No deadline" }).click();
    await expect(deadline).toContainText("No deadline");

    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).toBeHidden();

    // Repeated runs accumulate rows past the default page size — search narrows to ours.
    await page.getByPlaceholder("Search tasks").fill(title);
    const row = page.getByRole("button").filter({ hasText: title });
    await expect(row).toContainText("30 min before");
    await expect(row).toContainText("No deadline");

    // Edit: the persisted window loads back as the matching presets.
    await row.click();
    const editDialog = page.getByRole("dialog");
    await expect(
      editDialog.getByRole("combobox", { name: "Available" }),
    ).toContainText("30 minutes before");
    await expect(
      editDialog.getByRole("combobox", { name: "Deadline" }),
    ).toContainText("No deadline");
    await editDialog.getByRole("button", { name: "Close" }).click();
    await expect(editDialog).toBeHidden();
  });

  test("Available and Deadline are required with no default preset", async ({
    page,
  }) => {
    const title = `E2E Required ${Date.now()}`;

    await page.locator("main").getByRole("button", { name: "Add" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const available = dialog.getByRole("combobox", { name: "Available" });
    const deadline = dialog.getByRole("combobox", { name: "Deadline" });

    // Neither dropdown carries a preselected value until the admin chooses one.
    await expect(available).toContainText("Select when it opens");
    await expect(deadline).toContainText("Select a deadline");

    await dialog.getByPlaceholder("Check walk-in chiller").fill(title);
    await dialog.getByRole("button", { name: "Cleaning" }).click();
    await dialog.getByRole("button", { name: "Every day" }).click();
    await dialog.getByRole("button", { name: "Add time" }).click();
    await dialog.locator('input[type="time"]').fill("08:00");

    await dialog.locator('button[type="submit"]').click();
    await expect(
      dialog.getByText("Select when the task becomes available."),
    ).toBeVisible();
    await expect(
      dialog.getByText("Select a deadline."),
    ).toBeVisible();
    await expect(dialog).toBeVisible();

    await available.click();
    await page.getByRole("option", { name: "1 hour before" }).click();
    await deadline.click();
    await page.getByRole("option", { name: "At the scheduled time" }).click();

    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).toBeHidden();
  });

  test("a custom deadline value validates against the 0–1440 range", async ({
    page,
  }) => {
    const title = `E2E Custom ${Date.now()}`;

    await page.locator("main").getByRole("button", { name: "Add" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder("Check walk-in chiller").fill(title);
    await dialog.getByRole("button", { name: "Cleaning" }).click();
    await dialog.getByRole("button", { name: "Every day" }).click();
    await dialog.getByRole("button", { name: "Add time" }).click();
    await dialog.locator('input[type="time"]').fill("08:00");

    await dialog.getByRole("combobox", { name: "Available" }).click();
    await page.getByRole("option", { name: "30 minutes before" }).click();

    await dialog.getByRole("combobox", { name: "Deadline" }).click();
    await page.getByRole("option", { name: "Custom…" }).click();

    const customDeadline = dialog.getByRole("textbox", {
      name: "Custom minutes after the scheduled time",
    });
    await customDeadline.fill("1441");
    await dialog.locator('button[type="submit"]').click();
    await expect(
      dialog.getByText("Enter a value between 0 and 1440 minutes."),
    ).toBeVisible();
    await expect(dialog).toBeVisible();

    await customDeadline.fill("90");
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).toBeHidden();
  });

  test("duplicate scheduled times show a single group error and block submit", async ({
    page,
  }) => {
    const title = `E2E Duplicate ${Date.now()}`;

    await page.locator("main").getByRole("button", { name: "Add" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder("Check walk-in chiller").fill(title);
    await dialog.getByRole("button", { name: "Cleaning" }).click();
    await dialog.getByRole("button", { name: "Every day" }).click();

    const addTimeButton = dialog.getByRole("button", { name: "Add time" });
    await addTimeButton.click();
    await addTimeButton.click();

    const timeInputs = dialog.locator('input[type="time"]');
    await timeInputs.nth(0).fill("08:00");
    await timeInputs.nth(1).fill("08:00");

    const duplicateError = dialog.getByText(
      "Scheduled times must be unique.",
    );
    await expect(duplicateError).toBeVisible();

    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).toBeVisible();

    await timeInputs.nth(1).fill("09:00");
    await expect(duplicateError).toBeHidden();

    await dialog.getByRole("combobox", { name: "Available" }).click();
    await page.getByRole("option", { name: "30 minutes before" }).click();
    await dialog.getByRole("combobox", { name: "Deadline" }).click();
    await page.getByRole("option", { name: "No deadline" }).click();

    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).toBeHidden();
  });
});
