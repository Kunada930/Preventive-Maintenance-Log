"use client";
import { useState, useEffect } from "react";
import { authService } from "@/lib/auth";
import { validatePassword } from "@/lib/passwordValidation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Loader2, X, Check } from "lucide-react";
import AlertDialogComponent from "@/components/AlertDialog";

const PasswordRequirement = ({ met, text }) => (
  <div className="flex items-center gap-1.5">
    {met ? (
      <Check className="h-3 w-3 text-green-600" />
    ) : (
      <X className="h-3 w-3 text-muted-foreground" />
    )}
    <span className={met ? "text-green-600" : "text-muted-foreground"}>
      {text}
    </span>
  </div>
);

const EditUserDialog = ({ open, onOpenChange, user, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [alertDialog, setAlertDialog] = useState({
    open: false,
    title: "",
    description: "",
    variant: "default",
  });

  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    position: "",
    role: "user",
    password: "",
    reenterPassword: "",
  });

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

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        middleName: user.middleName || "",
        lastName: user.lastName || "",
        position: user.position || "",
        role: user.role || "user",
        password: "",
        reenterPassword: "",
      });
      setProfilePicture(null);
      setPreviewUrl(null);
    }
  }, [user]);

  const showAlert = (title, description, variant = "default") => {
    setAlertDialog({ open: true, title, description, variant });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRoleChange = (value) => {
    setFormData({
      ...formData,
      role: value,
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
      ];
      if (!allowedTypes.includes(file.type)) {
        showAlert(
          "Error",
          "Only image files are allowed (jpeg, jpg, png, gif)",
          "destructive",
        );
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        showAlert("Error", "File size must be less than 5MB", "destructive");
        return;
      }

      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadProfilePicture = async () => {
    if (!profilePicture || !user) return;

    try {
      setUploadingImage(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;

      const uploadFormData = new FormData();
      uploadFormData.append("profilePicture", profilePicture);

      const response = await fetch(
        `${baseUrl}/api/users/${user.id}/profile-picture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authService.getToken()}`,
          },
          body: uploadFormData,
        },
      );

      const data = await response.json();

      if (response.ok) {
        showAlert("Success", "Profile picture updated successfully");
        setProfilePicture(null);
        setPreviewUrl(null);
        onSuccess();
      } else {
        showAlert(
          "Error",
          data.error || "Failed to upload profile picture",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      showAlert("Error", "An error occurred while uploading", "destructive");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteProfilePicture = async () => {
    if (!user?.profilePicture) return;

    try {
      setUploadingImage(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;

      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/users/${user.id}/profile-picture`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (response.ok) {
        showAlert("Success", "Profile picture deleted successfully");
        onSuccess();
      } else {
        showAlert(
          "Error",
          data.error || "Failed to delete profile picture",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error deleting profile picture:", error);
      showAlert("Error", "An error occurred while deleting", "destructive");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.middleName ||
      !formData.position
    ) {
      showAlert(
        "Validation Error",
        "All fields except password are required",
        "destructive",
      );
      return;
    }

    if (formData.password || formData.reenterPassword) {
      // Validate password using passwordValidation
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        showAlert(
          "Validation Error",
          "Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character",
          "destructive",
        );
        return;
      }

      if (formData.password !== formData.reenterPassword) {
        showAlert("Validation Error", "Passwords do not match", "destructive");
        return;
      }
    }

    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;

      const updateData = {
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        position: formData.position,
        role: formData.role,
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/users/${user.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        },
      );

      const data = await response.json();

      if (response.ok) {
        showAlert("Success", "User updated successfully");
        onOpenChange(false);
        onSuccess();
      } else {
        showAlert(
          "Error",
          data.error || "Failed to update user",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error updating user:", error);
      showAlert(
        "Error",
        "An error occurred while updating user",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    return `${formData.firstName?.charAt(0) || ""}${
      formData.lastName?.charAt(0) || ""
    }`.toUpperCase();
  };

  const getProfilePictureUrl = () => {
    if (previewUrl) return previewUrl;
    if (user?.profilePicture) {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      return `${baseUrl}/${user.profilePicture}`;
    }
    return null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user account information
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col items-center gap-4 pb-4 border-b">
              <Avatar className="h-24 w-24">
                <AvatarImage
                  src={getProfilePictureUrl()}
                  className="object-cover"
                />
                <AvatarFallback className="text-2xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>

              <div className="flex gap-2">
                <Label htmlFor="profilePicture" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent text-sm">
                    <Upload className="h-4 w-4" />
                    Choose Image
                  </div>
                </Label>
                <Input
                  id="profilePicture"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {profilePicture && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleUploadProfilePicture}
                    disabled={uploadingImage}
                  >
                    {uploadingImage && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Upload
                  </Button>
                )}

                {user?.profilePicture && !profilePicture && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteProfilePicture}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Max 5MB. Supported: JPG, PNG, GIF
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="middleName">
                  Middle Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="middleName"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">
                  Position <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">
                  Role <span className="text-destructive">*</span>
                </Label>
                <Select value={formData.role} onValueChange={handleRoleChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium mb-4">
                Change Password (Optional)
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Leave blank to keep current"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reenterPassword">Re-enter Password</Label>
                  <Input
                    id="reenterPassword"
                    name="reenterPassword"
                    type="password"
                    value={formData.reenterPassword}
                    onChange={handleChange}
                    placeholder="Leave blank to keep current"
                  />
                </div>
              </div>

              {/* Password Requirements */}
              {formData.password && (
                <div className="rounded-md border border-border p-3 space-y-2 mt-4">
                  <p className="text-sm font-medium">Password Requirements:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <PasswordRequirement
                      met={validatePassword(formData.password).minLength}
                      text="At least 8 characters"
                    />
                    <PasswordRequirement
                      met={validatePassword(formData.password).hasUpperCase}
                      text="Uppercase letter"
                    />
                    <PasswordRequirement
                      met={validatePassword(formData.password).hasLowerCase}
                      text="Lowercase letter"
                    />
                    <PasswordRequirement
                      met={validatePassword(formData.password).hasNumber}
                      text="Number"
                    />
                    <PasswordRequirement
                      met={validatePassword(formData.password).hasSpecialChar}
                      text="Special character"
                    />
                  </div>
                </div>
              )}
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
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update User
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
};

export default EditUserDialog;
