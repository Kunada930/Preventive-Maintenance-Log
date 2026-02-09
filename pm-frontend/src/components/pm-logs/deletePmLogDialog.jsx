"use client";
import { useState } from "react";
import { authService } from "@/lib/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import AlertDialogComponent from "@/components/AlertDialog";
import { formatPhilippineDate } from "@/lib/dateUtils";

export default function DeletePMLogDialog({
  open,
  onOpenChange,
  log,
  onSuccess,
}) {
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

  const handleDelete = async () => {
    if (!log) return;

    setLoading(true);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/pm-logs/${log.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (response.ok) {
        showAlert("Success", "PM log deleted successfully", "default");
        onSuccess?.();
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        showAlert(
          "Error",
          data.error || "Failed to delete PM log",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Delete PM log error:", error);
      showAlert(
        "Error",
        "An error occurred while deleting PM log",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!log) return null;

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the PM log for{" "}
              <span className="font-semibold text-foreground">
                {log.deviceName}
              </span>{" "}
              (Serial: {log.serialNumber}) performed on{" "}
              <span className="font-semibold text-foreground">
                {formatPhilippineDate(log.date, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              . All associated tasks and data will also be deleted. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete PM Log"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
