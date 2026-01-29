"use client";
import { useState } from "react";
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
import { AlertTriangle, Loader2 } from "lucide-react";
import AlertDialogComponent from "@/components/AlertDialog";

const DeleteUserDialog = ({ open, onOpenChange, user, onSuccess }) => {
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
    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;

      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/users/${user.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (response.ok) {
        showAlert("Success", "User deleted successfully");
        onOpenChange(false);
        onSuccess();
      } else {
        showAlert(
          "Error",
          data.error || "Failed to delete user",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      showAlert(
        "Error",
        "An error occurred while deleting user",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              user account and all associated data.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
            <p className="text-sm text-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {user.firstName} {user.lastName}
              </span>{" "}
              (@{user.username})?
            </p>
            <ul className="list-disc list-inside mt-2 text-xs text-muted-foreground space-y-1">
              <li>Profile information and picture</li>
              <li>Password history</li>
              <li>Refresh tokens and sessions</li>
            </ul>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete User
            </Button>
          </DialogFooter>
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
};

export default DeleteUserDialog;
