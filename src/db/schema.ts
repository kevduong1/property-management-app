/**
 * Drizzle ORM schema for the Series LLC property management & bookkeeping app.
 *
 * Design goals:
 *  - Clean financial separation by child series of a parent LLC.
 *  - Multi-user access scoped by organization.
 *  - Polymorphic document & note attachment to many entity types.
 *  - Normalized so payments/bank-sync/accounting exports can be layered on later.
 *
 * Hierarchy:
 *   organization
 *     parent_llc
 *       child_series
 *         properties -> units -> (tenants via leases) -> rent_charges -> rent_payments
 *         expenses, documents, notes, maintenance_requests
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  date,
  integer,
  numeric,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/* -------------------------------------------------------------------------- */
/*                                   Enums                                     */
/* -------------------------------------------------------------------------- */

export const userRoleEnum = pgEnum('user_role', [
  'owner_admin',
  'manager',
  'bookkeeper',
  'tenant',
]);

export const seriesStatusEnum = pgEnum('series_status', [
  'active',
  'inactive',
  'pending',
  'dissolved',
]);

export const propertyStatusEnum = pgEnum('property_status', [
  'active',
  'inactive',
  'sold',
]);

export const occupancyStatusEnum = pgEnum('occupancy_status', [
  'occupied',
  'vacant',
  'unavailable',
]);

export const leaseStatusEnum = pgEnum('lease_status', [
  'active',
  'expired',
  'upcoming',
  'month_to_month',
  'terminated',
]);

export const rentChargeStatusEnum = pgEnum('rent_charge_status', [
  'unpaid',
  'partially_paid',
  'paid',
  'late',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'check',
  'bank_transfer',
  'money_order',
  'online',
  'other',
]);

export const maintenancePriorityEnum = pgEnum('maintenance_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const maintenanceStatusEnum = pgEnum('maintenance_status', [
  'open',
  'in_progress',
  'completed',
  'canceled',
]);

export const documentTypeEnum = pgEnum('document_type', [
  'lease',
  'receipt',
  'invoice',
  'insurance',
  'formation',
  'vendor_contract',
  'tenant_notice',
  'inspection_photo',
  'other',
]);

/**
 * Entity types used for polymorphic attachment of documents & notes.
 * Keep this list in sync with `constants/entities.ts`.
 */
export const entityTypeEnum = pgEnum('entity_type', [
  'parent_llc',
  'child_series',
  'property',
  'unit',
  'tenant',
  'lease',
  'rent_charge',
  'rent_payment',
  'expense',
  'security_deposit',
  'maintenance_request',
  'document',
]);

