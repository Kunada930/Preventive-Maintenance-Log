"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const PALETTE = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#f59e0b",
  "#7c3aed",
  "#0891b2",
];

function PieBody({ chart, data }) {
  const colors = chart.colors ?? PALETTE;
  const rows = chart.getData(data) ?? [];

  // Keys are index-based because labels like "Due Soon" aren't valid CSS variable names
  const slices = rows.map((r, i) => ({
    key: `slice${i}`,
    name: r.name,
    value: Number(r.value) || 0,
    fill: `var(--color-slice${i})`,
  }));

  const visible = slices.filter((s) => s.value > 0);
  if (visible.length === 0) return null;

  const config = Object.fromEntries(
    slices.map((s, i) => [
      s.key,
      { label: s.name, color: colors[i % colors.length] },
    ]),
  );

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent hideLabel nameKey="key" />}
        />
        <Pie
          data={visible}
          dataKey="value"
          nameKey="key"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        />
        <ChartLegend content={<ChartLegendContent nameKey="key" />} />
      </PieChart>
    </ChartContainer>
  );
}

function BarBody({ chart, data }) {
  const rows = chart.getData(data) ?? [];
  const series = chart.series ?? [];

  if (rows.length === 0) return null;

  const config = Object.fromEntries(
    series.map((s, i) => [
      s.key,
      { label: s.label, color: s.color ?? PALETTE[i % PALETTE.length] },
    ]),
  );

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={rows} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={chart.xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={12}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={32}
          fontSize={12}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={`var(--color-${s.key})`}
            radius={4}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

function ChartCard({ chart, data }) {
  const body =
    chart.type === "pie" ? (
      <PieBody chart={chart} data={data} />
    ) : (
      <BarBody chart={chart} data={data} />
    );

  return (
    <Card className="print:break-inside-avoid print:shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {body ?? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No data for the selected filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportCharts({ charts, data }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
      {charts.map((chart) => (
        <ChartCard key={chart.title} chart={chart} data={data} />
      ))}
    </div>
  );
}
