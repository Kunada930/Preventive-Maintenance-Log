import db from "../database.js";

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
      ip ?? null,
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
