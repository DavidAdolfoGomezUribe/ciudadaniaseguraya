export const ADMIN_PERMISSIONS = Object.freeze({
  DASHBOARD_READ: "admin.dashboard.read",
  USERS_READ: "users.read",
  USERS_UPDATE: "users.update",
  USERS_SUSPEND: "users.suspend",
  USERS_DELETE: "users.delete",
  ADMINS_READ: "admins.read",
  ADMINS_UPDATE: "admins.update",
  ADMINS_PROMOTE: "admins.promote",
  ADMINS_DEMOTE: "admins.demote",
  ADMINS_SUSPEND: "admins.suspend",
  ADMIN_REQUESTS_CREATE: "adminRequests.create",
  ADMIN_REQUESTS_READ: "adminRequests.read",
  ADMIN_REQUESTS_RESOLVE: "adminRequests.resolve",
  INCIDENTS_READ: "incidents.read",
  INCIDENTS_CREATE_VERIFIED: "incidents.createVerified",
  INCIDENTS_APPROVE: "incidents.approve",
  INCIDENTS_REJECT: "incidents.reject",
  INCIDENTS_UPDATE: "incidents.update",
  INCIDENTS_MERGE: "incidents.merge",
  POSTS_MODERATE: "posts.moderate",
  COMMENTS_MODERATE: "comments.moderate",
  AUDIT_READ_OWN: "audit.readOwn",
  AUDIT_READ_ALL: "audit.readAll",
  SETTINGS_READ: "settings.read",
  SETTINGS_UPDATE: "settings.update",
  SESSIONS_REVOKE: "sessions.revoke",
  AGENT_CONTROL: "agent.control",
});

export function hasEveryPermission(effectivePermissions, required = []) {
  const effective =
    effectivePermissions instanceof Set
      ? effectivePermissions
      : new Set(effectivePermissions || []);
  return required.every((permission) => effective.has(permission));
}

export function hasSomePermission(effectivePermissions, required = []) {
  const effective =
    effectivePermissions instanceof Set
      ? effectivePermissions
      : new Set(effectivePermissions || []);
  return (
    required.length === 0 || required.some((permission) => effective.has(permission))
  );
}
