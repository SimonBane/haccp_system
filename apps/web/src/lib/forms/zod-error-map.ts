"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { $ZodErrorMap } from "zod/v4/core";

/**
 * Localises structural zod issues. Zod 4 ranks this map below schema messages;
 * custom issues match on `params.rule`.
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
