import { adminSessionSchema, adminUserSchema } from "../schemas/admin-auth.schema";
import {
  clearAdminAccessToken,
  setAdminAccessToken,
} from "../state/admin-access-token-vault";
import { adminApiRequest } from "@/lib/api/admin-api-client";
import { endpoints } from "@/lib/api/endpoints";

function acceptSession(data) {
  const session = adminSessionSchema.parse(data);
  setAdminAccessToken(session.accessToken);
  return session;
}

export const adminAuthService = Object.freeze({
  async login(input) {
    const result = await adminApiRequest(endpoints.admin.auth.login, {
      method: "POST",
      body: input,
      auth: false,
    });
    return acceptSession(result.data);
  },
  async me() {
    const result = await adminApiRequest(endpoints.admin.auth.me);
    return adminUserSchema.parse(result.data);
  },
  async logout() {
    try {
      await adminApiRequest(endpoints.admin.auth.logout, {
        method: "POST",
        retryAuth: false,
      });
    } finally {
      clearAdminAccessToken();
    }
  },
  async logoutAll() {
    try {
      await adminApiRequest(endpoints.admin.auth.logoutAll, {
        method: "POST",
        retryAuth: false,
      });
    } finally {
      clearAdminAccessToken();
    }
  },
});
