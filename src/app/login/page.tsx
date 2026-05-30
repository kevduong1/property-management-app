import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { devSwitchUser } from "@/app/actions/context";
import { isSupabaseMode } from "@/lib/auth";
import { roleLabels } from "@/lib/labels";
import type { Role } from "@/db/schema";

const DEV_USERS: { email: string; name: string; role: Role; blurb: string }[] =
  [
    {
      email: "owner@example.com",
      name: "Kevin Duong",
      role: "owner",
      blurb: "Full access to all series, financials, and settings.",
    },
    {
      email: "manager@example.com",
      name: "Maria Manager",
      role: "manager",
      blurb: "Manage properties, tenants, rent, expenses, and maintenance.",
    },
    {
      email: "bookkeeper@example.com",
      name: "Ben Books",
      role: "bookkeeper",
      blurb: "View everything; manage financial records and reports.",
    },
    {
      email: "tenant@example.com",
      name: "Tara Tenant",
      role: "tenant",
      blurb: "Tenant portal: lease, balance, rent history, maintenance.",
    },
  ];

export default function LoginPage() {
  const supabase = isSupabaseMode();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold">SeriesBooks</h1>
          <p className="text-sm text-muted-foreground">
            Bookkeeping-first property management for Series LLCs.
          </p>
        </div>

        {supabase ? (
          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Supabase Auth is enabled. Wire your sign-in form to{" "}
              <code>getSupabaseServerClient()</code>. For the demo, set{" "}
              <code>AUTH_MODE=dev</code>.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Choose a demo account
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Dev mode — pick a role to explore the app.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {DEV_USERS.map((u) => (
                <form key={u.email} action={devSwitchUser.bind(null, u.email)}>
                  <button
                    type="submit"
                    className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-accent"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {u.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{u.name}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {roleLabels[u.role]}
                        </span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {u.blurb}
                      </span>
                    </span>
                  </button>
                </form>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
