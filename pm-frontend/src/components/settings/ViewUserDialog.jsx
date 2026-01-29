"use client";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Briefcase, Calendar, Shield } from "lucide-react";
import { formatPhilippineDateTime } from "@/lib/dateUtils";

const ViewUserDialog = ({ open, onOpenChange, user }) => {
  // Prevent Escape key from closing the dialog
  useEffect(() => {
    if (open) {
      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      window.addEventListener("keydown", handleKeyDown, true);
      return () => window.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [open]);

  if (!user) return null;

  const getInitials = () => {
    return `${user.firstName?.charAt(0) || ""}${
      user.lastName?.charAt(0) || ""
    }`.toUpperCase();
  };

  const getProfilePictureUrl = () => {
    if (!user.profilePicture) return null;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    return `${baseUrl}/${user.profilePicture}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>View complete user information</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage
                src={getProfilePictureUrl()}
                className="object-cover"
              />
              <AvatarFallback className="text-lg">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-2xl font-semibold text-foreground">
                {user.firstName} {user.middleName} {user.lastName}
              </h3>
              <p className="text-muted-foreground">@{user.username}</p>
            </div>
            <Badge
              variant={user.role === "admin" ? "default" : "secondary"}
              className="h-fit"
            >
              <Shield className="h-3 w-3 mr-1" />
              {user.role}
            </Badge>
          </div>

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Personal Information
              </h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">First Name</p>
                  <p className="text-sm text-foreground font-medium">
                    {user.firstName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Middle Name</p>
                  <p className="text-sm text-foreground font-medium">
                    {user.middleName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Name</p>
                  <p className="text-sm text-foreground font-medium">
                    {user.lastName}
                  </p>
                </div>
              </div>
            </div>

            {/* Work Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Work Information
              </h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Position</p>
                  <p className="text-sm text-foreground font-medium">
                    {user.position}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="text-sm text-foreground font-medium">
                    <Badge
                      variant={user.role === "admin" ? "default" : "secondary"}
                    >
                      {user.role}
                    </Badge>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="text-sm text-foreground font-medium font-mono">
                    {user.username}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Account Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Account Information
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Created At</p>
                <p className="text-sm text-foreground font-medium">
                  {formatPhilippineDateTime(user.createdAt)}
                </p>
              </div>
              {user.updatedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="text-sm text-foreground font-medium">
                    {formatPhilippineDateTime(user.updatedAt)}
                  </p>
                </div>
              )}
            </div>
            {user.mustChangePassword && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  This user must change their password on next login
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewUserDialog;
