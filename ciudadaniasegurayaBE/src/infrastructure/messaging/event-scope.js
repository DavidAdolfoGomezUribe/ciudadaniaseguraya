const alwaysPublicEventTypes = new Set([
  "incident.community_confirmed",
  "incident.admin_verified",
  "heatmap.updated",
  "post.created",
  "post.updated",
  "comment.created",
  "comment.updated",
]);

const publicIncidentStatuses = new Set([
  "community_confirmed",
  "admin_verified",
]);

export function isAdministrativeRealtimeEvent(event) {
  return event.type.startsWith("admin.");
}

export function isPublicRealtimeEvent(event) {
  if (isAdministrativeRealtimeEvent(event)) {
    return false;
  }
  if (alwaysPublicEventTypes.has(event.type)) {
    return true;
  }
  return (
    event.type === "incident.updated" &&
    publicIncidentStatuses.has(event.data?.status)
  );
}
