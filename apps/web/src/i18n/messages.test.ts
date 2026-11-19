import { describe, expect, it } from "vitest";
import bg from "../../messages/bg.json";
import en from "../../messages/en.json";

type Messages = { [key: string]: string | Messages };

function entries(messages: Messages, prefix = ""): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : entries(value, `${prefix}${key}.`),
  );
}

describe.each([
  ["en", en],
  ["bg", bg],
])("%s messages", (_, messages) => {
  it("contain no em or en dashes", () => {
    const withDashes = entries(messages)
      .filter(([, value]) => /[–—]/.test(value))
      .map(([key]) => key);

    expect(withDashes).toEqual([]);
  });
});

it("en and bg have the same keys", () => {
  const keys = (messages: Messages) =>
    entries(messages)
      .map(([key]) => key)
      .sort();

  expect(keys(bg)).toEqual(keys(en));
});
