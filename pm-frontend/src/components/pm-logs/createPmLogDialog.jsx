"use client";
import { useState, useEffect } from "react";
import { authService } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AlertDialogComponent from "@/components/AlertDialog";

export default function CreatePMLogDialog({ open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [tasksByType, setTasksByType] = useState({});
  const [date, setDate] = useState(new Date());
  const [formData, setFormData] = useState({
    deviceId: "",
    date: new Date().toISOString().split("T")[0],
    fullyFunctional: "",
    recommendation: "",
    performedBy: "",
    validatedBy: "",
    acknowledgedBy: "",
    findingsSolutions: "",
  });
  const [errors, setErrors] = useState({});
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
    if (open) {
      fetchDevices();
    }
  }, [open]);

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
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      showAlert("Error", "Failed to load devices", "destructive");
    } finally {
      setLoadingDevices(false);
    }
  };

  const fetchDeviceTasks = async (deviceId) => {
    try {
      setLoadingTasks(true);
      setTasksByType({}); // Clear previous tasks

      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/pm-checklists?deviceId=${deviceId}`,
      );

      if (response.ok) {
        const data = await response.json();
        const checklists = data.checklists || [];

        if (checklists.length === 0) {
          showAlert(
            "No Checklists",
            "This device has no PM checklists configured. Please create a checklist first.",
            "default",
          );
          setLoadingTasks(false);
          return;
        }

        // Fetch tasks for all checklists
        const allTasks = {};
        for (const checklist of checklists) {
          const taskResponse = await authService.fetchWithAuth(
            `${baseUrl}/api/pm-checklists/${checklist.id}`,
          );

          if (taskResponse.ok) {
            const taskData = await taskResponse.json();
            const tasks = taskData.tasks || [];
            const type = checklist.maintenanceType;

            if (!allTasks[type]) {
              allTasks[type] = [];
            }
            // Add tasks with their descriptions
            allTasks[type] = [
              ...allTasks[type],
              ...tasks.map((task) => ({
                taskDescription: task.taskDescription,
                maintenanceType: type,
              })),
            ];
          }
        }

        setTasksByType(allTasks);
      }
    } catch (error) {
      console.error("Error fetching device tasks:", error);
      showAlert("Error", "Failed to load device tasks", "destructive");
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleDeviceChange = (deviceId) => {
    const device = devices.find((d) => d.id.toString() === deviceId);
    setSelectedDevice(device);
    setFormData((prev) => ({ ...prev, deviceId }));

    if (errors.deviceId) {
      setErrors((prev) => ({ ...prev, deviceId: "" }));
    }

    // Fetch tasks for selected device
    if (deviceId) {
      fetchDeviceTasks(deviceId);
    } else {
      setTasksByType({});
    }
  };

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleDateChange = (selectedDate) => {
    setDate(selectedDate);
    setFormData((prev) => ({
      ...prev,
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
    }));
    if (errors.date) {
      setErrors((prev) => ({ ...prev, date: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.deviceId) {
      newErrors.deviceId = "Device is required";
    }

    if (!formData.date) {
      newErrors.date = "Date is required";
    }

    if (!formData.fullyFunctional) {
      newErrors.fullyFunctional = "Status is required";
    }

    if (!formData.performedBy?.trim()) {
      newErrors.performedBy = "Performed by is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/pm-logs`,
        {
          method: "POST",
          body: JSON.stringify({
            deviceId: parseInt(formData.deviceId),
            date: formData.date,
            fullyFunctional: formData.fullyFunctional,
            recommendation: formData.recommendation || null,
            performedBy: formData.performedBy,
            validatedBy: formData.validatedBy || null,
            acknowledgedBy: formData.acknowledgedBy || null,
            findingsSolutions: formData.findingsSolutions || null,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        showAlert(
          "Success",
          `PM log created successfully with ${data.tasksCreated} tasks`,
          "default",
        );
        setFormData({
          deviceId: "",
          date: new Date().toISOString().split("T")[0],
          fullyFunctional: "",
          recommendation: "",
          performedBy: "",
          validatedBy: "",
          acknowledgedBy: "",
          findingsSolutions: "",
        });
        setDate(new Date());
        setSelectedDevice(null);
        setTasksByType({});
        setErrors({});
        onSuccess?.();
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        showAlert(
          "Error",
          data.error || "Failed to create PM log",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Create PM log error:", error);
      showAlert(
        "Error",
        "An error occurred while creating PM log",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen) => {
    if (!loading) {
      if (!newOpen) {
        setFormData({
          deviceId: "",
          date: new Date().toISOString().split("T")[0],
          fullyFunctional: "",
          recommendation: "",
          performedBy: "",
          validatedBy: "",
          acknowledgedBy: "",
          findingsSolutions: "",
        });
        setDate(new Date());
        setSelectedDevice(null);
        setTasksByType({});
        setErrors({});
      }
      onOpenChange(newOpen);
    }
  };

  const getTotalTaskCount = () => {
    return Object.values(tasksByType).reduce(
      (total, tasks) => total + tasks.length,
      0,
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Create PM Log</DialogTitle>
            <DialogDescription>
              Record a preventive maintenance execution for a device. Tasks will
              be automatically loaded from the device&apos;s checklists.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Device Selection */}
              <div className="grid gap-2">
                <Label htmlFor="device">
                  Device <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.deviceId}
                  onValueChange={handleDeviceChange}
                  disabled={loadingDevices}
                >
                  <SelectTrigger
                    className={errors.deviceId ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select a device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.id} value={device.id.toString()}>
                        {device.deviceName} - {device.serialNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.deviceId && (
                  <p className="text-sm text-destructive">{errors.deviceId}</p>
                )}
              </div>

              {/* Device Details */}
              {selectedDevice && (
                <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
                  <h4 className="font-semibold text-sm">Device Details</h4>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        Serial Number:
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {selectedDevice.serialNumber}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Device ID:</span>
                      <Badge variant="outline" className="ml-2">
                        {selectedDevice.deviceId}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Manufacturer:
                      </span>
                      <span className="ml-2">
                        {selectedDevice.manufacturer}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Location:</span>
                      <span className="ml-2">{selectedDevice.location}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">
                        Responsible:
                      </span>
                      <span className="ml-2">
                        {selectedDevice.responsiblePerson}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tasks Preview */}
              {selectedDevice && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm">
                        Tasks to be Created ({getTotalTaskCount()} tasks)
                      </h4>
                      {loadingTasks && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>

                    {loadingTasks ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Loading tasks...
                      </div>
                    ) : Object.keys(tasksByType).length === 0 ? (
                      <div className="rounded-lg border p-4 bg-muted/30 text-center">
                        <p className="text-sm text-muted-foreground">
                          No checklists found for this device. Please create a
                          checklist first.
                        </p>
                      </div>
                    ) : (
                      <Accordion
                        type="multiple"
                        className="w-full"
                        defaultValue={Object.keys(tasksByType)}
                      >
                        {Object.entries(tasksByType).map(
                          ([type, tasks], index) => (
                            <AccordionItem key={type} value={type}>
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center justify-between w-full pr-4">
                                  <span className="font-medium text-sm">
                                    {type}
                                  </span>
                                  <Badge variant="outline">
                                    {tasks.length}{" "}
                                    {tasks.length === 1 ? "task" : "tasks"}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2 pt-2">
                                  {tasks.map((task, taskIndex) => (
                                    <div
                                      key={taskIndex}
                                      className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                                    >
                                      <span className="text-xs font-semibold text-muted-foreground mt-0.5">
                                        {taskIndex + 1}.
                                      </span>
                                      <p className="text-sm flex-1">
                                        {task.taskDescription}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ),
                        )}
                      </Accordion>
                    )}
                  </div>
                </>
              )}

              <Separator />

              {/* Date and Device Status — aligned side by side */}
              <div className="grid grid-cols-2 gap-4">
                {/* Date */}
                <div className="grid gap-2">
                  <Label htmlFor="date">
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${
                          !date && "text-muted-foreground"
                        } ${errors.date ? "border-destructive" : ""}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        defaultMonth={date}
                        selected={date}
                        onSelect={handleDateChange}
                        captionLayout="dropdown"
                        className="rounded-lg border shadow-sm"
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.date && (
                    <p className="text-sm text-destructive">{errors.date}</p>
                  )}
                </div>

                {/* Device Status */}
                <div className="grid gap-2">
                  <Label htmlFor="fullyFunctional">
                    Device Status <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.fullyFunctional}
                    onValueChange={(value) =>
                      handleChange("fullyFunctional", value)
                    }
                  >
                    <SelectTrigger
                      className={
                        errors.fullyFunctional ? "border-destructive" : ""
                      }
                    >
                      <SelectValue placeholder="Select device status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Fully Functional</SelectItem>
                      <SelectItem value="No">Not Fully Functional</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.fullyFunctional && (
                    <p className="text-sm text-destructive">
                      {errors.fullyFunctional}
                    </p>
                  )}
                </div>
              </div>

              {/* Personnel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="performedBy">
                    Performed By <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="performedBy"
                    placeholder="Enter name"
                    value={formData.performedBy}
                    onChange={(e) =>
                      handleChange("performedBy", e.target.value)
                    }
                    className={errors.performedBy ? "border-destructive" : ""}
                  />
                  {errors.performedBy && (
                    <p className="text-sm text-destructive">
                      {errors.performedBy}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="validatedBy">Validated By</Label>
                  <Input
                    id="validatedBy"
                    placeholder="Enter name (optional)"
                    value={formData.validatedBy}
                    onChange={(e) =>
                      handleChange("validatedBy", e.target.value)
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="acknowledgedBy">Acknowledged By</Label>
                  <Input
                    id="acknowledgedBy"
                    placeholder="Enter name (optional)"
                    value={formData.acknowledgedBy}
                    onChange={(e) =>
                      handleChange("acknowledgedBy", e.target.value)
                    }
                  />
                </div>
              </div>

              {/* Recommendation */}
              <div className="grid gap-2">
                <Label htmlFor="recommendation">Recommendation</Label>
                <Textarea
                  id="recommendation"
                  placeholder="Enter any recommendations (optional)"
                  value={formData.recommendation}
                  onChange={(e) =>
                    handleChange("recommendation", e.target.value)
                  }
                  rows={3}
                />
              </div>

              {/* Findings and Solutions */}
              <div className="grid gap-2">
                <Label htmlFor="findingsSolutions">
                  Findings and Solutions
                </Label>
                <Textarea
                  id="findingsSolutions"
                  placeholder="Enter findings and solutions (optional)"
                  value={formData.findingsSolutions}
                  onChange={(e) =>
                    handleChange("findingsSolutions", e.target.value)
                  }
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || getTotalTaskCount() === 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create PM Log"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialogComponent
        open={alertDialog.open}
        onOpenChange={(open) => setAlertDialog({ ...alertDialog, open })}
        title={alertDialog.title}
        description={alertDialog.description}
        variant={alertDialog.variant}
      />
    </>
  );
}
