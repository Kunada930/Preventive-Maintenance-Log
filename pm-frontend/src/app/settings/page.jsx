"use client";
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import AccountManagement from "@/components/settings/AccountManagement";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("accounts");

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageBreadcrumb />

        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage system settings, user accounts, and view audit trails
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Account Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-4">
            <AccountManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
