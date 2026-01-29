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
import { Upload, Loader2, Check, X } from "lucide-react";
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

const CreateUserDialog = ({ open, onOpenChange, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [alertDialog, setAlertDialog] = useState({
    open: false,
    title: "",
    description: "",
    variant: "default",
  });

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    reenterPassword: "",
    firstName: "",
    middleName: "",
    lastName: "",
    position: "",
    role: "user",
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

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      reenterPassword: "",
      firstName: "",
      middleName: "",
      lastName: "",
      position: "",
      role: "user",
    });
    setProfilePicture(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.username ||
      !formData.password ||
      !formData.reenterPassword ||
      !formData.firstName ||
      !formData.lastName ||
      !formData.middleName ||
      !formData.position
    ) {
      showAlert("Validation Error", "All fields are required", "destructive");
      return;
    }

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

    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;

      // First, create the user with JSON data
      const response = await authService.fetchWithAuth(`${baseUrl}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          firstName: formData.firstName,
          middleName: formData.middleName,
          lastName: formData.lastName,
          position: formData.position,
          role: formData.role,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // If profile picture is provided, upload it
        if (profilePicture && data.user && data.user.id) {
          try {
            const uploadFormData = new FormData();
            uploadFormData.append("profilePicture", profilePicture);

            const uploadResponse = await fetch(
              `${baseUrl}/api/users/${data.user.id}/profile-picture`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${authService.getToken()}`,
                },
                body: uploadFormData,
              },
            );

            if (!uploadResponse.ok) {
              console.error("Profile picture upload failed");
              // Don't fail the entire operation, just log the error
            }
          } catch (uploadError) {
            console.error("Error uploading profile picture:", uploadError);
            // Don't fail the entire operation
          }
        }

        showAlert("Success", "User created successfully");
        onOpenChange(false);
        onSuccess();
        resetForm();
      } else {
        showAlert(
          "Error",
          data.error || "Failed to create user",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error creating user:", error);
      showAlert(
        "Error",
        "An error occurred while creating user",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
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
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user account to the system
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={previewUrl} className="object-cover" />
                <AvatarFallback>
                  <Upload className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center gap-2">
                <Label htmlFor="profilePicture" className="cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Upload className="h-4 w-4" />
                    Upload Profile Picture
                  </div>
                </Label>
                <Input
                  id="profilePicture"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">
                  Max size: 5MB. Formats: JPG, PNG, GIF
                </p>
              </div>
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
                  placeholder="John"
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
                  placeholder="Smith"
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
                placeholder="Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">
                Position <span className="text-destructive">*</span>
              </Label>
              <Input
                id="position"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="Security Analyst"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select value={formData.role} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="john.doe"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reenterPassword">
                  Re-enter Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reenterPassword"
                  name="reenterPassword"
                  type="password"
                  value={formData.reenterPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Password Requirements */}
            {formData.password && (
              <div className="rounded-md border border-border p-3 space-y-2">
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  resetForm();
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User
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

export default CreateUserDialog;
