import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const workflowSteps = [
  "Project Details",
  "Upload Drawings",
  "AI Analysis",
  "Quantities",
  "Materials",
  "Cost & Report",
  "Track Progress",
  "Live IoT Monitor",
];

export function StepIndicator({ current }: { current: number }) {
  return (
    <div className="surface-panel mb-6 px-4 py-4 sm:px-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Step {current} of {workflowSteps.length}
        </p>
        <p className="text-xs font-semibold text-accent">{workflowSteps[current - 1]}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {workflowSteps.map((label, i) => {
          const index = i + 1;
          const done = index < current;
          const active = index === current;
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center gap-1.5">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors",
                    done && "border-transparent bg-success text-success-foreground",
                    active && "border-transparent bg-gradient-accent text-accent-foreground",
                    !done && !active && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : index}
                </div>
                {index < workflowSteps.length ? (
                  <div
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      done ? "bg-success" : "bg-muted",
                    )}
                  />
                ) : null}
              </div>
              <span className="hidden text-[10px] font-medium text-muted-foreground sm:block">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
