"use client";
import { useState } from "react";
import Link from "next/link";
import { LineChart, ShieldCheck, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { REPORT_GROUPS, REPORTS } from "@/lib/reports-config";

const GROUP_ICONS = {
  Operational: Wrench,
  Management: LineChart,
  Administration: ShieldCheck,
};

export default function ReportsPage() {
  // TODO: if you have an auth context, hide admin-only cards for non-admins:
  //   const { user } = useAuth();
  //   const visible = REPORTS.filter((r) => !r.adminOnly || user?.role === "admin");
  // The backend enforces this anyway (403), so this is only cosmetic.
  const visible = REPORTS;

  // Only show tabs that have at least one report
  const groups = REPORT_GROUPS.filter((g) =>
    visible.some((r) => r.group === g),
  );

  const [activeTab, setActiveTab] = useState(groups[0]);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <PageBreadcrumb />

      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted-foreground">
          Generate, print and export preventive maintenance reports.
        </p>
      </div>

      <Separator />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          {groups.map((group) => {
            const GroupIcon = GROUP_ICONS[group];
            return (
              <TabsTrigger
                key={group}
                value={group}
                className="flex items-center gap-2"
              >
                {GroupIcon && <GroupIcon className="h-4 w-4" />}
                {group}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {groups.map((group) => (
          <TabsContent key={group} value={group} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible
                .filter((r) => r.group === group)
                .map((report) => {
                  const Icon = report.icon;
                  return (
                    <Link key={report.slug} href={`/reports/${report.slug}`}>
                      <Card className="h-full transition-colors hover:bg-accent">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <Icon className="h-6 w-6 text-muted-foreground" />
                            {report.adminOnly && (
                              <Badge variant="secondary">Admin only</Badge>
                            )}
                          </div>
                          <CardTitle className="pt-2 text-base">
                            {report.title}
                          </CardTitle>
                          <CardDescription>
                            {report.description}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </Link>
                  );
                })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
