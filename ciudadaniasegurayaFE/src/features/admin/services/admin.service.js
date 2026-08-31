import { adminApiRequest } from "@/lib/api/admin-api-client";
import { endpoints } from "@/lib/api/endpoints";

import { adminQueryString, normalizeAdminPage } from "../shared/admin-data";

async function list(path, params, signal) {
  const query = adminQueryString(params);
  const result = await adminApiRequest(query ? `${path}?${query}` : path, { signal });
  return normalizeAdminPage(result);
}

async function detail(path, signal) {
  const result = await adminApiRequest(path, { signal });
  return result.data;
}

async function action(path, { method = "POST", body } = {}) {
  const result = await adminApiRequest(path, { method, body });
  return result?.data ?? null;
}

export const adminService = Object.freeze({
  dashboard: {
    get: (signal) => detail(endpoints.admin.dashboard, signal),
  },
  users: {
    list: (params, signal) => list(endpoints.admin.users.list, params, signal),
    detail: (userId, signal) => detail(endpoints.admin.users.detail(userId), signal),
    update: (userId, body) =>
      action(endpoints.admin.users.update(userId), { method: "PATCH", body }),
    suspend: (userId, body) => action(endpoints.admin.users.suspend(userId), { body }),
    reactivate: (userId, body) =>
      action(endpoints.admin.users.reactivate(userId), { body }),
    remove: (userId, body) =>
      action(endpoints.admin.users.remove(userId), { method: "DELETE", body }),
    revokeSessions: (userId, body) =>
      action(endpoints.admin.users.revokeSessions(userId), { body }),
    promote: (userId, body) => action(endpoints.admin.users.promote(userId), { body }),
  },
  administrators: {
    list: (params, signal) => list(endpoints.admin.administrators.list, params, signal),
    detail: (adminId, signal) =>
      detail(endpoints.admin.administrators.detail(adminId), signal),
    demote: (adminId, body) =>
      action(endpoints.admin.administrators.demote(adminId), { body }),
    suspend: (adminId, body) =>
      action(endpoints.admin.administrators.suspend(adminId), { body }),
    reactivate: (adminId, body) =>
      action(endpoints.admin.administrators.reactivate(adminId), { body }),
    revokeSessions: (adminId, body) =>
      action(endpoints.admin.administrators.revokeSessions(adminId), { body }),
  },
  adminRequests: {
    list: (params, signal) => list(endpoints.admin.adminRequests.list, params, signal),
    mine: (params, signal) => list(endpoints.admin.adminRequests.mine, params, signal),
    detail: (requestId, signal) =>
      detail(endpoints.admin.adminRequests.detail(requestId), signal),
    create: (body) => action(endpoints.admin.adminRequests.create, { body }),
    approve: (requestId, body) =>
      action(endpoints.admin.adminRequests.approve(requestId), { body }),
    reject: (requestId, body) =>
      action(endpoints.admin.adminRequests.reject(requestId), { body }),
    requestInformation: (requestId, body) =>
      action(endpoints.admin.adminRequests.requestInformation(requestId), { body }),
  },
  incidents: {
    list: (params, signal) => list(endpoints.admin.incidents.list, params, signal),
    detail: (incidentId, signal) =>
      detail(endpoints.admin.incidents.detail(incidentId), signal),
    approve: (incidentId, body) =>
      action(endpoints.admin.incidents.approve(incidentId), { body }),
    reject: (incidentId, body) =>
      action(endpoints.admin.incidents.reject(incidentId), { body }),
    update: (incidentId, body) =>
      action(endpoints.admin.incidents.update(incidentId), {
        method: "PATCH",
        body,
      }),
    merge: (incidentId, body) =>
      action(endpoints.admin.incidents.merge(incidentId), { body }),
    claimReview: (incidentId, body) =>
      action(endpoints.admin.incidents.reviewLock(incidentId), { body }),
    releaseReview: (incidentId, body) =>
      action(endpoints.admin.incidents.reviewLock(incidentId), {
        method: "DELETE",
        body,
      }),
  },
  posts: {
    list: (params, signal) => list(endpoints.admin.posts.list, params, signal),
    detail: (postId, signal) => detail(endpoints.admin.posts.detail(postId), signal),
    update: (postId, body) =>
      action(endpoints.admin.posts.update(postId), { method: "PATCH", body }),
    hide: (postId, body) => action(endpoints.admin.posts.hide(postId), { body }),
    restore: (postId, body) => action(endpoints.admin.posts.restore(postId), { body }),
    remove: (postId, body) =>
      action(endpoints.admin.posts.remove(postId), { method: "DELETE", body }),
  },
  comments: {
    list: (params, signal) => list(endpoints.admin.comments.list, params, signal),
    detail: (commentId, signal) =>
      detail(endpoints.admin.comments.detail(commentId), signal),
    update: (commentId, body) =>
      action(endpoints.admin.comments.update(commentId), {
        method: "PATCH",
        body,
      }),
    hide: (commentId, body) =>
      action(endpoints.admin.comments.hide(commentId), { body }),
    restore: (commentId, body) =>
      action(endpoints.admin.comments.restore(commentId), { body }),
    remove: (commentId, body) =>
      action(endpoints.admin.comments.remove(commentId), {
        method: "DELETE",
        body,
      }),
  },
  audit: {
    list: (params, signal) => list(endpoints.admin.audit, params, signal),
  },
  settings: {
    get: (signal) => detail(endpoints.admin.settings, signal),
    update: (body) => action(endpoints.admin.settings, { method: "PATCH", body }),
  },
  agent: {
    status: (signal) => detail(endpoints.admin.agent.status, signal),
    start: (body) => action(endpoints.admin.agent.start, { body }),
    cancel: (runId) => action(endpoints.admin.agent.cancel(runId)),
  },
});
