"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPhilippineDateTime } from "@/lib/dateUtils";

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

export default function ViewDeviceDialog({ open, onOpenChange, device }) {
  if (!device) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Device Details</DialogTitle>
          <DialogDescription>
            Complete information about this device
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <InfoRow label="Device Name" value={device.deviceName} />
          <Separator />

          <InfoRow
            label="Serial Number"
            value={device.serialNumber}
            badge={true}
          />
          <Separator />

          <InfoRow label="Manufacturer" value={device.manufacturer} />
          <Separator />

          <InfoRow label="Device ID" value={device.deviceId} badge={true} />
          <Separator />

          <InfoRow
            label="Date Purchased"
            value={formatPhilippineDateTime(device.datePurchased, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          />
          <Separator />

          <InfoRow
            label="Responsible Person"
            value={device.responsiblePerson}
          />
          <Separator />

          <InfoRow label="Location" value={device.location} />
          <Separator />

          <InfoRow
            label="Created At"
            value={formatPhilippineDateTime(device.createdAt, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
          <Separator />

          <InfoRow
            label="Last Updated"
            value={formatPhilippineDateTime(device.updatedAt, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
