"use client";
import React, { useState } from "react";
import { Package, ClipboardCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import DeviceManagement from "@/components/devices/DeviceManagement";

export default function DevicesPage() {
  const [activeTab, setActiveTab] = useState("devices");

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageBreadcrumb />

        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Preventive Maintenance Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage device inventory and assign preventive maintenance checklists
            to devices
          </p>
        </div>

        <Separator />

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="devices" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              PM Checklist
            </TabsTrigger>
          </TabsList>

          <TabsContent value="devices" className="space-y-4">
            <DeviceManagement />
          </TabsContent>

          <TabsContent value="checklist" className="space-y-4">
            <div className="text-center py-12 text-muted-foreground">
              PM Checklist coming soon...
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
