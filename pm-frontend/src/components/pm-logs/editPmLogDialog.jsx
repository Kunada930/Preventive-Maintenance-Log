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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

export default function EditPMLogDialog({
  open,
  onOpenChange,
  log,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(null);
  const [formData, setFormData] = useState({
    date: "",
    fullyFunctional: "",
    recommendation: "",
    performedBy: "",
    validatedBy: "",
    acknowledgedBy: "",
    findingsSolutions: "",
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

  useEffect(() => {
    if (log && open) {
      setFormData({
        date: log.date || "",
        fullyFunctional: log.fullyFunctional || "",
        recommendation: log.recommendation || "",
        performedBy: log.performedBy || "",
        validatedBy: log.validatedBy || "",
        acknowledgedBy: log.acknowledgedBy || "",
        findingsSolutions: log.findingsSolutions || "",
      });
      if (log.date) {
        setDate(new Date(log.date + "T00:00:00"));
      }
      setErrors({});
    }
  }, [log, open]);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleDateChange = (selectedDate) => {
    setDate(selectedDate);
    setFormData((prev) => ({
      ...prev,
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
    }));
    if (errors.date) {
      setErrors((prev) => ({ ...prev, date: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.date) {
      newErrors.date = "Date is required";
    }

    if (!formData.fullyFunctional) {
      newErrors.fullyFunctional = "Status is required";
    }

    if (!formData.performedBy?.trim()) {
      newErrors.performedBy = "Performed by is required";
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
        `${baseUrl}/api/pm-logs/${log.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            date: formData.date,
            fullyFunctional: formData.fullyFunctional,
            recommendation: formData.recommendation || null,
            performedBy: formData.performedBy,
            validatedBy: formData.validatedBy || null,
            acknowledgedBy: formData.acknowledgedBy || null,
            findingsSolutions: formData.findingsSolutions || null,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        showAlert("Success", "PM log updated successfully", "default");
        onSuccess?.();
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        showAlert(
          "Error",
          data.error || "Failed to update PM log",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Update PM log error:", error);
      showAlert(
        "Error",
        "An error occurred while updating PM log",
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

  if (!log) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Edit PM Log</DialogTitle>
            <DialogDescription>
              Update the preventive maintenance execution details
            </DialogDescription>
          </DialogHeader>

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
                    <span className="text-muted-foreground">Device Name:</span>
                    <span className="ml-2 font-medium">{log.deviceName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Serial Number:
                    </span>
                    <Badge variant="outline" className="ml-2">
                      {log.serialNumber}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Manufacturer:</span>
                    <span className="ml-2">{log.manufacturer}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Date and Device Status — aligned side by side */}
              <div className="grid grid-cols-2 gap-4">
                {/* Date */}
                <div className="grid gap-2">
                  <Label htmlFor="date">
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`h-10 w-full justify-start text-left font-normal ${
                          !date && "text-muted-foreground"
                        } ${errors.date ? "border-destructive" : ""}`}
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
                  {errors.date && (
                    <p className="text-sm text-destructive">{errors.date}</p>
                  )}
                </div>

                {/* Device Status */}
                <div className="grid gap-2">
                  <Label htmlFor="fullyFunctional">
                    Device Status <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.fullyFunctional}
                    onValueChange={(value) =>
                      handleChange("fullyFunctional", value)
                    }
                  >
                    <SelectTrigger
                      className={`h-10 ${
                        errors.fullyFunctional ? "border-destructive" : ""
                      }`}
                    >
                      <SelectValue placeholder="Select device status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Fully Functional</SelectItem>
                      <SelectItem value="No">Not Fully Functional</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.fullyFunctional && (
                    <p className="text-sm text-destructive">
                      {errors.fullyFunctional}
                    </p>
                  )}
                </div>
              </div>

              {/* Personnel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="performedBy">
                    Performed By <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="performedBy"
                    placeholder="Enter name"
                    value={formData.performedBy}
                    onChange={(e) =>
                      handleChange("performedBy", e.target.value)
                    }
                    className={errors.performedBy ? "border-destructive" : ""}
                  />
                  {errors.performedBy && (
                    <p className="text-sm text-destructive">
                      {errors.performedBy}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="validatedBy">Validated By</Label>
                  <Input
                    id="validatedBy"
                    placeholder="Enter name (optional)"
                    value={formData.validatedBy}
                    onChange={(e) =>
                      handleChange("validatedBy", e.target.value)
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="acknowledgedBy">Acknowledged By</Label>
                  <Input
                    id="acknowledgedBy"
                    placeholder="Enter name (optional)"
                    value={formData.acknowledgedBy}
                    onChange={(e) =>
                      handleChange("acknowledgedBy", e.target.value)
                    }
                  />
                </div>
              </div>

              {/* Recommendation */}
              <div className="grid gap-2">
                <Label htmlFor="recommendation">Recommendation</Label>
                <Textarea
                  id="recommendation"
                  placeholder="Enter any recommendations (optional)"
                  value={formData.recommendation}
                  onChange={(e) =>
                    handleChange("recommendation", e.target.value)
                  }
                  rows={3}
                />
              </div>

              {/* Findings and Solutions */}
              <div className="grid gap-2">
                <Label htmlFor="findingsSolutions">
                  Findings and Solutions
                </Label>
                <Textarea
                  id="findingsSolutions"
                  placeholder="Enter findings and solutions (optional)"
                  value={formData.findingsSolutions}
                  onChange={(e) =>
                    handleChange("findingsSolutions", e.target.value)
                  }
                  rows={4}
                />
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
                  "Update PM Log"
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
