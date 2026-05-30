/**
 * Drizzle ORM schema for the Series-LLC property management & bookkeeping app.
 *
 * Design principles
 * -----------------
 * - Money is stored as INTEGER cents (`*_cents`) everywhere to avoid floating
 *   point drift. Use the helpers in `@/lib/money` to format/parse.
 * - Every financially meaningful row carries `organization_id` (multi-tenant
 *   scoping) and, where relevant, a denormalized `child_series_id` so income
 *   and expenses can always be separated by child series cheaply — the core
 *   product differentiator.
 * - `documents` and `notes` are polymorphic: they attach to any entity via
 *   (`entity_type`, `entity_id`). This keeps attachment flexible for the
 *   future without a join table per entity.
 * - Enums are Postgres enums so the DB enforces valid states.
 *
 * Constraints encoded here:
 *   property.child_series_id  NOT NULL  -> every property belongs to a series
 *   unit.property_id          NOT NULL  -> every unit belongs to a property
 *   lease.tenant_id/unit_id   NOT NULL  -> every lease connects tenant <-> unit
 *   rent_charge.child_series_id NOT NULL (denormalized) + unit_id
 *   expense.child_series_id   NOT NULL, property_id/unit_id nullable
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const roleEnum = pgEnum("role", [
  "owner", // Owner/Admin — full access
  "manager", // Manage properties, tenants, rent, expenses, notes, docs
  "bookkeeper", // View + manage financial records
  "tenant", // Self-service portal only
]);

export const seriesStatusEnum = pgEnum("series_status", [
  "active",
  "inactive",
  "dissolved",
]);

export const propertyStatusEnum = pgEnum("property_status", [
  "active",
  "inactive",
  "sold",
]);

export const occupancyStatusEnum = pgEnum("occupancy_status", [
  "vacant",
  "occupied",
  "unavailable",
]);

export const leaseStatusEnum = pgEnum("lease_status", [
  "active",
  "expired",
  "upcoming",
  "month_to_month",
  "terminated",
]);

export const rentChargeStatusEnum = pgEnum("rent_charge_status", [
  "unpaid",
  "partial",
  "paid",
  "late",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "check",
  "ach",
  "card",
  "zelle",
  "venmo",
  "other",
]);

export const expenseCategoryEnum = pgEnum("expense_category_kind", [
  "repairs",
  "utilities",
  "insurance",
  "property_taxes",
  "mortgage",
  "legal",
  "accounting",
  "supplies",
  "capital_improvements",
  "other",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "lease",
  "receipt",
  "invoice",
  "insurance",
  "formation", // LLC/series formation document
  "vendor_contract",
  "tenant_notice",
  "inspection_photo",
  "other",
]);

export const maintenanceStatusEnum = pgEnum("maintenance_status", [
  "open",
  "in_progress",
  "completed",
  "canceled",
]);

export const maintenancePriorityEnum = pgEnum("maintenance_priority", [
  "low",
  "medium",
  "high",
  "emergency",
]);

/**
 * Polymorphic attachment targets for documents & notes. Kept as an enum so the
 * DB rejects typos and the set is explicit/auditable.
 */
export const entityTypeEnum = pgEnum("entity_type", [
  "parent_llc",
  "child_series",
  "property",
  "unit",
  "tenant",
  "lease",
  "rent_charge",
  "expense",
  "payment",
  "document",
  "maintenance_request",
]);

/* -------------------------------------------------------------------------- */
/* Common column helpers                                                      */
/* -------------------------------------------------------------------------- */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/* -------------------------------------------------------------------------- */
/* Identity & access                                                          */
/* -------------------------------------------------------------------------- */

/** Mirrors the Supabase auth user. `authId` links to Supabase `auth.users.id`. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authId: uuid("auth_id").unique(), // Supabase auth user id (nullable for invited-not-yet-registered)
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  phone: text("phone"),
  ...timestamps,
});

/** Top-level tenant boundary. All business data is scoped to an organization. */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ...timestamps,
});

/** Membership of a user in an organization with a single role. */
export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("manager"),
    ...timestamps,
  },
  (t) => ({
    uniqMembership: uniqueIndex("user_roles_org_user_uniq").on(
      t.organizationId,
      t.userId,
    ),
  }),
);

/* -------------------------------------------------------------------------- */
/* LLC structure                                                              */
/* -------------------------------------------------------------------------- */

export const parentLlcs = pgTable("parent_llcs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ein: text("ein"),
  stateOfFormation: text("state_of_formation"),
  notes: text("notes"),
  ...timestamps,
});

