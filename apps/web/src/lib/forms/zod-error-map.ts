"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { $ZodErrorMap } from "zod/v4/core";

/**
 * Localises the zod issues a form does not spell out itself.
 *
 * Every form writes its own message for the fields it cares about, but the
 * structural constraints — `.max(100)`, `.max(256)`, `z.email()` — fall through
 * to zod's built-in English ("Too big: expected string to have <=100
 * characters"). In a Bulgarian-default product that is a user-visible bug.
 *
 * This is purely additive. Zod 4 ranks a per-parse `error` map *below* any
 * message set on the schema or the issue, so every existing translated message
 * still wins, and returning `undefined` falls through to zod's default. Custom
 * issues are matched on `params.rule` rather than on their text, which is why
 * the shared schemas tag the ones a form should translate.
 */
/**
 * Rule tags a shared schema may attach to a custom issue. Explicit rather than
 * an open string so adding one on the schema side without a translation is a
 * type error rather than a message that silently reads "Invalid input".
 */
const CUSTOM_RULE_KEYS = ["locationsRequired"] as const;
type CustomRuleKey = (typeof CUSTOM_RULE_KEYS)[number];

function asCustomRule(value: unknown): CustomRuleKey | null {
  return CUSTOM_RULE_KEYS.includes(value as CustomRuleKey)
    ? (value as CustomRuleKey)
    : null;
}

export function useZodErrorMap(): $ZodErrorMap {
  const t = useTranslations("Validation");

  return useMemo<$ZodErrorMap>(
    () => (issue) => {
      if (issue.code === "custom") {
        const rule = asCustomRule(
          (issue as { params?: { rule?: unknown } }).params?.rule,
        );
        return rule ? t(rule) : undefined;
      }

      switch (issue.code) {
        case "too_small":
          return Number(issue.minimum) <= 1
            ? t("required")
            : t("tooShort", { min: Number(issue.minimum) });
        case "too_big":
          return t("tooLong", { max: Number(issue.maximum) });
        case "invalid_format":
          return issue.format === "email" ? t("emailInvalid") : undefined;
        default:
          return undefined;
      }
    },
    [t],
  );
}
