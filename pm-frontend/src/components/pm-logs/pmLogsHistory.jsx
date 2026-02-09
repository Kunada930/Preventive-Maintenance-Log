"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { authService } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Eye,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  MapPin,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ViewPMLogDialog from "./viewPmLogDialog";
import AlertDialogComponent from "@/components/AlertDialog";
import { formatPhilippineDateTime } from "@/lib/dateUtils";
import { Separator } from "@/components/ui/separator";

const PMHistoryManagement = () => {
  const searchParams = useSearchParams();
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [limitLogs, setLimitLogs] = useState("10");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [alertDialog, setAlertDialog] = useState({
    open: false,
    title: "",
    description: "",
    variant: "default",
  });

  const showAlert = (title, description, variant = "default") => {
    setAlertDialog({ open: true, title, description, variant });
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  // Handle URL parameters for direct device selection
  useEffect(() => {
    const deviceIdFromUrl = searchParams?.get("deviceId");

    if (deviceIdFromUrl && devices.length > 0 && !selectedDeviceId) {
      const device = devices.find((d) => d.id.toString() === deviceIdFromUrl);
      if (device) {
        setSelectedDeviceId(deviceIdFromUrl);
        handleDeviceSelect(deviceIdFromUrl);
      }
    }
  }, [devices, searchParams]);

  const fetchDevices = async () => {
    try {
      setLoadingDevices(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/devices`,
      );

      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      } else {
        const error = await response.json();
        showAlert(
          "Error",
          error.error || "Failed to fetch devices",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      showAlert(
        "Error",
        "An error occurred while fetching devices",
        "destructive",
      );
    } finally {
      setLoadingDevices(false);
    }
  };

  const fetchDeviceHistory = async (deviceId) => {
    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;

      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/pm-logs/device/${deviceId}?limit=${limitLogs}`,
      );

      if (response.ok) {
        const data = await response.json();
        setHistoryLogs(data.logs || []);
        setSelectedDevice(data.device);
      } else {
        const error = await response.json();
        showAlert(
          "Error",
          error.error || "Failed to fetch device history",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error fetching device history:", error);
      showAlert(
        "Error",
        "An error occurred while fetching device history",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceSelect = (deviceId) => {
    setSelectedDeviceId(deviceId);
    if (deviceId) {
      fetchDeviceHistory(deviceId);
    } else {
      setSelectedDevice(null);
      setHistoryLogs([]);
    }
  };

  const handleViewLog = (log) => {
    setSelectedLog(log);
    setViewDialogOpen(true);
  };

  const handleLimitChange = (newLimit) => {
    setLimitLogs(newLimit);
    if (selectedDevice) {
      fetchDeviceHistory(selectedDevice.id);
    }
  };

  const filteredDevices = devices.filter((device) =>
    `${device.deviceName} ${device.serialNumber} ${device.manufacturer}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );

  const getCompletionPercentage = (log) => {
    if (log.totalTasks === 0) return 0;
    return Math.round((log.checkedTasks / log.totalTasks) * 100);
  };

  const getCompletionColor = (percentage) => {
    if (percentage === 100) return "text-green-600";
    if (percentage >= 80) return "text-blue-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-orange-600";
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>PM History</CardTitle>
          <CardDescription>
            View preventive maintenance history for each device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Device Selection */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Device</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by device name, serial number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Select Device</label>
                <Select
                  value={selectedDeviceId}
                  onValueChange={handleDeviceSelect}
                  disabled={loadingDevices}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a device to view history" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDevices.map((device) => (
                      <SelectItem key={device.id} value={device.id.toString()}>
                        {device.deviceName} - {device.serialNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Device Info Card */}
            {selectedDevice && (
              <>
                <Separator />
                <div className="rounded-lg border p-4 bg-muted/50">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {selectedDevice.deviceName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedDevice.manufacturer}
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {selectedDevice.serialNumber}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Total PM Records:
                        </span>
                        <span className="font-semibold">
                          {historyLogs.length}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Select
                        value={limitLogs}
                        onValueChange={handleLimitChange}
                      >
                        <SelectTrigger className="w-[130px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">Last 5</SelectItem>
                          <SelectItem value="10">Last 10</SelectItem>
                          <SelectItem value="20">Last 20</SelectItem>
                          <SelectItem value="50">Last 50</SelectItem>
                          <SelectItem value="100">Last 100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* History Timeline */}
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
                Loading history...
              </div>
            ) : !selectedDevice ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No Device Selected</p>
                <p className="text-sm mt-1">
                  Select a device to view its maintenance history
                </p>
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No History Found</p>
                <p className="text-sm mt-1">
                  This device has no preventive maintenance records yet
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Separator />
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[29px] top-0 bottom-0 w-0.5 bg-border" />

                  {/* Timeline items */}
                  <div className="space-y-6">
                    {historyLogs.map((log, index) => {
                      const completionPercentage = getCompletionPercentage(log);
                      const isFunctional = log.fullyFunctional === "Yes";

                      return (
                        <div key={log.id} className="relative pl-16">
                          {/* Timeline dot */}
                          <div
                            className={`absolute left-5 top-6 h-5 w-5 rounded-full border-4 border-background ${
                              isFunctional ? "bg-green-500" : "bg-destructive"
                            } z-10`}
                          />

                          {/* Content Card */}
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="pt-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 className="font-semibold text-lg">
                                      {formatPhilippineDateTime(log.date, {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                      })}
                                    </h4>
                                    <Badge
                                      variant={
                                        isFunctional ? "default" : "destructive"
                                      }
                                    >
                                      {isFunctional ? (
                                        <>
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Functional
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="h-3 w-3 mr-1" />
                                          Not Functional
                                        </>
                                      )}
                                    </Badge>
                                  </div>

                                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                      <User className="h-3.5 w-3.5" />
                                      <span>{log.performedBy}</span>
                                    </div>
                                    {log.validatedBy && (
                                      <div className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        <span>
                                          Validated by {log.validatedBy}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewLog(log)}
                                  className="ml-4"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Button>
                              </div>

                              {/* Task Completion */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    Task Completion
                                  </span>
                                  <span
                                    className={`font-semibold ${getCompletionColor(completionPercentage)}`}
                                  >
                                    {log.checkedTasks}/{log.totalTasks} (
                                    {completionPercentage}%)
                                  </span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${
                                      completionPercentage === 100
                                        ? "bg-green-500"
                                        : completionPercentage >= 80
                                          ? "bg-blue-500"
                                          : completionPercentage >= 50
                                            ? "bg-yellow-500"
                                            : "bg-orange-500"
                                    }`}
                                    style={{
                                      width: `${completionPercentage}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Recommendation */}
                              {log.recommendation && (
                                <div className="mt-4 pt-4 border-t">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    Recommendation
                                  </p>
                                  <p className="text-sm line-clamp-2">
                                    {log.recommendation}
                                  </p>
                                </div>
                              )}

                              {/* Findings */}
                              {log.findingsSolutions && (
                                <div className="mt-3">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    Findings & Solutions
                                  </p>
                                  <p className="text-sm line-clamp-2">
                                    {log.findingsSolutions}
                                  </p>
                                </div>
                              )}

                              {/* Timestamp */}
                              <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                                Created:{" "}
                                {formatPhilippineDateTime(log.createdAt, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ViewPMLogDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        log={selectedLog}
      />

      <AlertDialogComponent
        open={alertDialog.open}
        onOpenChange={(open) => setAlertDialog({ ...alertDialog, open })}
        title={alertDialog.title}
        description={alertDialog.description}
        variant={alertDialog.variant}
      />
    </>
  );
};

export default PMHistoryManagement;