export const childSeries = pgTable("child_series", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  parentLlcId: uuid("parent_llc_id")
    .notNull()
    .references(() => parentLlcs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: seriesStatusEnum("status").notNull().default("active"),
  ein: text("ein"), // optional
  bankAccountNickname: text("bank_account_nickname"), // optional
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Properties & units                                                         */
/* -------------------------------------------------------------------------- */

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // Constraint: every property belongs to a child series.
  childSeriesId: uuid("child_series_id")
    .notNull()
    .references(() => childSeries.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  status: propertyStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  ...timestamps,
});

export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // Constraint: every unit belongs to a property.
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  // Denormalized for cheap series-scoped queries / integrity at write time.
  childSeriesId: uuid("child_series_id")
    .notNull()
    .references(() => childSeries.id, { onDelete: "restrict" }),
  label: text("label").notNull(), // unit name/number, e.g. "Unit A", "101"
  monthlyRentCents: integer("monthly_rent_cents").notNull().default(0),
  occupancyStatus: occupancyStatusEnum("occupancy_status")
    .notNull()
    .default("vacant"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"), // stored as count*10 to allow half baths (e.g. 15 = 1.5)
  squareFeet: integer("square_feet"),
  notes: text("notes"),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Tenants & leases                                                           */
/* -------------------------------------------------------------------------- */

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  notes: text("notes"),
  ...timestamps,
});

/** Links a tenant record to a login user (for the tenant portal). */
export const tenantUserLinks = pgTable(
  "tenant_user_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => ({
    uniqLink: uniqueIndex("tenant_user_links_uniq").on(t.tenantId, t.userId),
  }),
);

export const leases = pgTable("leases", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // Constraint: every lease connects a tenant to a unit.
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "restrict" }),
  // Denormalized series for series-scoped reporting.
  childSeriesId: uuid("child_series_id")
    .notNull()
    .references(() => childSeries.id, { onDelete: "restrict" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // null => month-to-month / open-ended
  monthlyRentCents: integer("monthly_rent_cents").notNull().default(0),
  securityDepositCents: integer("security_deposit_cents").notNull().default(0),
  status: leaseStatusEnum("status").notNull().default("active"),
  documentId: uuid("document_id"), // uploaded lease doc (FK added via relation, nullable)
  notes: text("notes"),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Rent: charges & payments                                                   */
/* -------------------------------------------------------------------------- */

export const rentCharges = pgTable("rent_charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // Full traceability chain (denormalized for fast rent-roll filtering).
  childSeriesId: uuid("child_series_id")
    .notNull()
    .references(() => childSeries.id, { onDelete: "restrict" }),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "restrict" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),
  leaseId: uuid("lease_id").references(() => leases.id, {
    onDelete: "set null",
  }),
  dueDate: date("due_date").notNull(),
  rentAmountCents: integer("rent_amount_cents").notNull().default(0),
  lateFeeCents: integer("late_fee_cents").notNull().default(0),
  // Stored status; recomputed via recalcRentChargeStatus on writes. Kept in the
  // column so the rent roll can filter/sort without recomputing.
  status: rentChargeStatusEnum("status").notNull().default("unpaid"),
  notes: text("notes"),
  ...timestamps,
});

