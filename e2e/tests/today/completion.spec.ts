import { expect, test } from "@playwright/test";
import { E2E_PREFIX, LOCALE_PREFIX } from "../../support/env.js";
import {
  ensurePending,
  expandGroup,
  occurrenceRow,
  waitForOccurrenceRecord,
} from "../../support/today.js";

test.describe("Today completions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${LOCALE_PREFIX}/dashboard`);
  });

  test("completing a task survives a reload", async ({ page }) => {
    const title = `${E2E_PREFIX} Clean prep surface`;
    // A retry of this same test leaves the task completed from the failed
    // attempt, collapsing its group — reset it so the row is there to click.
    const task = await ensurePending(page, title);
    const target = occurrenceRow(page, task.occurrenceId);

    const posted = waitForOccurrenceRecord(page, task.occurrenceId, "POST");
    await target.getByTestId("today-task-activate").click();
    expect((await posted).status()).toBe(201);
    await expect(target).toHaveAttribute("data-completed", "true");

    // The optimistic patch alone would satisfy the assertion above; only a reload
    // distinguishes a real write, which is the compliance guarantee here.
    await page.reload();
    await expandGroup(page, task.scheduledTime);
    await expect(occurrenceRow(page, task.occurrenceId)).toHaveAttribute(
      "data-completed",
      "true",
    );
  });

  test("recording a temperature survives a reload", async ({ page }) => {
    const title = `${E2E_PREFIX} Fridge check`;
    const task = await ensurePending(page, title);
    const target = occurrenceRow(page, task.occurrenceId);

    await target.getByTestId("today-task-activate").click();

    const reading = page.getByTestId("temperature-reading");
    await expect(reading).toBeVisible();
    const posted = waitForOccurrenceRecord(page, task.occurrenceId, "POST");
    await reading.fill("2");
    await page.getByTestId("temperature-save").click();
    expect((await posted).status()).toBe(201);

    await expect(target).toHaveAttribute("data-completed", "true");

    await page.reload();
    await expandGroup(page, task.scheduledTime);
    await expect(occurrenceRow(page, task.occurrenceId)).toHaveAttribute(
      "data-completed",
      "true",
    );
  });

  test("Undo voids without a reason, then completion reactivates through PUT", async ({
    page,
  }) => {
    const title = `${E2E_PREFIX} Clean prep surface`;
    const task = await ensurePending(page, title);
    const target = occurrenceRow(page, task.occurrenceId);

    const posted = waitForOccurrenceRecord(page, task.occurrenceId, "POST");
    await target.getByTestId("today-task-activate").click();
    expect((await posted).status()).toBe(201);
    await expect(target).toHaveAttribute("data-completed", "true");

    await target.getByTestId("today-task-activate").click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("textbox")).toHaveCount(0);

    const voided = waitForOccurrenceRecord(page, task.occurrenceId, "DELETE");
    await sheet.getByRole("button", { name: "Undo" }).click();
    expect((await voided).status()).toBe(200);
    await expect(target).not.toHaveAttribute("data-completed", "true");

    const reactivated = waitForOccurrenceRecord(page, task.occurrenceId, "PUT");
    await target.getByTestId("today-task-activate").click();
    expect((await reactivated).status()).toBe(200);
    await expect(target).toHaveAttribute("data-completed", "true");
  });
});
