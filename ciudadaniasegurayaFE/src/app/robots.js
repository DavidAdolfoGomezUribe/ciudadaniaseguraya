export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/login/admin"] }],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
