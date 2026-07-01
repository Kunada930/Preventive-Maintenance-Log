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
import { Plus, Search, Edit, Trash2, Eye, LockOpen, Lock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import CreateUserDialog from "./CreateUserDialog";
import EditUserDialog from "./EditUserDialog";
import ViewUserDialog from "./ViewUserDialog";
import DeleteUserDialog from "./DeleteUserDialog";
import AlertDialogComponent from "@/components/AlertDialog";
import { formatPhilippineDateTime } from "@/lib/dateUtils";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

/** Returns true if the user's lockout window is still in the future */
function isUserLocked(user) {
  if (!user?.lockedUntil) return false;
  return new Date(user.lockedUntil) > new Date();
}

const AccountManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unlockingId, setUnlockingId] = useState(null); // tracks in-progress unlock
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [alertDialog, setAlertDialog] = useState({
    open: false,
    title: "",
    description: "",
    variant: "default",
  });

  const isAdmin = currentUser?.role === "admin";

  const showAlert = (title, description, variant = "default") => {
    setAlertDialog({ open: true, title, description, variant });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await authService.fetchWithAuth(`${BASE_URL}/api/users`);

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        const error = await response.json();
        showAlert(
          "Error",
          error.error || "Failed to fetch users",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      showAlert(
        "Error",
        "An error occurred while fetching users",
        "destructive",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Unlock handler ──────────────────────────────────────────────────────────
  const handleUnlock = async (user) => {
    setUnlockingId(user.id);
    try {
      const response = await authService.fetchWithAuth(
        `${BASE_URL}/api/users/${user.id}/unlock`,
        { method: "PATCH" },
      );

      const data = await response.json();

      if (response.ok) {
        showAlert(
          "Account Unlocked",
          data.message || `${user.username} has been unlocked.`,
          "default",
        );
        // Refresh the list so the lock badge disappears immediately
        await fetchUsers();
      } else {
        showAlert(
          "Error",
          data.error || "Failed to unlock account.",
          "destructive",
        );
      }
    } catch (error) {
      console.error("Unlock error:", error);
      showAlert(
        "Error",
        "An error occurred while unlocking the account.",
        "destructive",
      );
    } finally {
      setUnlockingId(null);
    }
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };
  const handleView = (user) => {
    setSelectedUser(user);
    setViewDialogOpen(true);
  };
  const handleDelete = (user) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      `${user.firstName} ${user.lastName} ${user.username} ${user.position}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getInitials = (firstName, lastName) =>
    `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You do not have permission to access this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Only administrators can manage user accounts.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Accounts</CardTitle>
              <CardDescription>
                Manage user accounts and their permissions
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* ── Filters ──────────────────────────────────────────────────── */}
          <div className="mb-4 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={roleFilter || "all"}
              onValueChange={(value) =>
                setRoleFilter(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Table ────────────────────────────────────────────────────── */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading users...
            </div>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const locked = isUserLocked(user);
                      const isUnlocking = unlockingId === user.id;

                      return (
                        <TableRow
                          key={user.id}
                          className={`hover:bg-muted/50 ${locked ? "bg-destructive/5" : ""}`}
                        >
                          {/* ── User ────────────────────────────────────── */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage
                                  src={
                                    user.profilePicture
                                      ? `${BASE_URL}/${user.profilePicture}`
                                      : undefined
                                  }
                                  className="object-cover"
                                />
                                <AvatarFallback>
                                  {getInitials(user.firstName, user.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="font-medium text-foreground">
                                {user.firstName} {user.middleName}{" "}
                                {user.lastName}
                              </div>
                            </div>
                          </TableCell>

                          {/* ── Username ────────────────────────────────── */}
                          <TableCell className="text-foreground">
                            {user.username}
                          </TableCell>

                          {/* ── Position ────────────────────────────────── */}
                          <TableCell className="text-muted-foreground">
                            {user.position}
                          </TableCell>

                          {/* ── Role ────────────────────────────────────── */}
                          <TableCell>
                            <Badge
                              variant={
                                user.role === "admin" ? "default" : "secondary"
                              }
                            >
                              {user.role}
                            </Badge>
                          </TableCell>

                          {/* ── Lock status ─────────────────────────────── */}
                          <TableCell>
                            {locked ? (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="destructive"
                                      className="gap-1 cursor-default"
                                    >
                                      <Lock className="w-3 h-3" />
                                      Locked
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    Locked until{" "}
                                    {formatPhilippineDateTime(
                                      user.lockedUntil,
                                      {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                      },
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-muted-foreground"
                              >
                                Active
                              </Badge>
                            )}
                          </TableCell>

                          {/* ── Created ─────────────────────────────────── */}
                          <TableCell className="text-muted-foreground">
                            {formatPhilippineDateTime(user.createdAt, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </TableCell>

                          {/* ── Actions ─────────────────────────────────── */}
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleView(user)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEdit(user)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              {/* Unlock button — only visible for locked accounts */}
                              {locked && (
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleUnlock(user)}
                                        disabled={isUnlocking}
                                        className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10"
                                      >
                                        {isUnlocking ? (
                                          <span className="w-4 h-4 border-2 border-yellow-600/30 border-t-yellow-600 rounded-full animate-spin" />
                                        ) : (
                                          <LockOpen className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Unlock account
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDelete(user)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchUsers}
      />
      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onSuccess={fetchUsers}
      />
      <ViewUserDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        user={selectedUser}
      />
      <DeleteUserDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        user={selectedUser}
        onSuccess={fetchUsers}
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

export default AccountManagement;
