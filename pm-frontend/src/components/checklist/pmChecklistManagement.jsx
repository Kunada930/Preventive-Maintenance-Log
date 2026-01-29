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
import { Plus, Search, Eye, Trash2, Edit } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CreateChecklistDialog from "./createChecklistDialog";
import ViewChecklistDialog from "./viewChecklistDialog";
import EditChecklistDialog from "./editChecklistDialog";
import DeleteChecklistDialog from "./deleteChecklistDialog";
import AlertDialogComponent from "@/components/AlertDialog";
import { formatPhilippineDateTime } from "@/lib/dateUtils";

const PMChecklistManagement = () => {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFrequency, setFilterFrequency] = useState("all");
  const [filterMaintenanceType, setFilterMaintenanceType] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
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
    fetchChecklists();
  }, []);

  const fetchChecklists = async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;

      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/pm-checklists`,
      );

      if (response.ok) {
        const data = await response.json();
        setChecklists(data.checklists || []);
      } else {
        const error = await response.json();
        showAlert(
          "Error",
          error.error || "Failed to fetch checklists",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error fetching checklists:", error);
      showAlert(
        "Error",
        "An error occurred while fetching checklists",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleView = (checklist) => {
    setSelectedChecklist(checklist);
    setViewDialogOpen(true);
  };

  const handleEdit = (checklist) => {
    setSelectedChecklist(checklist);
    setEditDialogOpen(true);
  };

  const handleDelete = (checklist) => {
    setSelectedChecklist(checklist);
    setDeleteDialogOpen(true);
  };

  const getFrequencyBadgeVariant = (frequency) => {
    const variants = {
      Daily: "default",
      Weekly: "secondary",
      Monthly: "outline",
      Quarterly: "outline",
      Annually: "outline",
    };
    return variants[frequency] || "outline";
  };

  const filteredChecklists = checklists.filter((checklist) => {
    const matchesSearch =
      `${checklist.deviceName} ${checklist.serialNumber} ${checklist.manufacturer} ${checklist.deviceIdNumber} ${checklist.responsiblePerson} ${checklist.location} ${checklist.maintenanceType}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesFrequency =
      filterFrequency === "all" || checklist.taskFrequency === filterFrequency;

    const matchesMaintenanceType =
      filterMaintenanceType === "all" ||
      checklist.maintenanceType === filterMaintenanceType;

    return matchesSearch && matchesFrequency && matchesMaintenanceType;
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>PM Checklists</CardTitle>
              <CardDescription>
                Manage preventive maintenance checklists for devices
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Checklist
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search checklists by device name, serial number, maintenance type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="flex gap-4">
              <Select
                value={filterFrequency}
                onValueChange={setFilterFrequency}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frequencies</SelectItem>
                  <SelectItem value="Daily">Daily</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="Annually">Annually</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterMaintenanceType}
                onValueChange={setFilterMaintenanceType}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Filter by maintenance type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Maintenance Types</SelectItem>
                  <SelectItem value="Hardware Maintenance">
                    Hardware Maintenance
                  </SelectItem>
                  <SelectItem value="Software Maintenance">
                    Software Maintenance
                  </SelectItem>
                  <SelectItem value="Storage Maintenance">
                    Storage Maintenance
                  </SelectItem>
                  <SelectItem value="Network and Connectivity">
                    Network and Connectivity
                  </SelectItem>
                  <SelectItem value="Power Source">Power Source</SelectItem>
                  <SelectItem value="Performance and Optimization">
                    Performance and Optimization
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading checklists...
            </div>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device Name</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Maintenance Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Responsible Person</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChecklists.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {searchTerm ||
                        filterFrequency !== "all" ||
                        filterMaintenanceType !== "all"
                          ? "No checklists found matching your filters"
                          : "No checklists found. Create your first checklist to get started."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredChecklists.map((checklist) => (
                      <TableRow
                        key={checklist.id}
                        className="hover:bg-muted/50"
                      >
                        <TableCell className="font-medium text-foreground">
                          {checklist.deviceName}
                        </TableCell>
                        <TableCell className="text-foreground">
                          <Badge variant="outline">
                            {checklist.serialNumber}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {checklist.maintenanceType}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getFrequencyBadgeVariant(
                              checklist.taskFrequency,
                            )}
                          >
                            {checklist.taskFrequency}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {checklist.responsiblePerson}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {checklist.location}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatPhilippineDateTime(checklist.createdAt, {
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
                              onClick={() => handleView(checklist)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(checklist)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(checklist)}
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

      <CreateChecklistDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchChecklists}
      />

      <ViewChecklistDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        checklist={selectedChecklist}
      />

      <EditChecklistDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        checklist={selectedChecklist}
        onSuccess={fetchChecklists}
      />

      <DeleteChecklistDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        checklist={selectedChecklist}
        onSuccess={fetchChecklists}
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

export default PMChecklistManagement;
