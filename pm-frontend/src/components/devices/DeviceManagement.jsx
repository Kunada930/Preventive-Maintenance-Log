"use client";
import { useState, useEffect } from "react";
import { authService } from "@/lib/auth";
import { useAuth } from "@/app/contexts/AuthContext";
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
import { formatPhilippineDate } from "@/lib/dateUtils";

const DeviceManagement = () => {
  const { user: currentUser } = useAuth(); // Get current logged-in user
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
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

  // Check if current user is admin
  const isAdmin = currentUser?.role === "admin";

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
    // Users and admins can edit
    setSelectedDevice(device);
    setEditDialogOpen(true);
  };

  const handleView = (device) => {
    setSelectedDevice(device);
    setViewDialogOpen(true);
  };

  const handleDelete = (device) => {
    // Only admins can delete
    if (!isAdmin) {
      showAlert(
        "Access Denied",
        "Only administrators can delete devices",
        "destructive",
      );
      return;
    }
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

  // Pagination calculations
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDevices = filteredDevices.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

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
            {/* Users and admins can create devices */}
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
                    <TableHead>Device ID</TableHead>
                    <TableHead>Responsible Person</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Date Purchased</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentDevices.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {searchTerm
                          ? "No devices found matching your search"
                          : "No devices found. Add your first device to get started."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentDevices.map((device) => (
                      <TableRow key={device.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-foreground">
                          {device.deviceName}
                        </TableCell>
                        <TableCell className="text-foreground">
                          <Badge variant="outline">{device.serialNumber}</Badge>
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
                          {formatPhilippineDate(device.datePurchased, {
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
                              title="View device details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {/* Users and admins can edit */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(device)}
                              title="Edit device"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {/* Only admins can delete */}
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(device)}
                                title="Delete device"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && filteredDevices.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {indexOfFirstItem + 1} to{" "}
                {Math.min(indexOfLastItem, filteredDevices.length)} of{" "}
                {filteredDevices.length} devices
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (pageNum) => (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users and admins can create and edit */}
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

      {/* Only admins can delete */}
      {isAdmin && (
        <DeleteDeviceDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          device={selectedDevice}
          onSuccess={fetchDevices}
        />
      )}

      <ViewDeviceDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        device={selectedDevice}
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
