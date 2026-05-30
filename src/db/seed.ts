/**
 * Seed a realistic family-owned Series LLC dataset so the MVP is demoable
 * immediately. Idempotent-ish: it wipes the business tables first.
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { addMonths, format, subMonths } from "date-fns";
import { sql } from "drizzle-orm";
import { db } from "./index";
import {
  childSeries,
  documents,
  expenseCategories,
  expenses,
  leases,
  maintenanceRequests,
  notes,
  organizations,
  parentLlcs,
  properties,
  rentCharges,
  rentPayments,
  securityDeposits,
  tenantUserLinks,
  tenants,
  units,
  userRoles,
  users,
  vendors,
} from "./schema";
import { computeRentStatus } from "@/lib/rent";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

async function wipe() {
  // Order doesn't matter much with CASCADE, but be explicit.
  const tables = [
    "rent_payments",
    "rent_charges",
    "security_deposits",
    "leases",
    "maintenance_requests",
    "documents",
    "notes",
    "expenses",
    "expense_categories",
    "vendors",
    "tenant_user_links",
    "tenants",
    "units",
    "properties",
    "child_series",
    "parent_llcs",
    "user_roles",
    "users",
    "organizations",
  ];
  for (const t of tables) {
    await db.execute(sql.raw(`DELETE FROM "${t}";`));
  }
}

async function main() {
  console.log("Seeding…");
  await wipe();

  /* Organization ------------------------------------------------------- */
  const [org] = await db
    .insert(organizations)
    .values({ name: "Duong Family Holdings" })
    .returning();
  const organizationId = org.id;

  /* Users + roles ------------------------------------------------------ */
  const [owner] = await db
    .insert(users)
    .values({
      email: "owner@example.com",
      fullName: "Kevin Duong",
      phone: "555-0100",
    })
    .returning();
  const [manager] = await db
    .insert(users)
    .values({ email: "manager@example.com", fullName: "Maria Manager" })
    .returning();
  const [bookkeeper] = await db
    .insert(users)
    .values({ email: "bookkeeper@example.com", fullName: "Ben Books" })
    .returning();
  const [tenantUser] = await db
    .insert(users)
    .values({ email: "tenant@example.com", fullName: "Tara Tenant" })
    .returning();

  await db.insert(userRoles).values([
    { organizationId, userId: owner.id, role: "owner" },
    { organizationId, userId: manager.id, role: "manager" },
    { organizationId, userId: bookkeeper.id, role: "bookkeeper" },
    { organizationId, userId: tenantUser.id, role: "tenant" },
  ]);

  /* Parent LLC + child series ----------------------------------------- */
  const [parent] = await db
    .insert(parentLlcs)
    .values({
      organizationId,
      name: "Duong Holdings Series LLC",
      ein: "88-1234567",
      stateOfFormation: "Texas",
      notes: "Master Series LLC. Each child series isolates one property group.",
    })
    .returning();

  const seriesSpecs = [
    {
      name: "Series A — Maple Street",
      description: "Single-family rentals on the east side.",
      ein: "88-1111111",
      bankAccountNickname: "Maple Operating ••4821",
    },
    {
      name: "Series B — Oak Avenue Duplexes",
      description: "Two duplexes, four units total.",
      ein: "88-2222222",
      bankAccountNickname: "Oak Operating ••7733",
    },
    {
      name: "Series C — Downtown Lofts",
      description: "Small multifamily loft building.",
      ein: null as string | null,
      bankAccountNickname: "Loft Operating ••9090",
    },
  ];
  const seriesRows = await db
    .insert(childSeries)
    .values(
      seriesSpecs.map((s) => ({
        organizationId,
        parentLlcId: parent.id,
        name: s.name,
        description: s.description,
        ein: s.ein ?? undefined,
        bankAccountNickname: s.bankAccountNickname,
        status: "active" as const,
      })),
    )
    .returning();

  /* Expense categories (per-org seed of the standard MVP set) --------- */
  const categoryKinds = [
    ["Repairs", "repairs"],
    ["Utilities", "utilities"],
    ["Insurance", "insurance"],
    ["Property taxes", "property_taxes"],
    ["Mortgage", "mortgage"],
    ["Legal", "legal"],
    ["Accounting", "accounting"],
    ["Supplies", "supplies"],
    ["Capital improvements", "capital_improvements"],
    ["Other", "other"],
  ] as const;
  const categoryRows = await db
    .insert(expenseCategories)
    .values(
      categoryKinds.map(([name, kind]) => ({
        organizationId,
        name,
        kind,
        isCapital: kind === "capital_improvements",
      })),
    )
    .returning();
  const catByKind = Object.fromEntries(
    categoryRows.map((c) => [c.kind, c]),
  );

  /* Vendors ------------------------------------------------------------ */
  const vendorRows = await db
    .insert(vendors)
    .values([
      { organizationId, name: "Rapid Plumbing Co.", phone: "555-0200" },
      { organizationId, name: "City Utilities", phone: "555-0201" },
      { organizationId, name: "SafeGuard Insurance", phone: "555-0202" },
    ])
    .returning();

  /* Properties + units ------------------------------------------------- */
  // Series A: 2 single-family homes.
  const propsA = await db
    .insert(properties)
    .values([
      {
        organizationId,
        childSeriesId: seriesRows[0].id,
        name: "412 Maple St",
        addressLine1: "412 Maple St",
        city: "Austin",
        state: "TX",
        postalCode: "78702",
        status: "active",
      },
      {
        organizationId,
        childSeriesId: seriesRows[0].id,
        name: "418 Maple St",
        addressLine1: "418 Maple St",
        city: "Austin",
        state: "TX",
        postalCode: "78702",
        status: "active",
      },
    ])
    .returning();
  // Series B: 1 duplex (2 units).
  const propsB = await db
    .insert(properties)
    .values([
      {
        organizationId,
        childSeriesId: seriesRows[1].id,
        name: "77 Oak Ave",
        addressLine1: "77 Oak Ave",
        city: "Austin",
        state: "TX",
        postalCode: "78704",
        status: "active",
      },
    ])
    .returning();
  // Series C: loft building (3 units).
  const propsC = await db
    .insert(properties)
    .values([
      {
        organizationId,
        childSeriesId: seriesRows[2].id,
        name: "9 Congress Lofts",
        addressLine1: "9 Congress Ave",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        status: "active",
      },
    ])
    .returning();

  type UnitSpec = {
    property: (typeof propsA)[number];
    seriesId: string;
    label: string;
    rent: number;
    beds: number;
    baths: number;
  };
  const unitSpecs: UnitSpec[] = [
    { property: propsA[0], seriesId: seriesRows[0].id, label: "House", rent: 220000, beds: 3, baths: 20 },
    { property: propsA[1], seriesId: seriesRows[0].id, label: "House", rent: 235000, beds: 3, baths: 25 },
    { property: propsB[0], seriesId: seriesRows[1].id, label: "Unit A", rent: 165000, beds: 2, baths: 10 },
    { property: propsB[0], seriesId: seriesRows[1].id, label: "Unit B", rent: 170000, beds: 2, baths: 10 },
    { property: propsC[0], seriesId: seriesRows[2].id, label: "Loft 1", rent: 195000, beds: 1, baths: 10 },
    { property: propsC[0], seriesId: seriesRows[2].id, label: "Loft 2", rent: 205000, beds: 2, baths: 20 },
    { property: propsC[0], seriesId: seriesRows[2].id, label: "Loft 3", rent: 0, beds: 1, baths: 10 },
  ];
  const unitRows = await db
    .insert(units)
    .values(
      unitSpecs.map((u, i) => ({
        organizationId,
        propertyId: u.property.id,
        childSeriesId: u.seriesId,
        label: u.label,
        monthlyRentCents: u.rent,
        bedrooms: u.beds,
        bathrooms: u.baths,
        // Last loft left vacant to exercise occupancy logic.
        occupancyStatus: (i === unitSpecs.length - 1 ? "vacant" : "occupied") as
          | "vacant"
          | "occupied",
      })),
    )
    .returning();

  /* Tenants ------------------------------------------------------------ */
  const tenantNames = [
    "Tara Tenant",
    "James Renter",
    "Olivia Lease",
    "Marcus Hold",
    "Nina Park",
    "Devon Lease",
  ];
  const tenantRows = await db
    .insert(tenants)
    .values(
      tenantNames.map((name, i) => ({
        organizationId,
        fullName: name,
        email:
          i === 0 ? "tenant@example.com" : `tenant${i}@example.com`,
        phone: `555-03${String(i).padStart(2, "0")}`,
        emergencyContactName: "Family Member",
        emergencyContactPhone: "555-0999",
      })),
    )
    .returning();

  // Link the first tenant to the tenant login user.
  await db.insert(tenantUserLinks).values({
    organizationId,
    tenantId: tenantRows[0].id,
    userId: tenantUser.id,
  });

  /* Leases (one per occupied unit) ------------------------------------ */
  const occupiedUnits = unitRows.filter((u) => u.occupancyStatus === "occupied");
  const leaseRows = await db
    .insert(leases)
    .values(
      occupiedUnits.map((u, i) => ({
        organizationId,
        tenantId: tenantRows[i % tenantRows.length].id,
        unitId: u.id,
        childSeriesId: u.childSeriesId,
        startDate: iso(subMonths(new Date(), 8)),
        endDate: i % 3 === 0 ? null : iso(addMonths(new Date(), 4)),
        monthlyRentCents: u.monthlyRentCents,
        securityDepositCents: u.monthlyRentCents,
        status: (i % 3 === 0 ? "month_to_month" : "active") as
          | "month_to_month"
          | "active",
      })),
    )
    .returning();

  /* Security deposits -------------------------------------------------- */
  await db.insert(securityDeposits).values(
    leaseRows.map((l) => ({
      organizationId,
      childSeriesId: l.childSeriesId,
      leaseId: l.id,
      tenantId: l.tenantId,
      unitId: l.unitId,
      amountCents: l.securityDepositCents,
      receivedDate: l.startDate,
    })),
  );

  /* Rent charges for the last 4 months + payments --------------------- */
  for (const lease of leaseRows) {
    const unit = unitRows.find((u) => u.id === lease.unitId)!;
    for (let m = 3; m >= 0; m--) {
      const due = iso(subMonths(new Date(), m));
      const lateFee = m >= 2 && Math.random() < 0.3 ? 5000 : 0;
      const [charge] = await db
        .insert(rentCharges)
        .values({
          organizationId,
          childSeriesId: lease.childSeriesId,
          propertyId: unit.propertyId,
          unitId: unit.id,
          tenantId: lease.tenantId,
          leaseId: lease.id,
          dueDate: due,
          rentAmountCents: lease.monthlyRentCents,
          lateFeeCents: lateFee,
          status: "unpaid",
        })
        .returning();

      // Payment behavior: older months mostly paid; current month mixed.
      let paidCents = 0;
      const total = charge.rentAmountCents + charge.lateFeeCents;
      if (m >= 1) {
        // Past months: 80% fully paid, 10% partial, 10% unpaid.
        const r = Math.random();
        if (r < 0.8) paidCents = total;
        else if (r < 0.9) paidCents = Math.round(total * 0.5);
      } else {
        // Current month: 50% paid, 25% partial, 25% unpaid.
        const r = Math.random();
        if (r < 0.5) paidCents = total;
        else if (r < 0.75) paidCents = Math.round(total * 0.4);
      }

      if (paidCents > 0) {
        await db.insert(rentPayments).values({
          organizationId,
          rentChargeId: charge.id,
          childSeriesId: charge.childSeriesId,
          amountCents: paidCents,
          receivedDate: due,
          method: "check",
        });
      }

      const status = computeRentStatus({
        rentAmountCents: charge.rentAmountCents,
        lateFeeCents: charge.lateFeeCents,
        dueDate: charge.dueDate,
        paidCents,
      });
      await db
        .update(rentCharges)
        .set({ status })
        .where(sql`${rentCharges.id} = ${charge.id}`);
    }
  }

  /* Expenses ----------------------------------------------------------- */
  const expenseSpecs: Array<{
    seriesIdx: number;
    propertyId?: string;
    kind: import("./schema").ExpenseCategoryKind;
    amount: number;
    vendor?: string;
    desc: string;
    monthsAgo: number;
  }> = [
    { seriesIdx: 0, propertyId: propsA[0].id, kind: "repairs", amount: 42000, vendor: "Rapid Plumbing Co.", desc: "Water heater repair", monthsAgo: 1 },
    { seriesIdx: 0, kind: "insurance", amount: 120000, vendor: "SafeGuard Insurance", desc: "Annual landlord policy", monthsAgo: 2 },
    { seriesIdx: 0, kind: "property_taxes", amount: 380000, desc: "County property tax", monthsAgo: 0 },
    { seriesIdx: 1, propertyId: propsB[0].id, kind: "utilities", amount: 28000, vendor: "City Utilities", desc: "Water/sewer", monthsAgo: 0 },
    { seriesIdx: 1, kind: "mortgage", amount: 210000, desc: "Mortgage P&I", monthsAgo: 1 },
    { seriesIdx: 2, propertyId: propsC[0].id, kind: "capital_improvements", amount: 950000, desc: "Roof replacement", monthsAgo: 3 },
    { seriesIdx: 2, kind: "accounting", amount: 60000, desc: "Bookkeeping retainer", monthsAgo: 1 },
    { seriesIdx: 2, kind: "supplies", amount: 9500, desc: "Cleaning supplies", monthsAgo: 0 },
  ];
  await db.insert(expenses).values(
    expenseSpecs.map((e) => ({
      organizationId,
      childSeriesId: seriesRows[e.seriesIdx].id,
      propertyId: e.propertyId,
      categoryId: catByKind[e.kind]?.id,
      categoryKind: e.kind,
      vendorId: e.vendor
        ? vendorRows.find((v) => v.name === e.vendor)?.id
        : undefined,
      amountCents: e.amount,
      incurredDate: iso(subMonths(new Date(), e.monthsAgo)),
      description: e.desc,
    })),
  );

  /* Documents (metadata) + notes -------------------------------------- */
  await db.insert(documents).values([
    {
      organizationId,
      entityType: "parent_llc",
      entityId: parent.id,
      title: "Series LLC Formation Certificate",
      type: "formation",
      fileName: "formation.pdf",
      mimeType: "application/pdf",
    },
    {
      organizationId,
      entityType: "lease",
      entityId: leaseRows[0].id,
      childSeriesId: leaseRows[0].childSeriesId,
      title: "Signed Lease — Tara Tenant",
      type: "lease",
      fileName: "lease-tara.pdf",
      mimeType: "application/pdf",
      sharedWithTenant: true,
    },
    {
      organizationId,
      entityType: "child_series",
      entityId: seriesRows[2].id,
      childSeriesId: seriesRows[2].id,
      title: "Roof replacement invoice",
      type: "invoice",
      fileName: "roof-invoice.pdf",
      mimeType: "application/pdf",
    },
  ]);

  await db.insert(notes).values([
    {
      organizationId,
      entityType: "child_series",
      entityId: seriesRows[0].id,
      body: "Maple series performing well; consider refinancing in Q3.",
      authorUserId: owner.id,
    },
    {
      organizationId,
      entityType: "property",
      entityId: propsC[0].id,
      body: "Loft 3 vacant — schedule paint + listing photos.",
      authorUserId: manager.id,
    },
  ]);

  /* Maintenance requests ---------------------------------------------- */
  await db.insert(maintenanceRequests).values([
    {
      organizationId,
      childSeriesId: leaseRows[0].childSeriesId,
      propertyId: unitRows.find((u) => u.id === leaseRows[0].unitId)!.propertyId,
      unitId: leaseRows[0].unitId,
      tenantId: leaseRows[0].tenantId,
      title: "Leaking kitchen faucet",
      description: "Drips constantly under the sink.",
      priority: "medium",
      status: "open",
    },
    {
      organizationId,
      childSeriesId: leaseRows[1].childSeriesId,
      propertyId: unitRows.find((u) => u.id === leaseRows[1].unitId)!.propertyId,
      unitId: leaseRows[1].unitId,
      tenantId: leaseRows[1].tenantId,
      title: "AC not cooling",
      description: "Unit blowing warm air.",
      priority: "high",
      status: "in_progress",
    },
  ]);

  console.log("✓ Seed complete.");
  console.log(`  Organization: ${org.name} (${organizationId})`);
  console.log("  Logins (dev auth): owner@example.com, manager@example.com,");
  console.log("                     bookkeeper@example.com, tenant@example.com");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
