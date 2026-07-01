import db from "../database.js";

// ── IP masking ─────────────────────────────────────────────────────────────
// Masks the 3rd and 4th octets of IPv4 addresses
// e.g. 192.168.1.45 → 192.168.xxx.xxx
function maskIp(ip) {
  if (!ip) return null;

  // Strip IPv4-mapped IPv6 prefix (e.g. "::ffff:192.168.1.100" → "192.168.1.100")
  const raw = ip.replace(/^::ffff:/i, "");

  // IPv4 — mask 3rd and 4th octets
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) {
    return raw.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.xxx.xxx");
  }

  // IPv6 — mask last and 3rd-to-last groups
  if (raw.includes(":")) {
    const parts = raw.split(":");
    parts[parts.length - 1] = "xxx";
    parts[parts.length - 3] = "xxx";
    return parts.join(":");
  }

  return "xxx.xxx.xxx.xxx"; // fallback
}

export function logAudit({
  userId,
  username,
  action,
  entity,
  entityId,
  oldValue,
  newValue,
  ip,
}) {
  try {
    db.prepare(
      `
      INSERT INTO audit_logs (user_id, username, action, entity, entity_id, old_value, new_value, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      userId,
      username,
      action,
      entity,
      entityId ?? null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      maskIp(ip),
    );
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
}

export function auditMiddleware(action, entity) {
  return (req, res, next) => {
    // Only audit authenticated users (skip QR access)
    if (!req.user) return next();

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId =
          body?.log?.id ??
          body?.task?.id ??
          body?.device?.id ??
          body?.checklist?.id ??
          body?.user?.id ??
          req.params?.id ??
          null;

        logAudit({
          userId: req.user.id,
          username: req.user.username,
          action,
          entity,
          entityId,
          oldValue: null,
          newValue:
            body?.log ??
            body?.task ??
            body?.device ??
            body?.checklist ??
            body?.user ??
            null,
          ip: req.ip,
        });
      }
      return originalJson(body);
    };
    next();
  };
}