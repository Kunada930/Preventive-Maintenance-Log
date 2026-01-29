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
import { Plus, Search, Eye, Trash2, Edit, FileText } from "lucide-react";
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
import CreatePMLogDialog from "./createPmLogDialog";
import ViewPMLogDialog from "./viewPmLogDialog";
import EditPMLogDialog from "./editPmLogDialog";
import DeletePMLogDialog from "./deletePmLogDialog";
import AlertDialogComponent from "@/components/AlertDialog";
import { formatPhilippineDateTime } from "@/lib/dateUtils";

const PMLogManagement = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState({
    start: "",
    end: "",
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
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
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;

      // Build query params
      const params = new URLSearchParams();
      if (filterDateRange.start)
        params.append("startDate", filterDateRange.start);
      if (filterDateRange.end) params.append("endDate", filterDateRange.end);
      if (filterStatus !== "all")
        params.append("fullyFunctional", filterStatus);

      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/pm-logs?${params.toString()}`,
      );

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        const error = await response.json();
        showAlert(
          "Error",
          error.error || "Failed to fetch PM logs",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error fetching PM logs:", error);
      showAlert(
        "Error",
        "An error occurred while fetching PM logs",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleView = (log) => {
    setSelectedLog(log);
    setViewDialogOpen(true);
  };

  const handleEdit = (log) => {
    setSelectedLog(log);
    setEditDialogOpen(true);
  };

  const handleDelete = (log) => {
    setSelectedLog(log);
    setDeleteDialogOpen(true);
  };

  const handleApplyFilters = () => {
    fetchLogs();
  };

  const handleClearFilters = () => {
    setFilterStatus("all");
    setFilterDateRange({ start: "", end: "" });
    setSearchTerm("");
  };

  const getStatusBadgeVariant = (status) => {
    return status === "Yes" ? "default" : "destructive";
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      `${log.deviceName} ${log.serialNumber} ${log.manufacturer} ${log.performedBy}`
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
              <CardTitle>PM Logs</CardTitle>
              <CardDescription>
                View and manage preventive maintenance execution logs
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create PM Log
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by device name, serial number, performed by..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-1.5 block">
                  Status
                </label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Yes">Fully Functional</SelectItem>
                    <SelectItem value="No">Not Functional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-1.5 block">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={filterDateRange.start}
                  onChange={(e) =>
                    setFilterDateRange((prev) => ({
                      ...prev,
                      start: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-1.5 block">
                  End Date
                </label>
                <Input
                  type="date"
                  value={filterDateRange.end}
                  onChange={(e) =>
                    setFilterDateRange((prev) => ({
                      ...prev,
                      end: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleApplyFilters} variant="default">
                  Apply Filters
                </Button>
                <Button onClick={handleClearFilters} variant="outline">
                  Clear
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading PM logs...
            </div>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Device Name</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead>Validated By</TableHead>
                    <TableHead>Recommendation</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {searchTerm ||
                        filterStatus !== "all" ||
                        filterDateRange.start ||
                        filterDateRange.end
                          ? "No PM logs found matching your filters"
                          : "No PM logs found. Create your first log to get started."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-foreground">
                          {formatPhilippineDateTime(log.date, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {log.deviceName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.serialNumber}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusBadgeVariant(log.fullyFunctional)}
                          >
                            {log.fullyFunctional === "Yes"
                              ? "Functional"
                              : "Not Functional"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.performedBy}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.validatedBy || "N/A"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {log.recommendation || "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(log)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(log)}
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

      <CreatePMLogDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchLogs}
      />

      <ViewPMLogDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        log={selectedLog}
      />

      <EditPMLogDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        log={selectedLog}
        onSuccess={fetchLogs}
      />

      <DeletePMLogDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        log={selectedLog}
        onSuccess={fetchLogs}
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

export default PMLogManagement;
