import type { TodayResponse } from "@haccp/shared";
import { isValidTimeZone } from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { InternalError } from "../../core/errors/app-errors.js";
import { sortItemsByScheduledTime, toTodayTaskItem } from "./today.mapper.js";
import { todayRepository } from "./today.repository.js";

export const todayService = {
  async getToday(
    db: Db,
    locationId: string,
    date: string,
    currentUserId: string,
    timeZone: string,
  ): Promise<TodayResponse> {
    if (!isValidTimeZone(timeZone)) {
      throw new InternalError("Organization timezone configuration is invalid");
    }

    const now = new Date();

    const rows = await todayRepository.findOccurrencesWithRecords(
      db,
      locationId,
      date,
    );

    const sections: TodayResponse["sections"] = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    for (const row of rows) {
      const item = toTodayTaskItem(row, now);
      sections[item.timeSlot].push(item);
    }

    return {
      date,
      locationId,
      currentUserId,
      sections: {
        morning: sortItemsByScheduledTime(sections.morning),
        afternoon: sortItemsByScheduledTime(sections.afternoon),
        evening: sortItemsByScheduledTime(sections.evening),
      },
    };
  },
};