/* -------------------------------------------------------------------------- */
/*                          Organization & Identity                           */
/* -------------------------------------------------------------------------- */

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Profile row that mirrors a Supabase `auth.users` record. `id` equals the
 * Supabase auth uid so RLS policies can compare against `auth.uid()`.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // == auth.users.id
  organizationId: uuid('organization_id').references(() => organizations.id, {
    onDelete: 'set null',
  }),
  email: text('email').notNull(),
  fullName: text('full_name'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Org-scoped role assignment. A user may (rarely) hold more than one role; the
 * effective role is the highest-privilege one.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    role: userRoleEnum('role').notNull().default('manager'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('user_roles_user_org_role_uq').on(t.userId, t.organizationId, t.role),
    index('user_roles_org_idx').on(t.organizationId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                            LLC & Child Series                              */
/* -------------------------------------------------------------------------- */

export const parentLlcs = pgTable(
  'parent_llcs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    legalName: text('legal_name'),
    ein: varchar('ein', { length: 32 }),
    formationState: varchar('formation_state', { length: 64 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('parent_llcs_org_idx').on(t.organizationId)],
);

export const childSeries = pgTable(
  'child_series',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentLlcId: uuid('parent_llc_id')
      .references(() => parentLlcs.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: seriesStatusEnum('status').notNull().default('active'),
    ein: varchar('ein', { length: 32 }),
    bankAccountNickname: text('bank_account_nickname'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('child_series_parent_idx').on(t.parentLlcId),
    index('child_series_org_idx').on(t.organizationId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                           Properties & Units                               */
/* -------------------------------------------------------------------------- */

export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Every property MUST belong to a child series.
    childSeriesId: uuid('child_series_id')
      .references(() => childSeries.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: varchar('state', { length: 64 }),
    postalCode: varchar('postal_code', { length: 16 }),
    status: propertyStatusEnum('status').notNull().default('active'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('properties_series_idx').on(t.childSeriesId),
    index('properties_org_idx').on(t.organizationId),
  ],
);

export const units = pgTable(
  'units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Every unit MUST belong to a property.
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    // Denormalized for fast series-scoped queries; kept in sync with property.
    childSeriesId: uuid('child_series_id')
      .references(() => childSeries.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(), // unit name / number
    monthlyRent: numeric('monthly_rent', { precision: 12, scale: 2 }).default('0'),
    occupancyStatus: occupancyStatusEnum('occupancy_status').notNull().default('vacant'),
    bedrooms: integer('bedrooms'),
    bathrooms: numeric('bathrooms', { precision: 4, scale: 1 }),
    squareFeet: integer('square_feet'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('units_property_idx').on(t.propertyId),
    index('units_series_idx').on(t.childSeriesId),
    index('units_org_idx').on(t.organizationId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                           Tenants & Leases                                 */
/* -------------------------------------------------------------------------- */

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    fullName: text('full_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('tenants_org_idx').on(t.organizationId)],
);

/**
 * Links a tenant record to a Supabase auth user so the tenant can log in and
 * see only their own data (enforced via RLS).
 */
export const tenantUserLinks = pgTable(
  'tenant_user_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('tenant_user_links_tenant_user_uq').on(t.tenantId, t.userId),
    index('tenant_user_links_user_idx').on(t.userId),
  ],
);

export const leases = pgTable(
  'leases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // A lease connects a tenant to a unit.
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    unitId: uuid('unit_id')
      .references(() => units.id, { onDelete: 'cascade' })
      .notNull(),
    // Denormalized for series-scoped reporting.
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    childSeriesId: uuid('child_series_id')
      .references(() => childSeries.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'), // null => month-to-month / open-ended
    monthlyRent: numeric('monthly_rent', { precision: 12, scale: 2 }).notNull().default('0'),
    securityDepositAmount: numeric('security_deposit_amount', {
      precision: 12,
      scale: 2,
    }).default('0'),
    rentDueDay: integer('rent_due_day').default(1), // day of month rent is due
    status: leaseStatusEnum('status').notNull().default('active'),
    documentId: uuid('document_id'), // uploaded lease document (FK added in relations)
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('leases_tenant_idx').on(t.tenantId),
    index('leases_unit_idx').on(t.unitId),
    index('leases_series_idx').on(t.childSeriesId),
    index('leases_org_idx').on(t.organizationId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                        Rent Charges & Payments                             */
/* -------------------------------------------------------------------------- */

export const rentCharges = pgTable(
  'rent_charges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id').references(() => leases.id, { onDelete: 'set null' }),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    unitId: uuid('unit_id')
      .references(() => units.id, { onDelete: 'cascade' })
      .notNull(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    // Traceable to a child series (constraint #4).
    childSeriesId: uuid('child_series_id')
      .references(() => childSeries.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    dueDate: date('due_date').notNull(),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    rentAmount: numeric('rent_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    lateFeeAmount: numeric('late_fee_amount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    // Status is derived (paid/unpaid/partial/late) but stored for fast filtering.
    status: rentChargeStatusEnum('status').notNull().default('unpaid'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('rent_charges_tenant_idx').on(t.tenantId),
    index('rent_charges_unit_idx').on(t.unitId),
    index('rent_charges_series_idx').on(t.childSeriesId),
    index('rent_charges_due_idx').on(t.dueDate),
    index('rent_charges_org_idx').on(t.organizationId),
  ],
);

export const rentPayments = pgTable(
  'rent_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rentChargeId: uuid('rent_charge_id').references(() => rentCharges.id, {
      onDelete: 'set null',
    }),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    childSeriesId: uuid('child_series_id')
      .references(() => childSeries.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
    receivedDate: date('received_date').notNull(),
    method: paymentMethodEnum('method').notNull().default('check'),
    reference: text('reference'),
    notes: text('notes'),
    // Placeholders for future Stripe / ACH integration (not used in MVP).
    externalProcessor: text('external_processor'),
    externalPaymentId: text('external_payment_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('rent_payments_charge_idx').on(t.rentChargeId),
    index('rent_payments_tenant_idx').on(t.tenantId),
    index('rent_payments_series_idx').on(t.childSeriesId),
    index('rent_payments_org_idx').on(t.organizationId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                          Security Deposits                                 */
/* -------------------------------------------------------------------------- */

export const securityDeposits = pgTable(
  'security_deposits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id').references(() => leases.id, { onDelete: 'set null' }),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
    childSeriesId: uuid('child_series_id')
      .references(() => childSeries.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
    dateReceived: date('date_received'),
    refundAmount: numeric('refund_amount', { precision: 12, scale: 2 }).default('0'),
    refundDate: date('refund_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('security_deposits_tenant_idx').on(t.tenantId),
    index('security_deposits_series_idx').on(t.childSeriesId),
    index('security_deposits_org_idx').on(t.organizationId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                         Expenses & Vendors                                 */
/* -------------------------------------------------------------------------- */

export const expenseCategories = pgTable(
  'expense_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Null org => global/default category seeded for everyone.
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    // Hint for future Schedule E / tax export mapping.
    taxLine: text('tax_line'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('expense_categories_org_idx').on(t.organizationId)],
);

export const vendors = pgTable(
  'vendors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    contactName: text('contact_name'),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('vendors_org_idx').on(t.organizationId)],
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Every expense MUST belong to a child series.
    childSeriesId: uuid('child_series_id')
      .references(() => childSeries.id, { onDelete: 'cascade' })
      .notNull(),
    // Optional property / unit association.
    propertyId: uuid('property_id').references(() => properties.id, {
      onDelete: 'set null',
    }),
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
    categoryId: uuid('category_id').references(() => expenseCategories.id, {
      onDelete: 'set null',
    }),
    vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
    expenseDate: date('expense_date').notNull(),
    description: text('description'),
    notes: text('notes'),
    receiptDocumentId: uuid('receipt_document_id'),
    // Future-proofing for bank sync / reconciliation.
    isReconciled: boolean('is_reconciled').notNull().default(false),
    externalTransactionId: text('external_transaction_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('expenses_series_idx').on(t.childSeriesId),
    index('expenses_property_idx').on(t.propertyId),
    index('expenses_category_idx').on(t.categoryId),
    index('expenses_date_idx').on(t.expenseDate),
    index('expenses_org_idx').on(t.organizationId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                      Documents & Notes (polymorphic)                       */
/* -------------------------------------------------------------------------- */

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    // Optional series scoping for series-level document organization & reporting.
    childSeriesId: uuid('child_series_id').references(() => childSeries.id, {
      onDelete: 'set null',
    }),
    // Polymorphic attachment.
    entityType: entityTypeEnum('entity_type').notNull(),
    entityId: uuid('entity_id'),
    title: text('title').notNull(),
    documentType: documentTypeEnum('document_type').notNull().default('other'),
    // Storage abstraction: bucket + path (Supabase Storage) or external url.
    storageBucket: text('storage_bucket'),
    storagePath: text('storage_path'),
    fileUrl: text('file_url'),
    mimeType: text('mime_type'),
    fileSize: integer('file_size'),
    // Whether a tenant linked to the entity may view this document.
    sharedWithTenant: boolean('shared_with_tenant').notNull().default(false),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('documents_entity_idx').on(t.entityType, t.entityId),
    index('documents_series_idx').on(t.childSeriesId),
    index('documents_org_idx').on(t.organizationId),
  ],
);

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    childSeriesId: uuid('child_series_id').references(() => childSeries.id, {
      onDelete: 'set null',
    }),
    entityType: entityTypeEnum('entity_type').notNull(),
    entityId: uuid('entity_id'),
    body: text('body').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('notes_entity_idx').on(t.entityType, t.entityId),
    index('notes_org_idx').on(t.organizationId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                         Maintenance Requests                               */
/* -------------------------------------------------------------------------- */

export const maintenanceRequests = pgTable(
  'maintenance_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
    propertyId: uuid('property_id').references(() => properties.id, {
      onDelete: 'set null',
    }),
    childSeriesId: uuid('child_series_id')
      .references(() => childSeries.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    priority: maintenancePriorityEnum('priority').notNull().default('medium'),
    status: maintenanceStatusEnum('status').notNull().default('open'),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('maintenance_series_idx').on(t.childSeriesId),
    index('maintenance_tenant_idx').on(t.tenantId),
    index('maintenance_status_idx').on(t.status),
    index('maintenance_org_idx').on(t.organizationId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                          Inferred TS types                                 */
/* -------------------------------------------------------------------------- */

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type ParentLlc = typeof parentLlcs.$inferSelect;
export type ChildSeries = typeof childSeries.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type TenantUserLink = typeof tenantUserLinks.$inferSelect;
export type Lease = typeof leases.$inferSelect;
export type RentCharge = typeof rentCharges.$inferSelect;
export type RentPayment = typeof rentPayments.$inferSelect;
export type SecurityDeposit = typeof securityDeposits.$inferSelect;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;

export type NewChildSeries = typeof childSeries.$inferInsert;
export type NewProperty = typeof properties.$inferInsert;
export type NewUnit = typeof units.$inferInsert;
export type NewTenant = typeof tenants.$inferInsert;
export type NewLease = typeof leases.$inferInsert;
export type NewRentCharge = typeof rentCharges.$inferInsert;
export type NewRentPayment = typeof rentPayments.$inferInsert;
export type NewSecurityDeposit = typeof securityDeposits.$inferInsert;
export type NewExpense = typeof expenses.$inferInsert;
export type NewDocument = typeof documents.$inferInsert;
export type NewNote = typeof notes.$inferInsert;
export type NewMaintenanceRequest = typeof maintenanceRequests.$inferInsert;
