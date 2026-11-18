import { getCurrentUser } from "@/lib/auth";

export async function getPlatformAdmin() {
  const user = await getCurrentUser();
  const allowed = (process.env.ROAM_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!user || !allowed.includes(user.email.toLowerCase())) return null;
  return user;
}
