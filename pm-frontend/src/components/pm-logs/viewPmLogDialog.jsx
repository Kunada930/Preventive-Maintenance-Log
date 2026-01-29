"use client";
import { useState, useEffect } from "react";
import { authService } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, Circle } from "lucide-react";
import { formatPhilippineDateTime } from "@/lib/dateUtils";
import AlertDialogComponent from "@/components/AlertDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Helper component for info rows
const InfoRow = ({ label, value, badge = false }) => (
  <div className="flex justify-between items-center py-3">
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    {badge ? (
      <Badge variant="outline" className="font-mono">
        {value}
      </Badge>
    ) : (
      <span className="text-sm text-foreground font-medium">{value}</span>
    )}
  </div>
);

export default function ViewPMLogDialog({ open, onOpenChange, log }) {
  const [logData, setLogData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updatingTask, setUpdatingTask] = useState(null);
  const [openAccordionItems, setOpenAccordionItems] = useState([]);
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
    if (log && open) {
      fetchLogDetails();
    }
  }, [log, open]);

  const fetchLogDetails = async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/pm-logs/${log.id}`,
      );

      if (response.ok) {
        const data = await response.json();
        setLogData(data);
        // Set all accordion items to open by default
        setOpenAccordionItems(Object.keys(data.tasksByType || {}));
      } else {
        const error = await response.json();
        showAlert(
          "Error",
          error.error || "Failed to fetch log details",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error fetching log:", error);
      showAlert(
        "Error",
        "An error occurred while fetching log details",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTaskToggle = async (taskId, currentStatus) => {
    try {
      setUpdatingTask(taskId);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/pm-logs/tasks/${taskId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            isChecked: !currentStatus,
          }),
        },
      );

      if (response.ok) {
        // Update local state without closing accordion
        setLogData((prevData) => {
          if (!prevData) return prevData;

          const updatedTasksByType = { ...prevData.tasksByType };

          // Find and update the task
          Object.keys(updatedTasksByType).forEach((type) => {
            updatedTasksByType[type] = updatedTasksByType[type].map((task) =>
              task.id === taskId
                ? { ...task, isChecked: !currentStatus }
                : task,
            );
          });

          // Update statistics
          const newCheckedCount =
            prevData.statistics.checkedTasks + (!currentStatus ? 1 : -1);
          const newUncheckedCount =
            prevData.statistics.uncheckedTasks + (!currentStatus ? -1 : 1);

          return {
            ...prevData,
            tasksByType: updatedTasksByType,
            statistics: {
              ...prevData.statistics,
              checkedTasks: newCheckedCount,
              uncheckedTasks: newUncheckedCount,
            },
          };
        });
      } else {
        const error = await response.json();
        showAlert(
          "Error",
          error.error || "Failed to update task",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error updating task:", error);
      showAlert(
        "Error",
        "An error occurred while updating task",
        "destructive",
      );
    } finally {
      setUpdatingTask(null);
    }
  };

  if (!log) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>PM Log Details</DialogTitle>
            <DialogDescription>
              View preventive maintenance execution details and task completion
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading log details...
            </div>
          ) : logData ? (
            <div className="space-y-4">
              {/* Device Information */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold mb-2">
                  Device Information
                </h3>
                <InfoRow label="Device Name" value={logData.log.deviceName} />
                <Separator />
                <InfoRow
                  label="Serial Number"
                  value={logData.log.serialNumber}
                  badge={true}
                />
                <Separator />
                <InfoRow
                  label="Manufacturer"
                  value={logData.log.manufacturer}
                />
              </div>

              <Separator className="my-4" />

              {/* Maintenance Information */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold mb-2">
                  Maintenance Information
                </h3>
                <InfoRow
                  label="Date"
                  value={formatPhilippineDateTime(logData.log.date, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
                <Separator />
                <div className="flex justify-between items-center py-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    Device Status
                  </span>
                  <Badge
                    variant={
                      logData.log.fullyFunctional === "Yes"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {logData.log.fullyFunctional === "Yes"
                      ? "Fully Functional"
                      : "Not Functional"}
                  </Badge>
                </div>
                <Separator />
                <InfoRow label="Performed By" value={logData.log.performedBy} />
                <Separator />
                <InfoRow
                  label="Validated By"
                  value={logData.log.validatedBy || "N/A"}
                />
                <Separator />
                <InfoRow
                  label="Acknowledged By"
                  value={logData.log.acknowledgedBy || "N/A"}
                />
              </div>

              <Separator className="my-4" />

              {/* Findings and Recommendations */}
              {(logData.log.recommendation ||
                logData.log.findingsSolutions) && (
                <>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">
                      Findings and Recommendations
                    </h3>
                    {logData.log.recommendation && (
                      <div className="rounded-lg border p-3 bg-muted/30">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Recommendation
                        </p>
                        <p className="text-sm">{logData.log.recommendation}</p>
                      </div>
                    )}
                    {logData.log.findingsSolutions && (
                      <div className="rounded-lg border p-3 bg-muted/30">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Findings and Solutions
                        </p>
                        <p className="text-sm whitespace-pre-wrap">
                          {logData.log.findingsSolutions}
                        </p>
                      </div>
                    )}
                  </div>
                  <Separator className="my-4" />
                </>
              )}

              {/* Task Statistics */}
              <div className="rounded-lg border p-4 bg-muted/30">
                <h3 className="text-sm font-semibold mb-3">Task Statistics</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {logData.statistics.totalTasks}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Tasks</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {logData.statistics.checkedTasks}
                    </p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-600">
                      {logData.statistics.uncheckedTasks}
                    </p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Tasks by Type */}
              <div>
                <h3 className="text-sm font-semibold mb-4">
                  Tasks by Maintenance Type
                </h3>
                <Accordion
                  type="multiple"
                  value={openAccordionItems}
                  onValueChange={setOpenAccordionItems}
                  className="w-full"
                >
                  {Object.entries(logData.tasksByType).map(
                    ([type, tasks], index) => (
                      <AccordionItem key={type} value={type}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <span className="font-medium">{type}</span>
                            <Badge variant="outline">
                              {tasks.filter((t) => t.isChecked).length}/
                              {tasks.length}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pt-2">
                            {tasks.map((task) => (
                              <div
                                key={task.id}
                                className={cn(
                                  "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                                  task.isChecked
                                    ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
                                    : "bg-muted/30",
                                )}
                              >
                                <Checkbox
                                  checked={task.isChecked}
                                  onCheckedChange={(checked) => {
                                    // Prevent accordion from closing
                                    handleTaskToggle(task.id, task.isChecked);
                                  }}
                                  disabled={updatingTask === task.id}
                                  className="mt-0.5"
                                />
                                <div className="flex-1">
                                  <p
                                    className={cn(
                                      "text-sm",
                                      task.isChecked &&
                                        "line-through text-muted-foreground",
                                    )}
                                  >
                                    {task.taskDescription}
                                  </p>
                                </div>
                                {updatingTask === task.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                                ) : task.isChecked ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                                ) : (
                                  <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                )}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ),
                  )}
                </Accordion>
              </div>

              <Separator className="my-4" />

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Created:{" "}
                  {formatPhilippineDateTime(logData.log.createdAt, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p>
                  Last Updated:{" "}
                  {formatPhilippineDateTime(logData.log.updatedAt, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ) : null}
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
