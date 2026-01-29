"use client";
import React, { useState } from "react";
import { Package, ClipboardCheck, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import PMLogManagement from "@/components/pm-logs/pmLogManagement";

export default function PreventiveMaintenancePage() {
  const [activeTab, setActiveTab] = useState("logs");

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageBreadcrumb />

        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Preventive Maintenance Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage preventive maintenance tasks and view PM logs here.
          </p>
        </div>

        <Separator />

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              PM Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-4">
            <PMLogManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
