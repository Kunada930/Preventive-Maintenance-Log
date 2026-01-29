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
import { Loader2, Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import AlertDialogComponent from "@/components/AlertDialog";

const MAINTENANCE_TYPES = [
  "Hardware Maintenance",
  "Software Maintenance",
  "Storage Maintenance",
  "Network and Connectivity",
  "Power Source",
  "Performance and Optimization",
];

export default function CreateChecklistDialog({
  open,
  onOpenChange,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [formData, setFormData] = useState({
    deviceId: "",
    maintenanceTypes: [],
    taskFrequency: "",
  });
  const [tasks, setTasks] = useState([{ taskDescription: "" }]);
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

  const handleDeviceChange = (deviceId) => {
    const device = devices.find((d) => d.id.toString() === deviceId);
    setSelectedDevice(device);
    setFormData((prev) => ({ ...prev, deviceId }));
    if (errors.deviceId) {
      setErrors((prev) => ({ ...prev, deviceId: "" }));
    }
  };

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleTaskChange = (index, value) => {
    const newTasks = [...tasks];
    newTasks[index].taskDescription = value;
    setTasks(newTasks);
    if (errors[`task_${index}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`task_${index}`];
        return newErrors;
      });
    }
  };

  const handleMaintenanceTypeToggle = (type) => {
    setFormData((prev) => {
      const currentTypes = prev.maintenanceTypes || [];
      const newTypes = currentTypes.includes(type)
        ? currentTypes.filter((t) => t !== type)
        : [...currentTypes, type];
      return { ...prev, maintenanceTypes: newTypes };
    });
    if (errors.maintenanceTypes) {
      setErrors((prev) => ({ ...prev, maintenanceTypes: "" }));
    }
  };

  const addTask = () => {
    setTasks([...tasks, { taskDescription: "" }]);
  };

  const removeTask = (index) => {
    if (tasks.length > 1) {
      const newTasks = tasks.filter((_, i) => i !== index);
      setTasks(newTasks);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.deviceId) {
      newErrors.deviceId = "Device is required";
    }

    if (!formData.maintenanceTypes || formData.maintenanceTypes.length === 0) {
      newErrors.maintenanceTypes = "At least one maintenance type is required";
    }

    if (!formData.taskFrequency) {
      newErrors.taskFrequency = "Task frequency is required";
    }

    tasks.forEach((task, index) => {
      if (!task.taskDescription.trim()) {
        newErrors[`task_${index}`] = "Task description cannot be empty";
      }
    });

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
        `${baseUrl}/api/pm-checklists`,
        {
          method: "POST",
          body: JSON.stringify({
            deviceId: parseInt(formData.deviceId),
            maintenanceTypes: formData.maintenanceTypes,
            taskFrequency: formData.taskFrequency,
            tasks: tasks,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        showAlert("Success", "Checklist created successfully", "default");
        setFormData({
          deviceId: "",
          maintenanceTypes: [],
          taskFrequency: "",
        });
        setTasks([{ taskDescription: "" }]);
        setSelectedDevice(null);
        setErrors({});
        onSuccess?.();
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        showAlert(
          "Error",
          data.error || "Failed to create checklist",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Create checklist error:", error);
      showAlert(
        "Error",
        "An error occurred while creating checklist",
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
          maintenanceTypes: [],
          taskFrequency: "",
        });
        setTasks([{ taskDescription: "" }]);
        setSelectedDevice(null);
        setErrors({});
      }
      onOpenChange(newOpen);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Create PM Checklist</DialogTitle>
            <DialogDescription>
              Select a device and create a preventive maintenance checklist with
              tasks
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

              {/* Maintenance Type */}
              <div className="grid gap-2">
                <Label>
                  Maintenance Types <span className="text-destructive">*</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    (Select all that apply)
                  </span>
                </Label>
                <div
                  className={`grid grid-cols-2 gap-3 p-4 border rounded-lg ${errors.maintenanceTypes ? "border-destructive" : ""}`}
                >
                  {MAINTENANCE_TYPES.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={type}
                        checked={formData.maintenanceTypes?.includes(type)}
                        onCheckedChange={() =>
                          handleMaintenanceTypeToggle(type)
                        }
                      />
                      <label
                        htmlFor={type}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {type}
                      </label>
                    </div>
                  ))}
                </div>
                {errors.maintenanceTypes && (
                  <p className="text-sm text-destructive">
                    {errors.maintenanceTypes}
                  </p>
                )}
              </div>

              {/* Task Frequency */}
              <div className="grid gap-2">
                <Label htmlFor="taskFrequency">
                  Task Frequency <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.taskFrequency}
                  onValueChange={(value) =>
                    handleChange("taskFrequency", value)
                  }
                >
                  <SelectTrigger
                    className={errors.taskFrequency ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select task frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
                {errors.taskFrequency && (
                  <p className="text-sm text-destructive">
                    {errors.taskFrequency}
                  </p>
                )}
              </div>

              <Separator />

              {/* Tasks */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Tasks <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTask}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </div>

                <div className="space-y-3">
                  {tasks.map((task, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder={`Task ${index + 1} description`}
                          value={task.taskDescription}
                          onChange={(e) =>
                            handleTaskChange(index, e.target.value)
                          }
                          className={
                            errors[`task_${index}`] ? "border-destructive" : ""
                          }
                        />
                        {errors[`task_${index}`] && (
                          <p className="text-sm text-destructive mt-1">
                            {errors[`task_${index}`]}
                          </p>
                        )}
                      </div>
                      {tasks.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTask(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
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
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Checklist"
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
