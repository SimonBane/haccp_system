import type { TodayResponse } from "@haccp/shared";
import {
  buildTodayTaskItem,
  getWeekdayFromDate,
  isValidTimeZone,
  sortScheduledTimes,
} from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { InternalError } from "../../core/errors/app-errors.js";
import { taskTemplateRepository } from "../task-templates/task-template.repository.js";
import {
  buildCompletionKey,
  sortItemsByScheduledTime,
  toTemplateRow,
} from "./today.mapper.js";
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

    const weekday = getWeekdayFromDate(date);
    const now = new Date();

    const [templateRows, completionRows] = await Promise.all([
      taskTemplateRepository.findManyWithEquipmentByLocationAndWeekday(
        db,
        locationId,
        weekday,
      ),
      todayRepository.findCompletionsWithTemperatureLogs(
        db,
        locationId,
        date,
      ),
    ]);

    const matchingTemplates = templateRows.map(toTemplateRow);
    const completionByKey = todayRepository.buildCompletionMap(completionRows);

    const sections: TodayResponse["sections"] = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    for (const template of matchingTemplates) {
      const times = sortScheduledTimes(template.scheduledTimes);

      for (const scheduledTime of times) {
        const key = buildCompletionKey(template.id, scheduledTime);
        const completion = completionByKey.get(key);

        const temperatureReading =
          template.type === "temperature" && completion?.temperatureLog
            ? {
                recordedC: Number(completion.temperatureLog.recordedC),
                minTempC: Number(completion.temperatureLog.minTempC),
                maxTempC: Number(completion.temperatureLog.maxTempC),
                result: completion.temperatureLog.result as
                  | "ok"
                  | "out_of_range",
                correctiveAction:
                  completion.temperatureLog.correctiveAction ?? null,
              }
            : null;

        const item = buildTodayTaskItem({
          templateId: template.id,
          title: template.title,
          type: template.type,
          equipmentId: template.equipmentId,
          equipmentName: template.equipmentName,
          minTempC: template.minTempC,
          maxTempC: template.maxTempC,
          scheduledTime,
          date,
          completedAt: completion?.completedAt
            ? completion.completedAt.toISOString()
            : null,
          completedBy: completion?.completedBy ?? null,
          temperatureReading,
          now,
          timeZone,
        });

        sections[item.timeSlot].push(item);
      }
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
