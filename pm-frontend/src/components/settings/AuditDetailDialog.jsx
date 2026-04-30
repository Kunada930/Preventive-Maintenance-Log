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
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPhilippineDateTime } from "@/lib/dateUtils";

const ACTION_META = {
  CREATE: { label: "Create", className: "bg-green-600 text-white" },
  UPDATE: { label: "Update", className: "bg-blue-600 text-white" },
  DELETE: { label: "Delete", className: "bg-red-600 text-white" },
  LOGIN: { label: "Login", className: "border-violet-500 text-violet-600" },
  LOGOUT: { label: "Logout", className: "border-slate-400 text-slate-500" },
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

// ── IP masking ─────────────────────────────────────────────────────────────
// Masks the 3rd and 4th octets of IPv4 addresses
// e.g. 192.168.1.45 → 192.168.xxx.xxx
function maskIp(ip) {
  if (!ip) return "—";
  const raw = ip.replace(/^::ffff:/i, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) {
    return raw.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.xxx.xxx");
  }
  if (raw.includes(":")) {
    const parts = raw.split(":");
    parts[parts.length - 1] = "xxx";
    parts[parts.length - 3] = "xxx";
    return parts.join(":");
  }
  return "xxx.xxx.xxx.xxx";
}

// Renders a single key-value field, highlighting changed values
function FieldRow({ label, oldVal, newVal, changed }) {
  const fmt = (v) => {
    if (v === null || v === undefined)
      return <span className="text-muted-foreground italic">—</span>;
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v === "object")
      return (
        <pre className="whitespace-pre-wrap text-xs">
          {JSON.stringify(v, null, 2)}
        </pre>
      );
    return String(v);
  };

  return (
    <div
      className={`grid grid-cols-3 gap-2 py-2 px-3 rounded-md text-sm ${changed ? "bg-yellow-500/10 border border-yellow-500/20" : ""}`}
    >
      <span className="font-medium text-muted-foreground capitalize col-span-1 truncate">
        {label.replace(/_/g, " ")}
      </span>
      <span
        className={`col-span-1 ${changed ? "line-through text-red-500/70" : "text-foreground"}`}
      >
        {fmt(oldVal)}
      </span>
      <span
        className={`col-span-1 ${changed ? "text-green-600 font-medium" : "text-foreground"}`}
      >
        {fmt(newVal)}
      </span>
    </div>
  );
}

// Build a unified diff between old and new objects
function buildDiff(oldObj, newObj) {
  const allKeys = new Set([
    ...Object.keys(oldObj ?? {}),
    ...Object.keys(newObj ?? {}),
  ]);

  // Skip noisy / irrelevant keys
  const SKIP = new Set(["createdAt", "updatedAt", "created_at", "updated_at"]);

  return [...allKeys]
    .filter((k) => !SKIP.has(k))
    .map((key) => {
      const oldVal = oldObj?.[key] ?? null;
      const newVal = newObj?.[key] ?? null;
      const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
      return { key, oldVal, newVal, changed };
    });
}

const AuditDetailDialog = ({ open, onOpenChange, log }) => {
  if (!log) return null;

  const meta = ACTION_META[log.action] ?? {
    label: log.action,
    className: "bg-muted",
  };
  const hasData = log.old_value || log.new_value;
  const diff = hasData ? buildDiff(log.old_value, log.new_value) : [];
  const changedCount = diff.filter((d) => d.changed).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Audit Entry #{log.id}
            <Badge className={`text-xs ${meta.className}`}>{meta.label}</Badge>
          </DialogTitle>
          <DialogDescription>
            Detailed record of the change event
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-5">
            {/* ── Event Metadata ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Performed By</p>
                <p className="font-medium text-foreground">{log.username}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Timestamp</p>
                <p className="font-medium text-foreground">
                  {formatPhilippineDateTime(log.created_at)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entity</p>
                <p className="font-medium text-foreground">
                  {ENTITY_LABELS[log.entity] ?? log.entity}
                  {log.entity_id && (
                    <span className="ml-1 text-muted-foreground font-mono text-xs">
                      #{log.entity_id}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">IP Address</p>
                <p className="font-mono text-foreground">
                  {log.ip_address ?? "—"}
                </p>
              </div>
            </div>

            {/* ── Diff Table ─────────────────────────────────────────────── */}
            {hasData && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-foreground">
                      Changes
                    </p>
                    {changedCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {changedCount} field{changedCount !== 1 ? "s" : ""}{" "}
                        changed
                      </Badge>
                    )}
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-3 gap-2 px-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Field</span>
                    <span>{log.action === "CREATE" ? "—" : "Before"}</span>
                    <span>{log.action === "DELETE" ? "—" : "After"}</span>
                  </div>

                  <div className="space-y-1">
                    {diff.map(({ key, oldVal, newVal, changed }) => (
                      <FieldRow
                        key={key}
                        label={key}
                        oldVal={oldVal}
                        newVal={newVal}
                        changed={changed}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── No data state ─────────────────────────────────────────── */}
            {!hasData && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No snapshot data available for this event.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default AuditDetailDialog;