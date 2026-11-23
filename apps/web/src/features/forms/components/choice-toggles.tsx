"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useFitsOneRow } from "../hooks/use-fits-one-row";

const TOGGLE_BOX = "min-w-20 border px-2.5 text-sm font-medium";

type Props = {
  options: readonly { id: string; label: string }[];
  selected: readonly string[];
  /** Lets several be pressed; otherwise pressing one releases the rest. */
  multiple?: boolean;
  labelledBy?: string;
  ariaLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Shown for an option whose label is still blank in the builder. */
  untitledLabel?: string;
  onChange: (next: string[]) => void;
};

/** One row split equally when every option fits at the widest one's width, otherwise one row each. */
export function ChoiceToggles({
  options,
  selected,
  multiple = false,
  labelledBy,
  ariaLabel,
  invalid = false,
  disabled,
  untitledLabel = "",
  onChange,
}: Props) {
  const labels = options.map((option) => option.label.trim() || untitledLabel);
  const { containerRef, measureRef, fits } = useFitsOneRow(labels.join("\n"), {
    equal: true,
  });

  return (
    <div ref={containerRef} className="relative min-w-0">
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex w-max gap-2"
      >
        {options.map((option, index) => (
          <span
            key={option.id}
            className={cn(TOGGLE_BOX, "inline-flex whitespace-nowrap")}
          >
            {labels[index]}
          </span>
        ))}
      </div>
      <ToggleGroup
        aria-labelledby={labelledBy}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        multiple={multiple}
        disabled={disabled}
        value={[...selected]}
        onValueChange={onChange}
        variant="outline"
        spacing={2}
        orientation={fits ? "horizontal" : "vertical"}
        className={cn("w-full", fits && "grid auto-cols-fr grid-flow-col")}
        data-layout={fits ? "row" : "stacked"}
      >
        {options.map((option, index) => (
          <ToggleGroupItem
            key={option.id}
            value={option.id}
            className={cn(
              TOGGLE_BOX,
              "h-auto min-h-(--control-h) cursor-pointer py-1.5 text-center whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90",
              !option.label.trim() && "text-muted-foreground",
            )}
          >
            {labels[index]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
