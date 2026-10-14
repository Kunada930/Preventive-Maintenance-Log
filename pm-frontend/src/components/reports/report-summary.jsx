import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatValue } from "@/lib/report-format";
const TONES = {
  default: "",
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-green-600 dark:text-green-400",
};
export function ReportSummary({ items, data }) {
  // Most reports nest scalars under `summary`; pm-logs returns `total` at the root
  const source = data.summary ?? data;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 print:grid-cols-3">
      {items.map((item) => (
        <Card key={item.key}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold",
                TONES[item.tone ?? "default"],
              )}
            >
              {formatValue(source[item.key], item.format)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
