"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  fromYear?: number;
  toYear?: number;
};

function toDate(value?: string) {
  if (!value) return undefined;

  if (/^\d{2}\/\d{2}\/\d{2}$/.test(value)) {
    const parsed = parse(value, "yy/MM/dd", new Date());
    return isValid(parsed) ? parsed : undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? parsed : undefined;
  }

  if (/^\d{6}$/.test(value)) {
    const parsed = parse(value, "yyMMdd", new Date());
    return isValid(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function DatePicker({
  value,
  onChange,
  className,
  placeholder = "请选择日期",
  fromYear,
  toYear,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selectedDate = React.useMemo(() => toDate(value), [value]);
  const currentYear = new Date().getFullYear();
  const startMonth = React.useMemo(
    () => new Date((fromYear ?? currentYear - 10), 0, 1),
    [fromYear, currentYear]
  );
  const endMonth = React.useMemo(
    () => new Date((toYear ?? currentYear + 20), 11, 31),
    [toYear, currentYear]
  );

  const handleSelect = (date?: Date) => {
    if (!date) {
      onChange("");
      return;
    }
    onChange(format(date, "yy/MM/dd"));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "w-full justify-between font-normal",
          !selectedDate && "text-muted-foreground",
          className
        )}
      >
        {selectedDate ? format(selectedDate, "yy/MM/dd") : placeholder}
        <CalendarIcon className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={endMonth}
        />
      </PopoverContent>
    </Popover>
  );
}
