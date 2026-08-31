import { AuthGate } from "@/features/auth/components/AuthGate";

export const metadata = {
  title: "Mi cuenta",
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }) {
  return <AuthGate>{children}</AuthGate>;
}
