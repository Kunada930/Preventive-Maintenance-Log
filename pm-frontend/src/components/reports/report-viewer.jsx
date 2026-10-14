"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/reports-api";
import { formatValue, todayLocal } from "@/lib/report-format";
import { ReportCharts } from "./report-charts";
import { ReportFilters } from "./report-filters";
import { ReportSummary } from "./report-summary";
import { ReportTable } from "./report-table";
const PAGE_SIZE = 50;
export function ReportViewer({ config }) {
  const [filters, setFilters] = useState({});
  const [options, setOptions] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  // Always run with the latest filters, even when called from an effect
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  async function run(nextPage = 1) {
    const current = filtersRef.current;
    if (config.filters.some((f) => f.required && !current[f.key])) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch(config.path(current), {
        ...current,
        page: config.paginated ? nextPage : undefined,
        limit: config.paginated ? PAGE_SIZE : undefined,
      });
      setData(result);
      setPage(nextPage);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }
  // Load dropdown options once, and auto-run reports that need no required filter
  useEffect(() => {
    apiFetch("/api/reports/filter-options")
      .then(setOptions)
      .catch(() => setOptions(null));
    if (!config.filters.some((f) => f.required)) run(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const meta = data?.report;
  const pagination = data?.pagination;
  const Icon = config.icon;
  return (
    <div className="space-y-6">
      {/* Screen header */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <Link
            href="/reports"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            All reports
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Icon className="h-6 w-6" />
            {config.title}
          </h1>
          <p className="text-muted-foreground">{config.description}</p>
        </div>

        {data && (
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        )}
      </div>

      {/* Print-only header */}
      <div className="hidden border-b pb-3 print:block">
        <h1 className="text-xl font-semibold">{config.title}</h1>
        <p className="text-sm">
          Generated{" "}
          {formatValue(
            meta?.generatedAt ?? new Date().toISOString(),
            "datetime",
          )}
          {meta?.generatedBy ? ` by ${meta.generatedBy}` : ""}
        </p>
      </div>

      <ReportFilters
        defs={config.filters}
        values={filters}
        options={options}
        loading={loading}
        onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
        onRun={() => run(1)}
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      )}

      {data && !loading && (
        <>
          {meta && (
            <p className="text-sm text-muted-foreground">
              Generated {formatValue(meta.generatedAt, "datetime")} by{" "}
              {meta.generatedBy}
              {Object.keys(meta.filters ?? {}).length > 0 && (
                <>
                  {" · "}
                  {Object.entries(meta.filters)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ")}
                </>
              )}
            </p>
          )}

          <ReportSummary items={config.summary} data={data} />

          {config.charts && config.charts.length > 0 && (
            <ReportCharts charts={config.charts} data={data} />
          )}

          {config.tables.map((table) => (
            <ReportTable
              key={table.key}
              def={table}
              rows={data[table.key] ?? []}
              filename={`${config.slug}-${table.key}-${todayLocal()}.csv`}
            />
          ))}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between print:hidden">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ·{" "}
                {pagination.total.toLocaleString()} entries
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => run(page - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => run(page + 1)}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
