"use client";
import { notFound, useParams } from "next/navigation";
import { ReportViewer } from "@/components/reports/report-viewer";
import { getReport } from "@/lib/reports-config";
export default function ReportPage() {
  const { type } = useParams();
  const config = getReport(type);
  if (!config) notFound();
  return (
    <div className="container mx-auto p-6">
      {/* key resets filters and results when switching between reports */}
      <ReportViewer key={config.slug} config={config} />
    </div>
  );
}
