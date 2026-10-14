"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/reports-api";
import { formatValue } from "@/lib/report-format";
function Field({ label, value }) {
  return (
    <div className="flex gap-2 border-b py-1.5 text-sm">
      <span className="w-40 shrink-0 font-medium">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}
function Signature({ label, name }) {
  return (
    <div className="space-y-1 text-center text-sm">
      <div className="flex h-16 items-end justify-center border-b border-black">
        <span className="pb-1 font-medium">{name ?? ""}</span>
      </div>
      <p className="font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">
        Signature over printed name
      </p>
    </div>
  );
}
export default function PMLogReportPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    apiFetch(`/api/reports/pm-log/${id}`)
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load PM log"),
      );
  }, [id]);
  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-6 print:max-w-none print:p-0">
      {/* Screen controls */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/reports/pm-logs"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to PM logs
        </Link>
        {data && (
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print / Save as PDF
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!data && !error && <Skeleton className="h-[600px]" />}

      {data && (
        <div className="space-y-6 rounded-md border bg-white p-8 text-black print:border-0 print:p-0">
          {/* Header */}
          <div className="border-b-2 border-black pb-3 text-center">
            <h1 className="text-xl font-bold uppercase tracking-wide">
              Preventive Maintenance Log
            </h1>
            <p className="text-sm">Data Center</p>
            <p className="mt-1 text-xs">
              Report No. PM-{String(data.log.id).padStart(5, "0")}
            </p>
          </div>

          {/* Device information */}
          <section>
            <h2 className="mb-1 text-sm font-bold uppercase">
              Device Information
            </h2>
            <div className="grid gap-x-8 md:grid-cols-2 print:grid-cols-2">
              <Field label="Device Name" value={data.device.deviceName} />
              <Field
                label="Date of PM"
                value={formatValue(data.log.date, "date")}
              />
              <Field label="Serial Number" value={data.device.serialNumber} />
              <Field label="Device ID" value={data.device.deviceCode} />
              <Field label="Manufacturer" value={data.device.manufacturer} />
              <Field label="Location" value={data.device.location} />
              <Field
                label="Date Purchased"
                value={formatValue(data.device.datePurchased, "date")}
              />
              <Field
                label="Responsible Person"
                value={data.device.responsiblePerson}
              />
            </div>
          </section>

          {/* Description of work */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase">Description of Work</h2>

            {data.tasksByType.length === 0 && (
              <p className="text-sm italic">
                No tasks were recorded for this PM.
              </p>
            )}

            {data.tasksByType.map((group) => (
              <div
                key={group.maintenanceType}
                className="break-inside-avoid border"
              >
                <div className="flex justify-between bg-gray-100 px-3 py-1.5 text-sm font-semibold">
                  <span>{group.maintenanceType}</span>
                  <span className="font-normal">
                    {group.checked}/{group.total} done
                  </span>
                </div>
                <ul className="divide-y">
                  {group.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-start gap-2 px-3 py-1.5 text-sm"
                    >
                      <span className="font-mono">
                        {task.isChecked ? "☑" : "☐"}
                      </span>
                      <span>{task.taskDescription}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <p className="text-right text-xs">
              Tasks completed: {data.summary.checkedTasks} of{" "}
              {data.summary.totalTasks} ({data.summary.completionRate}%)
            </p>
          </section>

          {/* Result */}
          <section className="space-y-3">
            <div className="flex items-center gap-6 text-sm">
              <span className="font-bold uppercase">Fully Functional:</span>
              <span className="font-mono">
                {data.log.fullyFunctional === "Yes" ? "☑" : "☐"} Yes
              </span>
              <span className="font-mono">
                {data.log.fullyFunctional === "No" ? "☑" : "☐"} No
              </span>
            </div>

            <div className="break-inside-avoid">
              <h3 className="text-sm font-bold uppercase">
                Findings / Solutions
              </h3>
              <div className="min-h-20 whitespace-pre-wrap border p-2 text-sm">
                {data.log.findingsSolutions || "—"}
              </div>
            </div>

            <div className="break-inside-avoid">
              <h3 className="text-sm font-bold uppercase">Recommendation</h3>
              <div className="min-h-16 whitespace-pre-wrap border p-2 text-sm">
                {data.log.recommendation || "—"}
              </div>
            </div>
          </section>

          {/* Signatures */}
          <section className="grid gap-8 pt-6 md:grid-cols-3 print:grid-cols-3 break-inside-avoid">
            <Signature label="Performed By" name={data.log.performedBy} />
            <Signature label="Validated By" name={data.log.validatedBy} />
            <Signature label="Acknowledged By" name={data.log.acknowledgedBy} />
          </section>

          <p className="border-t pt-2 text-xs text-gray-500">
            Generated {formatValue(data.report.generatedAt, "datetime")} by{" "}
            {data.report.generatedBy}
          </p>
        </div>
      )}
    </div>
  );
}
