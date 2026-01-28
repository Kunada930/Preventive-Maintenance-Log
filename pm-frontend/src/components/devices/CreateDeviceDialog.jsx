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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import AlertDialogComponent from "@/components/AlertDialog";

export default function CreateDeviceDialog({ open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(null);
  const [formData, setFormData] = useState({
    deviceName: "",
    serialNumber: "",
    manufacturer: "",
    deviceId: "",
    datePurchased: "",
    responsiblePerson: "",
    location: "",
  });
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleDateChange = (selectedDate) => {
    setDate(selectedDate);
    setFormData((prev) => ({
      ...prev,
      datePurchased: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
    }));
    if (errors.datePurchased) {
      setErrors((prev) => ({ ...prev, datePurchased: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.deviceName.trim()) {
      newErrors.deviceName = "Device name is required";
    }

    if (!formData.serialNumber.trim()) {
      newErrors.serialNumber = "Serial number is required";
    }

    if (!formData.manufacturer.trim()) {
      newErrors.manufacturer = "Manufacturer is required";
    }

    if (!formData.deviceId.trim()) {
      newErrors.deviceId = "Device ID is required";
    }

    if (!formData.datePurchased) {
      newErrors.datePurchased = "Date purchased is required";
    }

    if (!formData.responsiblePerson.trim()) {
      newErrors.responsiblePerson = "Responsible person is required";
    }

    if (!formData.location.trim()) {
      newErrors.location = "Location is required";
    }

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
        `${baseUrl}/api/devices`,
        {
          method: "POST",
          body: JSON.stringify(formData),
        },
      );

      const data = await response.json();

      if (response.ok) {
        showAlert("Success", "Device created successfully", "default");
        setFormData({
          deviceName: "",
          serialNumber: "",
          manufacturer: "",
          deviceId: "",
          datePurchased: "",
          responsiblePerson: "",
          location: "",
        });
        setErrors({});
        onSuccess?.();
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        if (data.code === "DUPLICATE_SERIAL_NUMBER") {
          setErrors({ serialNumber: "This serial number already exists" });
          showAlert("Error", data.error, "destructive");
        } else if (data.code === "DUPLICATE_DEVICE_ID") {
          setErrors({ deviceId: "This device ID already exists" });
          showAlert("Error", data.error, "destructive");
        } else {
          showAlert(
            "Error",
            data.error || "Failed to create device",
            "destructive",
          );
        }
      }
    } catch (error) {
      console.error("Create device error:", error);
      showAlert(
        "Error",
        "An error occurred while creating device",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen) => {
    if (!loading) {
      if (!newOpen) {
        // Reset form when closing
        setFormData({
          deviceName: "",
          serialNumber: "",
          manufacturer: "",
          deviceId: "",
          datePurchased: "",
          responsiblePerson: "",
          location: "",
        });
        setDate(null);
        setErrors({});
      }
      onOpenChange(newOpen);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-[600px]"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Add New Device</DialogTitle>
            <DialogDescription>
              Enter the device information to add it to the inventory
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="deviceName">
                  Device Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="deviceName"
                  name="deviceName"
                  value={formData.deviceName}
                  onChange={handleChange}
                  placeholder="e.g., Dell Latitude 5420"
                  className={errors.deviceName ? "border-destructive" : ""}
                />
                {errors.deviceName && (
                  <p className="text-sm text-destructive">
                    {errors.deviceName}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="serialNumber">
                    Serial Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="serialNumber"
                    name="serialNumber"
                    value={formData.serialNumber}
                    onChange={handleChange}
                    placeholder="e.g., SN123456789"
                    className={errors.serialNumber ? "border-destructive" : ""}
                  />
                  {errors.serialNumber && (
                    <p className="text-sm text-destructive">
                      {errors.serialNumber}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="manufacturer">
                    Manufacturer <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="manufacturer"
                    name="manufacturer"
                    value={formData.manufacturer}
                    onChange={handleChange}
                    placeholder="e.g., Dell"
                    className={errors.manufacturer ? "border-destructive" : ""}
                  />
                  {errors.manufacturer && (
                    <p className="text-sm text-destructive">
                      {errors.manufacturer}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="deviceId">
                    Device ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="deviceId"
                    name="deviceId"
                    value={formData.deviceId}
                    onChange={handleChange}
                    placeholder="e.g., DEV-001"
                    className={errors.deviceId ? "border-destructive" : ""}
                  />
                  {errors.deviceId && (
                    <p className="text-sm text-destructive">
                      {errors.deviceId}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="datePurchased">
                    Date Purchased <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${
                          !date && "text-muted-foreground"
                        } ${errors.datePurchased ? "border-destructive" : ""}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        defaultMonth={date}
                        selected={date}
                        onSelect={handleDateChange}
                        captionLayout="dropdown"
                        className="rounded-lg border shadow-sm"
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.datePurchased && (
                    <p className="text-sm text-destructive">
                      {errors.datePurchased}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="responsiblePerson">
                  Responsible Person <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="responsiblePerson"
                  name="responsiblePerson"
                  value={formData.responsiblePerson}
                  onChange={handleChange}
                  placeholder="e.g., John Doe"
                  className={
                    errors.responsiblePerson ? "border-destructive" : ""
                  }
                />
                {errors.responsiblePerson && (
                  <p className="text-sm text-destructive">
                    {errors.responsiblePerson}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="location">
                  Location <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., Building A, Room 101"
                  className={errors.location ? "border-destructive" : ""}
                />
                {errors.location && (
                  <p className="text-sm text-destructive">{errors.location}</p>
                )}
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
                  "Create Device"
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
