import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasCurrentLegalAcceptance } from "@/lib/legal";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasCurrentLegalAcceptance(user.legalAcceptances)) redirect("/legal-consent");
  return children;
}
