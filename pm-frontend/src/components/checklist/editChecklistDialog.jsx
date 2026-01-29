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

export default function EditChecklistDialog({
  open,
  onOpenChange,
  checklist,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [formData, setFormData] = useState({
    maintenanceTypes: [],
    taskFrequency: "",
  });
  const [tasks, setTasks] = useState([]);
  const [originalTasks, setOriginalTasks] = useState([]);
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

  // Helper to get maintenance types as array
  const getMaintenanceTypesArray = (maintenanceType) => {
    if (Array.isArray(maintenanceType)) return maintenanceType;
    if (typeof maintenanceType === "string") {
      try {
        const parsed = JSON.parse(maintenanceType);
        return Array.isArray(parsed) ? parsed : [maintenanceType];
      } catch {
        return [maintenanceType];
      }
    }
    return [];
  };

  useEffect(() => {
    if (checklist && open) {
      fetchChecklistWithTasks();
    }
  }, [checklist, open]);

  const fetchChecklistWithTasks = async () => {
    try {
      setLoadingData(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/pm-checklists/${checklist.id}`,
      );

      if (response.ok) {
        const data = await response.json();
        const maintenanceTypes = getMaintenanceTypesArray(
          data.checklist.maintenanceType,
        );
        setFormData({
          maintenanceTypes: maintenanceTypes,
          taskFrequency: data.checklist.taskFrequency || "",
        });
        const taskList =
          data.tasks?.map((task) => ({
            id: task.id,
            taskDescription: task.taskDescription,
            isExisting: true,
          })) || [];
        setTasks(taskList);
        setOriginalTasks(JSON.parse(JSON.stringify(taskList)));
        setErrors({});
      } else {
        const error = await response.json();
        showAlert(
          "Error",
          error.error || "Failed to fetch checklist details",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error fetching checklist:", error);
      showAlert(
        "Error",
        "An error occurred while fetching checklist details",
        "destructive",
      );
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
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

  const addTask = () => {
    setTasks([...tasks, { taskDescription: "", isExisting: false }]);
  };

  const removeTask = (index) => {
    if (tasks.length > 1) {
      const newTasks = tasks.filter((_, i) => i !== index);
      setTasks(newTasks);
    }
  };

  const validateForm = () => {
    const newErrors = {};

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

      // 1. Update checklist basic info
      const updateResponse = await authService.fetchWithAuth(
        `${baseUrl}/api/pm-checklists/${checklist.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            maintenanceTypes: formData.maintenanceTypes,
            taskFrequency: formData.taskFrequency,
          }),
        },
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        showAlert(
          "Error",
          error.error || "Failed to update checklist",
          "destructive",
        );
        setLoading(false);
        return;
      }

      // 2. Handle task updates
      // Find tasks to delete (existing tasks that were removed)
      const tasksToDelete = originalTasks.filter(
        (originalTask) => !tasks.find((task) => task.id === originalTask.id),
      );

      // Find tasks to update (existing tasks with changed descriptions)
      const tasksToUpdate = tasks.filter((task) => {
        if (!task.isExisting) return false;
        const original = originalTasks.find((t) => t.id === task.id);
        return original && original.taskDescription !== task.taskDescription;
      });

      // Find tasks to create (new tasks)
      const tasksToCreate = tasks.filter((task) => !task.isExisting);

      // Delete tasks
      for (const task of tasksToDelete) {
        const deleteResponse = await authService.fetchWithAuth(
          `${baseUrl}/api/pm-checklists/tasks/${task.id}`,
          { method: "DELETE" },
        );
        if (!deleteResponse.ok) {
          console.error(`Failed to delete task ${task.id}`);
        }
      }

      // Update tasks
      for (const task of tasksToUpdate) {
        const updateTaskResponse = await authService.fetchWithAuth(
          `${baseUrl}/api/pm-checklists/tasks/${task.id}/description`,
          {
            method: "PUT",
            body: JSON.stringify({
              taskDescription: task.taskDescription,
            }),
          },
        );
        if (!updateTaskResponse.ok) {
          console.error(`Failed to update task ${task.id}`);
        }
      }

      // Create new tasks
      for (const task of tasksToCreate) {
        const createTaskResponse = await authService.fetchWithAuth(
          `${baseUrl}/api/pm-checklists/${checklist.id}/tasks`,
          {
            method: "POST",
            body: JSON.stringify({
              taskDescription: task.taskDescription,
            }),
          },
        );
        if (!createTaskResponse.ok) {
          console.error(`Failed to create task`);
        }
      }

      showAlert("Success", "Checklist updated successfully", "default");
      onSuccess?.();
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (error) {
      console.error("Update checklist error:", error);
      showAlert(
        "Error",
        "An error occurred while updating checklist",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen) => {
    if (!loading) {
      onOpenChange(newOpen);
    }
  };

  if (!checklist) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Edit PM Checklist</DialogTitle>
            <DialogDescription>
              Update the preventive maintenance checklist and tasks
            </DialogDescription>
          </DialogHeader>

          {loadingData ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading checklist details...
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                {/* Device Details (Read-only) */}
                <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
                  <h4 className="font-semibold text-sm">
                    Device Details (Read-only)
                  </h4>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        Device Name:
                      </span>
                      <span className="ml-2 font-medium">
                        {checklist.deviceName}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Serial Number:
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {checklist.serialNumber}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Device ID:</span>
                      <Badge variant="outline" className="ml-2">
                        {checklist.deviceIdNumber}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Manufacturer:
                      </span>
                      <span className="ml-2">{checklist.manufacturer}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Location:</span>
                      <span className="ml-2">{checklist.location}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Responsible:
                      </span>
                      <span className="ml-2">
                        {checklist.responsiblePerson}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Maintenance Types */}
                <div className="grid gap-2">
                  <Label>
                    Maintenance Types{" "}
                    <span className="text-destructive">*</span>
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
                      className={
                        errors.taskFrequency ? "border-destructive" : ""
                      }
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
                              errors[`task_${index}`]
                                ? "border-destructive"
                                : ""
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
                      Updating...
                    </>
                  ) : (
                    "Update Checklist"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
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
