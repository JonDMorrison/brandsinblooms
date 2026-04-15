import * as React from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui-legacy/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout,
  navLayout,
  fromYear,
  toYear,
  hideNavigation,
  ...props
}: CalendarProps) {
  const now = new Date();
  const defaultFromYear = now.getFullYear() - 100;
  const defaultToYear = now.getFullYear() + 10;

  const resolvedCaptionLayout = captionLayout ?? "dropdown";
  const isDropdownCaption =
    resolvedCaptionLayout === "dropdown" ||
    resolvedCaptionLayout === "dropdown-months" ||
    resolvedCaptionLayout === "dropdown-years";

  const resolvedHideNavigation = hideNavigation ?? true;
  const resolvedNavLayout =
    navLayout ??
    (resolvedCaptionLayout === "label" && resolvedHideNavigation === false
      ? "after"
      : navLayout);

  const useRightCaptionNavLayout =
    resolvedCaptionLayout === "label" &&
    resolvedHideNavigation === false &&
    resolvedNavLayout === "after";

  const monthClassName = useRightCaptionNavLayout
    ? "grid grid-cols-[1fr_auto] gap-y-4"
    : "space-y-4";

  const monthCaptionClassName = useRightCaptionNavLayout
    ? "col-start-1 row-start-1 flex items-center justify-start gap-2 pt-1"
    : "flex justify-center pt-1 relative items-center";
  const captionLabelClassName = useRightCaptionNavLayout
    ? "text-sm font-medium text-left"
    : "text-sm font-medium";
  const navClassName = useRightCaptionNavLayout
    ? "col-start-2 row-start-1 flex items-center justify-end gap-1"
    : "space-x-1 flex items-center";
  const previousButtonClassName = useRightCaptionNavLayout
    ? "static opacity-80 hover:opacity-100"
    : cn(
        buttonVariants({ variant: "outline" }),
        "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-4",
      );
  const nextButtonClassName = useRightCaptionNavLayout
    ? "static opacity-80 hover:opacity-100"
    : cn(
        buttonVariants({ variant: "outline" }),
        "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-4",
      );

  const monthGridClassName = useRightCaptionNavLayout
    ? "col-span-2 w-full border-collapse space-y-1"
    : "w-full border-collapse space-y-1";

  const weekdaysClassName = useRightCaptionNavLayout
    ? "grid grid-cols-7"
    : "flex";
  const weekdayClassName = useRightCaptionNavLayout
    ? "text-muted-foreground rounded-md w-full text-center font-normal text-[0.8rem]"
    : "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]";
  const weekClassName = useRightCaptionNavLayout
    ? "grid grid-cols-7 w-full mt-2"
    : "flex w-full mt-2";
  const dayClassName = useRightCaptionNavLayout
    ? "p-0 relative text-center text-sm [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20"
    : "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20";
  const dayButtonClassName = useRightCaptionNavLayout
    ? cn(
        buttonVariants({ variant: "ghost" }),
        "w-full aspect-square p-0 font-normal aria-selected:opacity-100",
      )
    : cn(
        buttonVariants({ variant: "ghost" }),
        "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
      );

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={resolvedCaptionLayout}
      navLayout={resolvedNavLayout}
      fromYear={isDropdownCaption ? (fromYear ?? defaultFromYear) : fromYear}
      toYear={isDropdownCaption ? (toYear ?? defaultToYear) : toYear}
      hideNavigation={resolvedHideNavigation}
      className={cn("w-full p-3 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: monthClassName,
        month_caption: monthCaptionClassName,
        caption_label: captionLabelClassName,
        nav: navClassName,
        button_previous: previousButtonClassName,
        button_next: nextButtonClassName,
        month_grid: monthGridClassName,
        weekdays: weekdaysClassName,
        weekday: weekdayClassName,
        week: weekClassName,
        day: dayClassName,
        day_button: dayButtonClassName,
        range_end: "day-range-end",
        selected:
          "box-border rounded-md border border-[hsl(var(--brand-teal))] bg-[hsl(var(--brand-teal)/0.35)] text-foreground hover:bg-[hsl(var(--brand-teal)/0.35)] focus:bg-[hsl(var(--brand-teal)/0.35)]",
        today:
          "box-border rounded-md border border-blue-400 bg-blue-500/50 text-accent-foreground",
        outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (useRightCaptionNavLayout) {
            return orientation === "left" ? (
              <ArrowLeft className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            );
          }
          if (orientation === "left") {
            return <ChevronLeft className="h-4 w-4" />;
          }
          return <ChevronRight className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
