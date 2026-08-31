import { apiRequest } from "@/lib/api/api-client";
import { endpoints } from "@/lib/api/endpoints";

import { sessionSchema } from "../schemas/auth.schema";
import { clearAccessToken, setAccessToken } from "../state/access-token-vault";

function acceptSession(data) {
  const session = sessionSchema.parse(data);
  setAccessToken(session.accessToken);
  return session;
}

export const authService = Object.freeze({
  async login(input) {
    const result = await apiRequest(endpoints.auth.login, {
      method: "POST",
      body: input,
      auth: false,
    });
    return acceptSession(result.data);
  },
  async register(input) {
    const result = await apiRequest(endpoints.auth.register, {
      method: "POST",
      body: input,
      auth: false,
    });
    return acceptSession(result.data);
  },
  async me() {
    const result = await apiRequest(endpoints.auth.me);
    return result.data;
  },
  async logout() {
    try {
      await apiRequest(endpoints.auth.logout, {
        method: "POST",
        retryAuth: false,
      });
    } finally {
      clearAccessToken();
    }
  },
});
