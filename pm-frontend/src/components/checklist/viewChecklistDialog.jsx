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
import { Loader2 } from "lucide-react";
import { formatPhilippineDateTime } from "@/lib/dateUtils";
import AlertDialogComponent from "@/components/AlertDialog";

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

export default function ViewChecklistDialog({ open, onOpenChange, checklist }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
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
    if (checklist && open) {
      fetchChecklistWithTasks();
    }
  }, [checklist, open]);

  const fetchChecklistWithTasks = async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/pm-checklists/${checklist.id}`,
      );

      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
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
      setLoading(false);
    }
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

  if (!checklist) return null;

  const maintenanceTypes = getMaintenanceTypesArray(checklist.maintenanceType);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checklist Details</DialogTitle>
            <DialogDescription>
              View checklist information and tasks
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Device Information */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold mb-2">Device Information</h3>
              <InfoRow label="Device Name" value={checklist.deviceName} />
              <Separator />
              <InfoRow
                label="Serial Number"
                value={checklist.serialNumber}
                badge={true}
              />
              <Separator />
              <InfoRow label="Manufacturer" value={checklist.manufacturer} />
              <Separator />
              <InfoRow
                label="Device ID"
                value={checklist.deviceIdNumber}
                badge={true}
              />
              <Separator />
              <InfoRow
                label="Date Purchased"
                value={formatPhilippineDateTime(checklist.datePurchased, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              />
              <Separator />
              <InfoRow
                label="Responsible Person"
                value={checklist.responsiblePerson}
              />
              <Separator />
              <InfoRow label="Location" value={checklist.location} />
            </div>

            <Separator className="my-4" />

            {/* Maintenance Information */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold mb-2">
                Maintenance Information
              </h3>
              <div className="flex justify-between items-start py-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Maintenance Types
                </span>
                <div className="flex flex-wrap gap-2 justify-end max-w-md">
                  {maintenanceTypes.map((type, index) => (
                    <Badge key={index} variant="secondary">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <InfoRow label="Task Frequency" value={checklist.taskFrequency} />
              <Separator />
              <InfoRow
                label="Created At"
                value={formatPhilippineDateTime(checklist.createdAt, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            </div>

            <Separator className="my-4" />

            {/* Tasks Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">
                  Tasks ({tasks.length})
                </h3>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading tasks...
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No tasks found for this checklist
                    </div>
                  ) : (
                    tasks.map((task, index) => (
                      <div
                        key={task.id}
                        className="border rounded-lg p-3 bg-muted/30"
                      >
                        <p className="text-sm font-medium">
                          {index + 1}. {task.taskDescription}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
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
