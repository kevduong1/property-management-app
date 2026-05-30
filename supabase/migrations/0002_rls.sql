-- ===========================================================================
-- Row Level Security + role-based access control
-- ---------------------------------------------------------------------------
-- Roles (per spec):
--   owner_admin : manage all data
--   manager     : manage properties, units, tenants, leases, rent, expenses,
--                 notes, documents, maintenance
--   bookkeeper  : view everything, manage financial records (rent, payments,
--                 deposits, expenses, vendors, categories)
--   tenant      : view only their own lease / balance / rent history / shared
--                 documents, and submit maintenance requests
--
-- Multi-user access is scoped by organization. A user's org is stored on
-- public.users.organization_id.
-- ===========================================================================

-- --------------------------- helper functions -----------------------------

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.users where id = auth.uid();
$$;

create or replace function public.has_role(target_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text = any(target_roles)
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.has_role(array['owner_admin']);
$$;

-- Staff = any non-tenant role (can read all org data).
create or replace function public.is_staff()
returns boolean language sql stable as $$
  select public.has_role(array['owner_admin','manager','bookkeeper']);
$$;

-- Operational write access (properties/units/tenants/leases/docs/notes/maint).
create or replace function public.can_manage_ops()
returns boolean language sql stable as $$
  select public.has_role(array['owner_admin','manager']);
$$;

-- Financial write access (rent charges/payments/deposits/expenses/vendors).
create or replace function public.can_manage_finance()
returns boolean language sql stable as $$
  select public.has_role(array['owner_admin','manager','bookkeeper']);
$$;

-- Tenant record ids linked to the calling auth user.
create or replace function public.my_tenant_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.tenant_user_links where user_id = auth.uid();
$$;

-- ------------------------- enable RLS on all tables ------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','users','user_roles','parent_llcs','child_series',
    'properties','units','tenants','tenant_user_links','leases',
    'rent_charges','rent_payments','security_deposits','expense_categories',
    'vendors','expenses','documents','notes','maintenance_requests'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- ------------------------------ organizations ------------------------------

create policy org_select on public.organizations
  for select using (id = public.current_org_id());
create policy org_write on public.organizations
  for all using (id = public.current_org_id() and public.is_admin())
  with check (id = public.current_org_id() and public.is_admin());

-- --------------------------------- users -----------------------------------

create policy users_select on public.users
  for select using (id = auth.uid() or organization_id = public.current_org_id());
create policy users_insert_self on public.users
  for insert with check (id = auth.uid());
create policy users_update on public.users
  for update using (id = auth.uid() or (organization_id = public.current_org_id() and public.is_admin()));

-- ------------------------------- user_roles --------------------------------

create policy user_roles_select on public.user_roles
  for select using (organization_id = public.current_org_id());
create policy user_roles_write on public.user_roles
  for all using (organization_id = public.current_org_id() and public.is_admin())
  with check (organization_id = public.current_org_id() and public.is_admin());

-- ===========================================================================
-- Generic org-scoped policy pattern applied to staff-managed tables.
-- SELECT  : any staff member in the org.
-- WRITE   : gated by role (ops vs finance) — see per-table below.
-- ===========================================================================

-- parent_llcs (ops/admin)
create policy parent_llcs_select on public.parent_llcs
  for select using (organization_id = public.current_org_id() and public.is_staff());
create policy parent_llcs_write on public.parent_llcs
  for all using (organization_id = public.current_org_id() and public.can_manage_ops())
  with check (organization_id = public.current_org_id() and public.can_manage_ops());

-- child_series (ops/admin)
create policy child_series_select on public.child_series
  for select using (organization_id = public.current_org_id() and public.is_staff());
create policy child_series_write on public.child_series
  for all using (organization_id = public.current_org_id() and public.can_manage_ops())
  with check (organization_id = public.current_org_id() and public.can_manage_ops());

-- properties (staff read; tenant reads their property; ops write)
create policy properties_select on public.properties
  for select using (
    organization_id = public.current_org_id() and (
      public.is_staff()
      or id in (select l.property_id from public.leases l where l.tenant_id in (select public.my_tenant_ids()))
    )
  );
create policy properties_write on public.properties
  for all using (organization_id = public.current_org_id() and public.can_manage_ops())
  with check (organization_id = public.current_org_id() and public.can_manage_ops());

-- units (staff read; tenant reads their unit; ops write)
create policy units_select on public.units
  for select using (
    organization_id = public.current_org_id() and (
      public.is_staff()
      or id in (select l.unit_id from public.leases l where l.tenant_id in (select public.my_tenant_ids()))
    )
  );
create policy units_write on public.units
  for all using (organization_id = public.current_org_id() and public.can_manage_ops())
  with check (organization_id = public.current_org_id() and public.can_manage_ops());

-- tenants (staff read; tenant reads own record; ops write)
create policy tenants_select on public.tenants
  for select using (
    organization_id = public.current_org_id() and (
      public.is_staff() or id in (select public.my_tenant_ids())
    )
  );
create policy tenants_write on public.tenants
  for all using (organization_id = public.current_org_id() and public.can_manage_ops())
  with check (organization_id = public.current_org_id() and public.can_manage_ops());

-- tenant_user_links (admin manages; user sees own link)
create policy tul_select on public.tenant_user_links
  for select using (organization_id = public.current_org_id() and (public.is_staff() or user_id = auth.uid()));
create policy tul_write on public.tenant_user_links
  for all using (organization_id = public.current_org_id() and public.is_admin())
  with check (organization_id = public.current_org_id() and public.is_admin());

-- leases (staff read; tenant reads own; ops write)
create policy leases_select on public.leases
  for select using (
    organization_id = public.current_org_id() and (
      public.is_staff() or tenant_id in (select public.my_tenant_ids())
    )
  );
create policy leases_write on public.leases
  for all using (organization_id = public.current_org_id() and public.can_manage_ops())
  with check (organization_id = public.current_org_id() and public.can_manage_ops());

-- rent_charges (staff read; tenant reads own; finance write)
create policy rent_charges_select on public.rent_charges
  for select using (
    organization_id = public.current_org_id() and (
      public.is_staff() or tenant_id in (select public.my_tenant_ids())
    )
  );
create policy rent_charges_write on public.rent_charges
  for all using (organization_id = public.current_org_id() and public.can_manage_finance())
  with check (organization_id = public.current_org_id() and public.can_manage_finance());

-- rent_payments (staff read; tenant reads own; finance write)
create policy rent_payments_select on public.rent_payments
  for select using (
    organization_id = public.current_org_id() and (
      public.is_staff() or tenant_id in (select public.my_tenant_ids())
    )
  );
create policy rent_payments_write on public.rent_payments
  for all using (organization_id = public.current_org_id() and public.can_manage_finance())
  with check (organization_id = public.current_org_id() and public.can_manage_finance());

-- security_deposits (staff read; tenant reads own; finance write)
create policy security_deposits_select on public.security_deposits
  for select using (
    organization_id = public.current_org_id() and (
      public.is_staff() or tenant_id in (select public.my_tenant_ids())
    )
  );
create policy security_deposits_write on public.security_deposits
  for all using (organization_id = public.current_org_id() and public.can_manage_finance())
  with check (organization_id = public.current_org_id() and public.can_manage_finance());

-- expense_categories (default rows have null org and are world-readable; finance write on org rows)
create policy expense_categories_select on public.expense_categories
  for select using (organization_id is null or (organization_id = public.current_org_id() and public.is_staff()));
create policy expense_categories_write on public.expense_categories
  for all using (organization_id = public.current_org_id() and public.can_manage_finance())
  with check (organization_id = public.current_org_id() and public.can_manage_finance());

-- vendors (staff read; finance write)
create policy vendors_select on public.vendors
  for select using (organization_id = public.current_org_id() and public.is_staff());
create policy vendors_write on public.vendors
  for all using (organization_id = public.current_org_id() and public.can_manage_finance())
  with check (organization_id = public.current_org_id() and public.can_manage_finance());

-- expenses (staff read; finance write)
create policy expenses_select on public.expenses
  for select using (organization_id = public.current_org_id() and public.is_staff());
create policy expenses_write on public.expenses
  for all using (organization_id = public.current_org_id() and public.can_manage_finance())
  with check (organization_id = public.current_org_id() and public.can_manage_finance());

-- documents (staff read; tenant reads shared docs attached to their entities; ops write)
create policy documents_select on public.documents
  for select using (
    organization_id = public.current_org_id() and (
      public.is_staff()
      or (
        shared_with_tenant and (
          (entity_type = 'tenant' and entity_id in (select public.my_tenant_ids()))
          or (entity_type = 'lease' and entity_id in (select l.id from public.leases l where l.tenant_id in (select public.my_tenant_ids())))
          or (entity_type = 'unit' and entity_id in (select l.unit_id from public.leases l where l.tenant_id in (select public.my_tenant_ids())))
        )
      )
    )
  );
create policy documents_write on public.documents
  for all using (organization_id = public.current_org_id() and public.can_manage_ops())
  with check (organization_id = public.current_org_id() and public.can_manage_ops());

-- notes (staff only — internal)
create policy notes_select on public.notes
  for select using (organization_id = public.current_org_id() and public.is_staff());
create policy notes_write on public.notes
  for all using (organization_id = public.current_org_id() and public.can_manage_ops())
  with check (organization_id = public.current_org_id() and public.can_manage_ops());

-- maintenance_requests (staff read; tenant reads + creates own; ops update/delete)
create policy maintenance_select on public.maintenance_requests
  for select using (
    organization_id = public.current_org_id() and (
      public.is_staff() or tenant_id in (select public.my_tenant_ids())
    )
  );
create policy maintenance_insert on public.maintenance_requests
  for insert with check (
    organization_id = public.current_org_id() and (
      public.can_manage_ops() or tenant_id in (select public.my_tenant_ids())
    )
  );
create policy maintenance_update on public.maintenance_requests
  for update using (organization_id = public.current_org_id() and public.can_manage_ops());
create policy maintenance_delete on public.maintenance_requests
  for delete using (organization_id = public.current_org_id() and public.can_manage_ops());
