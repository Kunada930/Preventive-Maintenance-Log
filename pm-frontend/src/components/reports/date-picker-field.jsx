"use client";

import { format, parseISO, isValid } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// value / onChange use "yyyy-MM-dd" strings, so the report API params stay the same
export function DatePickerField({ label, value, onChange }) {
  // parseISO reads "yyyy-MM-dd" as a local date, so the day can't shift by timezone
  const parsed = value ? parseISO(value) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <div className="flex-1 min-w-[200px]">
      <label className="text-sm font-medium mb-1.5 block">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`w-full justify-start text-left font-normal ${
              !selected && "text-muted-foreground"
            }`}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="flex-1 truncate">
              {selected ? format(selected, "PPP") : "Pick a date"}
            </span>
            {selected && (
              <X
                className="ml-2 h-4 w-4 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            defaultMonth={selected}
            selected={selected}
            onSelect={(date) =>
              onChange(date ? format(date, "yyyy-MM-dd") : "")
            }
            captionLayout="dropdown"
            className="rounded-lg border shadow-sm"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
