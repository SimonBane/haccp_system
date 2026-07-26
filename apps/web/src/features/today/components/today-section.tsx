"use client";

import type { TodayTaskItem } from "@haccp/shared";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TodayTaskCard } from "./today-task-card";
import type { TodayUiBucket } from "../lib/today-grouping";
import { occurrenceKey } from "../lib/today-grouping";

type Props = {
  title: string;
  count: number;
  bucket: TodayUiBucket;
  tasks: TodayTaskItem[];
  now: Date;
  pendingKey: string | null;
  currentUserId: string | null;
  defaultOpen?: boolean;
  onComplete: (task: TodayTaskItem) => void;
  onUndo: (task: TodayTaskItem) => void;
  onRecordTemperature: (task: TodayTaskItem) => void;
};

export function TodaySection({
  title,
  count,
  bucket,
  tasks,
  now,
  pendingKey,
  currentUserId,
  defaultOpen = true,
  onComplete,
  onUndo,
  onRecordTemperature,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const isCompleted = bucket === "completed";

  const heading = (
    <div className="flex flex-1 items-center justify-between gap-3">
      <h2
        id={`today-section-${bucket}`}
        className="text-sm font-semibold tracking-tight sm:text-base"
      >
        {title}
      </h2>
      <Badge
        variant="secondary"
        className="h-6 min-w-6 px-1.5 tabular-nums text-muted-foreground"
      >
        {count}
      </Badge>
    </div>
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section
        className="space-y-2.5"
        aria-labelledby={`today-section-${bucket}`}
      >
        {isCompleted ? (
          <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            {heading}
            <ChevronDownIcon
              className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-180"
              aria-hidden
            />
          </CollapsibleTrigger>
        ) : (
          <div className="flex items-center gap-2 py-1">{heading}</div>
        )}
        <Separator />
        <CollapsibleContent>
          <ul className="space-y-3 pt-0.5">
            {tasks.map((task) => (
              <li key={occurrenceKey(task)}>
                <TodayTaskCard
                  task={task}
                  bucket={bucket}
                  now={now}
                  isPending={pendingKey === occurrenceKey(task)}
                  currentUserId={currentUserId}
                  onComplete={onComplete}
                  onUndo={onUndo}
                  onRecordTemperature={onRecordTemperature}
                />
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
