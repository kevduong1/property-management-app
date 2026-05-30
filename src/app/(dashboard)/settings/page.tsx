import { requireSession } from "@/lib/auth";
import { db } from "@/db";
import {
  expenseCategories,
  userRoles,
  users,
  vendors,
  parentLlcs,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { roleLabels, expenseCategoryLabels } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  const orgId = session.organizationId;

  const [parentLlcRows, orgUsers, categories, orgVendors] = await Promise.all([
    db
      .select()
      .from(parentLlcs)
      .where(eq(parentLlcs.organizationId, orgId))
      .limit(1),

    // Join user_roles + users for the org to get role + user info.
    db
      .select({
        userId: userRoles.userId,
        role: userRoles.role,
        fullName: users.fullName,
        email: users.email,
        createdAt: userRoles.createdAt,
      })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(eq(userRoles.organizationId, orgId))
      .orderBy(users.fullName),

    db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.organizationId, orgId))
      .orderBy(expenseCategories.name),

    db
      .select()
      .from(vendors)
      .where(eq(vendors.organizationId, orgId))
      .orderBy(vendors.name),
  ]);

  const parentLlc = parentLlcRows[0] ?? null;

  const roleTones: Record<
    string,
    "default" | "success" | "info" | "warning" | "muted"
  > = {
    owner: "default",
    manager: "success",
    bookkeeper: "info",
    tenant: "muted",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description={`Organization: ${session.organizationName}`}
      />

      {/* Organization & Parent LLC */}
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            Your organization and parent LLC details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <dt className="text-muted-foreground">Organization name</dt>
            <dd className="font-medium">{session.organizationName}</dd>

            {parentLlc ? (
              <>
                <dt className="text-muted-foreground">Parent LLC name</dt>
                <dd className="font-medium">{parentLlc.name}</dd>

                {parentLlc.ein ? (
                  <>
                    <dt className="text-muted-foreground">EIN</dt>
                    <dd className="font-mono">{parentLlc.ein}</dd>
                  </>
                ) : null}

                {parentLlc.stateOfFormation ? (
                  <>
                    <dt className="text-muted-foreground">State of formation</dt>
                    <dd>{parentLlc.stateOfFormation}</dd>
                  </>
                ) : null}

                {parentLlc.notes ? (
                  <>
                    <dt className="text-muted-foreground">Notes</dt>
                    <dd className="whitespace-pre-line">{parentLlc.notes}</dd>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <dt className="text-muted-foreground">Parent LLC</dt>
                <dd className="text-muted-foreground italic">
                  No parent LLC configured.
                </dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Users & roles */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Users with access to this organization. Editing coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {orgUsers.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No users found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgUsers.map((u) => (
                  <TableRow key={u.userId}>
                    <TableCell className="font-medium">
                      {u.fullName ?? "—"}
                      {u.userId === session.userId ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (you)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge tone={roleTones[u.role] ?? "muted"}>
                        {roleLabels[u.role]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Expense categories */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Categories</CardTitle>
          <CardDescription>
            Categories used to classify expenses. Editing coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {categories.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No expense categories configured.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Capital?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {expenseCategoryLabels[cat.kind]}
                    </TableCell>
                    <TableCell>
                      {cat.isCapital ? (
                        <Badge tone="info">Capital</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">No</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Vendors */}
      <Card>
        <CardHeader>
          <CardTitle>Vendors</CardTitle>
          <CardDescription>
            Service vendors used for expenses and maintenance. Editing coming
            soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {orgVendors.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No vendors configured.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgVendors.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.contactName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.phone ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
