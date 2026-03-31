"use client";
import { useState, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { formatPhilippineDateTime } from "@/lib/dateUtils";
import AuditDetailDialog from "@/components/settings/AuditDetailDialog";

// ── Helpers ────────────────────────────────────────────────────────────────

const ACTION_META = {
  CREATE: {
    label: "Create",
    variant: "default",
    className: "bg-green-600 hover:bg-green-700 text-white",
  },
  UPDATE: {
    label: "Update",
    variant: "secondary",
    className: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  DELETE: {
    label: "Delete",
    variant: "destructive",
    className: "bg-red-600 hover:bg-red-700 text-white",
  },
  LOGIN: {
    label: "Login",
    variant: "outline",
    className: "border-violet-500 text-violet-600",
  },
  LOGOUT: {
    label: "Logout",
    variant: "outline",
    className: "border-slate-400 text-slate-500",
  },
};

const ENTITY_LABELS = {
  pm_log: "PM Log",
  pm_log_task: "PM Log Task",
  pm_checklist: "PM Checklist",
  pm_checklist_task: "Checklist Task",
  device: "Device",
  user: "User",
  user_profile_picture: "Profile Picture",
  qr_token: "QR Token",
  qr_token_cleanup: "QR Cleanup",
  auth: "Auth",
};

function ActionBadge({ action }) {
  const meta = ACTION_META[action] ?? {
    label: action,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <Badge className={`text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

const AuditTrail = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 15;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;

      const params = new URLSearchParams({
        page,
        limit: LIMIT,
        ...(actionFilter && { action: actionFilter }),
        ...(entityFilter && { entity: entityFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const response = await authService.fetchWithAuth(
        `${baseUrl}/api/audit?${params.toString()}`,
      );

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, entityFilter, startDate, endDate]);

  useEffect(() => {
    if (isAdmin) fetchLogs();
  }, [fetchLogs, isAdmin]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [actionFilter, entityFilter, startDate, endDate]);

  const handleView = (log) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  const handleRefresh = () => fetchLogs();

  // Client-side username search on top of server-side filters
  const filteredLogs = logs.filter((log) =>
    search
      ? log.username?.toLowerCase().includes(search.toLowerCase()) ||
        log.entity?.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  // ── Access guard ─────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Access Denied
          </CardTitle>
          <CardDescription>
            Only administrators can view the audit trail.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>
                A complete record of all create, update, and delete actions
                performed in the system
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Filter Bar ──────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user or entity..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Action filter */}
            <Select
              value={actionFilter || "all"}
              onValueChange={(v) => setActionFilter(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
                <SelectItem value="LOGIN">Login</SelectItem>
                <SelectItem value="LOGOUT">Logout</SelectItem>
              </SelectContent>
            </Select>

            {/* Entity filter */}
            <Select
              value={entityFilter || "all"}
              onValueChange={(v) => setEntityFilter(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date range */}
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[155px]"
              placeholder="Start date"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[155px]"
              placeholder="End date"
            />

            {/* Clear filters */}
            {(actionFilter ||
              entityFilter ||
              startDate ||
              endDate ||
              search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActionFilter("");
                  setEntityFilter("");
                  setStartDate("");
                  setEndDate("");
                  setSearch("");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* ── Results summary ─────────────────────────────────────────── */}
          <p className="text-xs text-muted-foreground">
            Showing {filteredLogs.length} of {total} total records
          </p>

          {/* ── Table ───────────────────────────────────────────────────── */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading audit logs...
            </div>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-10 text-muted-foreground"
                      >
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/50">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatPhilippineDateTime(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-sm text-foreground">
                            {log.username}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ActionBadge action={log.action} />
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {ENTITY_LABELS[log.entity] ?? log.entity}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">
                          {log.entity_id ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {log.ip_address ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleView(log)}
                            disabled={!log.old_value && !log.new_value}
                            title={
                              !log.old_value && !log.new_value
                                ? "No snapshot data"
                                : "View changes"
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ── Pagination ──────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AuditDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        log={selectedLog}
      />
    </>
  );
};

export default AuditTrail;
