"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Shield,
  Wrench,
  Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { authService } from "@/lib/auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://172.16.21.12:4000/api";

export default function PublicPMHistoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [pmLogs, setPmLogs] = useState([]);
  const [expandedLogs, setExpandedLogs] = useState(new Set([0]));

  useEffect(() => {
    if (!token) {
      setError("No access token provided");
      setLoading(false);
      return;
    }

    validateAndLoadData();
  }, [token]);

  const validateAndLoadData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("API_URL:", API_URL);
      console.log("Token:", token);
      console.log("Full URL:", `${API_URL}/api/qr-tokens/validate/${token}`);

      const validateResponse = await fetch(
        `${API_URL}/api/qr-tokens/validate/${token}`,
      );
      console.log("Response status:", validateResponse.status);
      console.log("Response headers:", validateResponse.headers);

      const validateData = await validateResponse.json();

      if (!validateResponse.ok) {
        throw new Error(validateData.error || "Invalid or expired QR code");
      }

      // Store QR token in session
      authService.setQRToken(token);

      // Step 2: Load device info and PM logs
      const deviceId = validateData.deviceId;
      const logsResponse = await fetch(
        `${API_URL}/api/pm-logs/device/${deviceId}?qrToken=${token}&limit=50`,
      );
      const logsData = await logsResponse.json();

      if (!logsResponse.ok) {
        throw new Error(logsData.error || "Failed to load PM history");
      }

      setDeviceInfo(logsData.device);
      setPmLogs(logsData.logs);
    } catch (err) {
      console.error("Error loading PM history:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleLogExpansion = (index) => {
    setExpandedLogs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getMaintenanceIcon = (type) => {
    const icons = {
      "Hardware Maintenance": Wrench,
      "Software Maintenance": FileText,
      "Storage Maintenance": Package,
      "Network and Connectivity": Shield,
      "Power Source": AlertCircle,
      "Performance and Optimization": CheckCircle2,
    };
    return icons[type] || Wrench;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Loading PM history...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Access Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              This QR code may be invalid, expired, or the link may be
              incorrect. Please request a new QR code from the administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-6 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">PM History</h1>
          <p className="text-sm opacity-90">Preventive Maintenance Records</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Device Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Device Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Device Name</p>
                <p className="font-semibold">{deviceInfo?.deviceName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Serial Number</p>
                <p className="font-semibold">{deviceInfo?.serialNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Manufacturer</p>
                <p className="font-semibold">{deviceInfo?.manufacturer}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-semibold">{deviceInfo?.location}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">
                  {pmLogs.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total Records
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">
                  {pmLogs.filter((log) => log.fullyFunctional === "Yes").length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Functional</p>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-600">
                  {pmLogs.filter((log) => log.fullyFunctional === "No").length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Issues Found
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PM Logs */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold px-1">Maintenance History</h2>

          {pmLogs.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  No maintenance records found
                </p>
              </CardContent>
            </Card>
          ) : (
            pmLogs.map((log, index) => (
              <PMLogCard
                key={log.id}
                log={log}
                index={index}
                isExpanded={expandedLogs.has(index)}
                onToggle={() => toggleLogExpansion(index)}
                formatDate={formatDate}
                getMaintenanceIcon={getMaintenanceIcon}
                token={token}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>Read-only access via QR code</p>
        </div>
      </div>
    </div>
  );
}

// PMLogCard component stays the same...
function PMLogCard({
  log,
  index,
  isExpanded,
  onToggle,
  formatDate,
  getMaintenanceIcon,
  token,
}) {
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksByType, setTasksByType] = useState({});

  useEffect(() => {
    if (isExpanded && tasks.length === 0) {
      loadTasks();
    }
  }, [isExpanded]);

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const response = await fetch(
        `${API_URL}/api/pm-logs/${log.id}?qrToken=${token}`,
      );
      const data = await response.json();

      if (response.ok) {
        setTasks(data.tasks || []);
        setTasksByType(data.tasksByType || {});
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const completionRate =
    log.totalTasks > 0
      ? Math.round((log.checkedTasks / log.totalTasks) * 100)
      : 0;

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-semibold">{formatDate(log.date)}</span>
                <Badge
                  variant={
                    log.fullyFunctional === "Yes" ? "default" : "destructive"
                  }
                  className="ml-auto"
                >
                  {log.fullyFunctional === "Yes" ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Functional
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      Issue
                    </>
                  )}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate">{log.performedBy}</span>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          {/* Progress Bar */}
          {log.totalTasks > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Tasks Completed</span>
                <span className="font-medium">
                  {log.checkedTasks}/{log.totalTasks} ({completionRate}%)
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
            </div>
          )}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <Separator />

            {/* Additional Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {log.validatedBy && (
                <div>
                  <p className="text-xs text-muted-foreground">Validated By</p>
                  <p className="font-medium">{log.validatedBy}</p>
                </div>
              )}
              {log.acknowledgedBy && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    Acknowledged By
                  </p>
                  <p className="font-medium">{log.acknowledgedBy}</p>
                </div>
              )}
            </div>

            {/* Recommendation */}
            {log.recommendation && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Recommendation
                </p>
                <p className="text-sm bg-muted p-3 rounded-md">
                  {log.recommendation}
                </p>
              </div>
            )}

            {/* Findings & Solutions */}
            {log.findingsSolutions && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Findings & Solutions
                </p>
                <p className="text-sm bg-muted p-3 rounded-md">
                  {log.findingsSolutions}
                </p>
              </div>
            )}

            {/* Tasks by Type */}
            {loadingTasks ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(tasksByType).map(([type, typeTasks]) => {
                  const Icon = getMaintenanceIcon(type);
                  const checkedCount = typeTasks.filter(
                    (t) => t.isChecked,
                  ).length;

                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="h-4 w-4 text-primary" />
                        <span>{type}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {checkedCount}/{typeTasks.length}
                        </span>
                      </div>
                      <div className="space-y-1 pl-6">
                        {typeTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-start gap-2 text-sm"
                          >
                            {task.isChecked ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            )}
                            <span
                              className={
                                task.isChecked
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              }
                            >
                              {task.taskDescription}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
