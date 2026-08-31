export const ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
  SUPERADMIN: "superadmin",
});

export const ADMIN_ROLES = Object.freeze([ROLES.ADMIN, ROLES.SUPERADMIN]);

export const PERMISSIONS = Object.freeze({
  ADMIN_DASHBOARD_READ: "admin.dashboard.read",
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

const adminPermissions = Object.freeze([
  PERMISSIONS.ADMIN_DASHBOARD_READ,
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_UPDATE,
  PERMISSIONS.USERS_SUSPEND,
  PERMISSIONS.USERS_DELETE,
  PERMISSIONS.ADMINS_READ,
  PERMISSIONS.ADMIN_REQUESTS_CREATE,
  PERMISSIONS.INCIDENTS_READ,
  PERMISSIONS.INCIDENTS_CREATE_VERIFIED,
  PERMISSIONS.INCIDENTS_APPROVE,
  PERMISSIONS.INCIDENTS_REJECT,
  PERMISSIONS.INCIDENTS_UPDATE,
  PERMISSIONS.INCIDENTS_MERGE,
  PERMISSIONS.POSTS_MODERATE,
  PERMISSIONS.COMMENTS_MODERATE,
  PERMISSIONS.AUDIT_READ_OWN,
  PERMISSIONS.SESSIONS_REVOKE,
]);

const superadminPermissions = Object.freeze([
  ...adminPermissions,
  PERMISSIONS.ADMINS_UPDATE,
  PERMISSIONS.ADMINS_PROMOTE,
  PERMISSIONS.ADMINS_DEMOTE,
  PERMISSIONS.ADMINS_SUSPEND,
  PERMISSIONS.ADMIN_REQUESTS_READ,
  PERMISSIONS.ADMIN_REQUESTS_RESOLVE,
  PERMISSIONS.AUDIT_READ_ALL,
  PERMISSIONS.SETTINGS_READ,
  PERMISSIONS.SETTINGS_UPDATE,
  PERMISSIONS.AGENT_CONTROL,
]);

const rolePermissions = Object.freeze({
  [ROLES.USER]: Object.freeze([PERMISSIONS.ADMIN_REQUESTS_CREATE]),
  [ROLES.ADMIN]: adminPermissions,
  [ROLES.SUPERADMIN]: superadminPermissions,
});

const knownPermissions = new Set(Object.values(PERMISSIONS));

export function isAdministrativeRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function permissionsForRole(role) {
  return [...(rolePermissions[role] ?? [])];
}

export function hasPermission(role, permission) {
  return Boolean(
    knownPermissions.has(permission) &&
      rolePermissions[role]?.includes(permission),
  );
}

export function assertKnownPermission(permission) {
  if (!knownPermissions.has(permission)) {
    throw new TypeError(`Permiso administrativo desconocido: ${permission}`);
  }
  return permission;
}
