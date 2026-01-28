"use client";
import { useState, useEffect } from "react";
import { authService } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import CreateDeviceDialog from "./CreateDeviceDialog";
import EditDeviceDialog from "./EditDeviceDialog";
import ViewDeviceDialog from "./ViewDeviceDialog";
import DeleteDeviceDialog from "./DeleteDeviceDialog";
import AlertDialogComponent from "@/components/AlertDialog";
import { formatPhilippineDateTime } from "@/lib/dateUtils";

const DeviceManagement = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
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
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;

      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/devices`,
      );

      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      } else {
        const error = await response.json();
        showAlert(
          "Error",
          error.error || "Failed to fetch devices",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      showAlert(
        "Error",
        "An error occurred while fetching devices",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (device) => {
    setSelectedDevice(device);
    setEditDialogOpen(true);
  };

  const handleView = (device) => {
    setSelectedDevice(device);
    setViewDialogOpen(true);
  };

  const handleDelete = (device) => {
    setSelectedDevice(device);
    setDeleteDialogOpen(true);
  };

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      `${device.deviceName} ${device.serialNumber} ${device.manufacturer} ${device.deviceId} ${device.responsiblePerson} ${device.location}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Data Center Equipment</CardTitle>
              <CardDescription>
                Manage devices, track equipment, and monitor assignments
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Device
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search devices by name, serial number, manufacturer, device ID, person, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading devices...
            </div>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device Name</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Device ID</TableHead>
                    <TableHead>Responsible Person</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Date Purchased</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {searchTerm
                          ? "No devices found matching your search"
                          : "No devices found. Add your first device to get started."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDevices.map((device) => (
                      <TableRow key={device.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-foreground">
                          {device.deviceName}
                        </TableCell>
                        <TableCell className="text-foreground">
                          <Badge variant="outline">{device.serialNumber}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {device.manufacturer}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {device.deviceId}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {device.responsiblePerson}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {device.location}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatPhilippineDateTime(device.datePurchased, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(device)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(device)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(device)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateDeviceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchDevices}
      />

      <EditDeviceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        device={selectedDevice}
        onSuccess={fetchDevices}
      />

      <ViewDeviceDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        device={selectedDevice}
      />

      <DeleteDeviceDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        device={selectedDevice}
        onSuccess={fetchDevices}
      />

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

export default DeviceManagement;
