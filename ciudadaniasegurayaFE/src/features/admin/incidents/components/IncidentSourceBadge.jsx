import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";

export function IncidentSourceBadge({ submissionSource }) {
  if (submissionSource !== "ai_scraper") {
    return null;
  }

  return (
    <AdminStatusBadge status="pending" className="whitespace-nowrap">
      IA · SCRAPING
    </AdminStatusBadge>
  );
}
