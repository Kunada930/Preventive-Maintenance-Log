"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from "./date-picker-field";

// shadcn's Select can't use "" as an item value, so "All" uses a sentinel
const ALL = "__all__";

// def.options is either an array (["Yes", "No"]) or a key into `options`
// ("devices", "locations", ...), which comes from /api/reports/filter-options.
// Items can be strings, { value, label }, { id, name } or { id, deviceName }.
function normalizeOptions(defOptions, options) {
  const list = Array.isArray(defOptions)
    ? defOptions
    : (options?.[defOptions] ?? []);
  return list.map((o) => {
    if (typeof o === "string" || typeof o === "number") {
      return { value: String(o), label: String(o) };
    }
    const value = String(o.value ?? o.id ?? o.name);
    const label = o.label ?? o.name ?? o.deviceName ?? value;
    return { value, label: String(label) };
  });
}

function Field({ def, children }) {
  return (
    <div className="flex-1 min-w-[200px]">
      <label className="text-sm font-medium mb-1.5 block">
        {def.label}
        {def.required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}

export function ReportFilters({
  defs,
  values,
  options,
  loading,
  onChange,
  onRun,
}) {
  const missingRequired = defs.some((d) => d.required && !values[d.key]);

  return (
    <div className="flex flex-wrap items-end gap-4 print:hidden">
      {defs.map((def) => {
        const value = values[def.key] ?? "";
        const set = (v) => onChange(def.key, v);

        if (def.type === "date") {
          return (
            <DatePickerField
              key={def.key}
              label={def.label}
              required={def.required}
              value={value}
              onChange={set}
            />
          );
        }

        if (def.type === "select") {
          const items = normalizeOptions(def.options, options);
          return (
            <Field key={def.key} def={def}>
              <Select
                value={value || (def.required ? undefined : ALL)}
                onValueChange={(v) => set(v === ALL ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={def.required ? "Select..." : "All"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {!def.required && <SelectItem value={ALL}>All</SelectItem>}
                  {items.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          );
        }

        return (
          <Field key={def.key} def={def}>
            <Input
              value={value}
              placeholder={def.placeholder}
              onChange={(e) => set(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !missingRequired && !loading) onRun();
              }}
            />
          </Field>
        );
      })}

      <Button
        onClick={onRun}
        disabled={loading || missingRequired}
        className="mb-0.5"
      >
        <Search className="mr-2 h-4 w-4" />
        {loading ? "Running..." : "Run report"}
      </Button>
    </div>
  );
}
