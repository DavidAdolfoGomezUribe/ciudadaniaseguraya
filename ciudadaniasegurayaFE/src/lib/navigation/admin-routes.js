import { publicEnv } from "@/lib/validation/env.schema";

export const adminRoutes = Object.freeze({
  login: publicEnv.adminLoginPath,
  dashboard: publicEnv.adminDashboardPath,
  users: `${publicEnv.adminDashboardPath}/users`,
  user: (userId) => `${publicEnv.adminDashboardPath}/users/${userId}`,
  administrators: `${publicEnv.adminDashboardPath}/administrators`,
  administrator: (adminId) =>
    `${publicEnv.adminDashboardPath}/administrators/${adminId}`,
  adminRequests: `${publicEnv.adminDashboardPath}/admin-requests`,
  incidents: `${publicEnv.adminDashboardPath}/incidents`,
  incident: (incidentId) => `${publicEnv.adminDashboardPath}/incidents/${incidentId}`,
  posts: `${publicEnv.adminDashboardPath}/posts`,
  comments: `${publicEnv.adminDashboardPath}/comments`,
  audit: `${publicEnv.adminDashboardPath}/audit`,
  settings: `${publicEnv.adminDashboardPath}/settings`,
  agent: `${publicEnv.adminDashboardPath}/agent`,
});

export function isAdministrativePath(pathname = "") {
  return (
    pathname === adminRoutes.login ||
    pathname === adminRoutes.dashboard ||
    pathname.startsWith(`${adminRoutes.dashboard}/`)
  );
}
