import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-200",
        className
      )}
      {...props}
    />
  );
}