export const rentPayments = pgTable("rent_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  rentChargeId: uuid("rent_charge_id")
    .notNull()
    .references(() => rentCharges.id, { onDelete: "cascade" }),
  // Denormalized series for income reporting without joining the full chain.
  childSeriesId: uuid("child_series_id")
    .notNull()
    .references(() => childSeries.id, { onDelete: "restrict" }),
  amountCents: integer("amount_cents").notNull(),
  receivedDate: date("received_date").notNull(),
  method: paymentMethodEnum("method").notNull().default("check"),
  reference: text("reference"),
  notes: text("notes"),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Security deposits                                                          */
/* -------------------------------------------------------------------------- */

export const securityDeposits = pgTable("security_deposits", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  childSeriesId: uuid("child_series_id")
    .notNull()
    .references(() => childSeries.id, { onDelete: "restrict" }),
  leaseId: uuid("lease_id").references(() => leases.id, {
    onDelete: "set null",
  }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
  amountCents: integer("amount_cents").notNull().default(0),
  receivedDate: date("received_date"),
  refundAmountCents: integer("refund_amount_cents").notNull().default(0),
  refundDate: date("refund_date"),
  notes: text("notes"),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Expenses, categories, vendors                                              */
/* -------------------------------------------------------------------------- */

/**
 * Categories are seeded per-organization from `expenseCategoryEnum` defaults
 * but stored as rows so landlords can add custom categories later.
 */
export const expenseCategories = pgTable("expense_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: expenseCategoryEnum("kind").notNull().default("other"),
  isCapital: boolean("is_capital").notNull().default(false),
  ...timestamps,
});

export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  ...timestamps,
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // Constraint: every expense belongs to a child series.
  childSeriesId: uuid("child_series_id")
    .notNull()
    .references(() => childSeries.id, { onDelete: "restrict" }),
  // Optional finer attribution.
  propertyId: uuid("property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
  vendorId: uuid("vendor_id").references(() => vendors.id, {
    onDelete: "set null",
  }),
  categoryId: uuid("category_id").references(() => expenseCategories.id, {
    onDelete: "set null",
  }),
  // Snapshot of the category kind so reports don't break if a category row is
  // edited/deleted later.
  categoryKind: expenseCategoryEnum("category_kind").notNull().default("other"),
  amountCents: integer("amount_cents").notNull().default(0),
  incurredDate: date("incurred_date").notNull(),
  description: text("description"),
  notes: text("notes"),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Documents & notes (polymorphic)                                            */
/* -------------------------------------------------------------------------- */

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // Polymorphic attachment.
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  // Denormalized series where derivable, for series-scoped document views.
  childSeriesId: uuid("child_series_id").references(() => childSeries.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  type: documentTypeEnum("type").notNull().default("other"),
  storageKey: text("storage_key"), // path/key in the storage backend
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  // Whether a tenant linked to the entity may view this (tenant portal).
  sharedWithTenant: boolean("shared_with_tenant").notNull().default(false),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  body: text("body").notNull(),
  authorUserId: uuid("author_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Maintenance                                                                */
/* -------------------------------------------------------------------------- */

export const maintenanceRequests = pgTable("maintenance_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  childSeriesId: uuid("child_series_id")
    .notNull()
    .references(() => childSeries.id, { onDelete: "restrict" }),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
  tenantId: uuid("tenant_id").references(() => tenants.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  priority: maintenancePriorityEnum("priority").notNull().default("medium"),
  status: maintenanceStatusEnum("status").notNull().default("open"),
  resolutionNotes: text("resolution_notes"),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const organizationsRelations = relations(organizations, ({ many }) => ({
  userRoles: many(userRoles),
  parentLlcs: many(parentLlcs),
  childSeries: many(childSeries),
  properties: many(properties),
}));

export const parentLlcsRelations = relations(parentLlcs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [parentLlcs.organizationId],
    references: [organizations.id],
  }),
  childSeries: many(childSeries),
}));

export const childSeriesRelations = relations(childSeries, ({ one, many }) => ({
  parentLlc: one(parentLlcs, {
    fields: [childSeries.parentLlcId],
    references: [parentLlcs.id],
  }),
  properties: many(properties),
  expenses: many(expenses),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  childSeries: one(childSeries, {
    fields: [properties.childSeriesId],
    references: [childSeries.id],
  }),
  units: many(units),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  property: one(properties, {
    fields: [units.propertyId],
    references: [properties.id],
  }),
  leases: many(leases),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  leases: many(leases),
  links: many(tenantUserLinks),
}));

export const leasesRelations = relations(leases, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [leases.tenantId],
    references: [tenants.id],
  }),
  unit: one(units, { fields: [leases.unitId], references: [units.id] }),
  rentCharges: many(rentCharges),
}));

export const rentChargesRelations = relations(
  rentCharges,
  ({ one, many }) => ({
    lease: one(leases, {
      fields: [rentCharges.leaseId],
      references: [leases.id],
    }),
    unit: one(units, { fields: [rentCharges.unitId], references: [units.id] }),
    tenant: one(tenants, {
      fields: [rentCharges.tenantId],
      references: [tenants.id],
    }),
    payments: many(rentPayments),
  }),
);

export const rentPaymentsRelations = relations(rentPayments, ({ one }) => ({
  rentCharge: one(rentCharges, {
    fields: [rentPayments.rentChargeId],
    references: [rentCharges.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  childSeries: one(childSeries, {
    fields: [expenses.childSeriesId],
    references: [childSeries.id],
  }),
  property: one(properties, {
    fields: [expenses.propertyId],
    references: [properties.id],
  }),
  vendor: one(vendors, {
    fields: [expenses.vendorId],
    references: [vendors.id],
  }),
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type ParentLlc = typeof parentLlcs.$inferSelect;
export type ChildSeries = typeof childSeries.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type Lease = typeof leases.$inferSelect;
export type RentCharge = typeof rentCharges.$inferSelect;
export type RentPayment = typeof rentPayments.$inferSelect;
export type SecurityDeposit = typeof securityDeposits.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;
export type TenantUserLink = typeof tenantUserLinks.$inferSelect;

export type Role = (typeof roleEnum.enumValues)[number];
export type EntityType = (typeof entityTypeEnum.enumValues)[number];
export type RentChargeStatus = (typeof rentChargeStatusEnum.enumValues)[number];
export type LeaseStatus = (typeof leaseStatusEnum.enumValues)[number];
export type ExpenseCategoryKind =
  (typeof expenseCategoryEnum.enumValues)[number];
export type DocumentType = (typeof documentTypeEnum.enumValues)[number];
export type MaintenanceStatus =
  (typeof maintenanceStatusEnum.enumValues)[number];
export type MaintenancePriority =
  (typeof maintenancePriorityEnum.enumValues)[number];
