import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isStaff } from "@/lib/rbac";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(isStaff(session.role) ? "/dashboard" : "/portal");
}
