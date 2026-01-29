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

export default function DeleteChecklistDialog({
  open,
  onOpenChange,
  checklist,
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
    if (!checklist) return;

    setLoading(true);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/pm-checklists/${checklist.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (response.ok) {
        showAlert("Success", "Checklist deleted successfully", "default");
        onSuccess?.();
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        showAlert(
          "Error",
          data.error || "Failed to delete checklist",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Delete checklist error:", error);
      showAlert(
        "Error",
        "An error occurred while deleting checklist",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!checklist) return null;

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the checklist for{" "}
              <span className="font-semibold text-foreground">
                {checklist.deviceName}
              </span>{" "}
              (Serial: {checklist.serialNumber}) with maintenance type{" "}
              <span className="font-semibold text-foreground">
                {checklist.maintenanceType}
              </span>
              . All associated tasks will also be deleted. This action cannot be
              undone.
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
                "Delete Checklist"
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
