"use client";

import { useAdminSession } from "@/features/admin/auth/components/AdminSessionProvider";
import {
  hasEveryPermission,
  hasSomePermission,
} from "@/features/admin/permissions/admin-permissions";

export function PermissionGate({ all = [], any = [], fallback = null, children }) {
  const { permissions } = useAdminSession();
  const allowed =
    hasEveryPermission(permissions, all) && hasSomePermission(permissions, any);
  return allowed ? children : fallback;
}
