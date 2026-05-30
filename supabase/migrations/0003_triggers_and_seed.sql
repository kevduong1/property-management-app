-- ===========================================================================
-- Auth profile trigger + default seed data
-- ===========================================================================

-- When a new auth user is created, mirror a profile row into public.users.
-- The app's onboarding flow then assigns an organization + role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh on write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','users','parent_llcs','child_series','properties','units',
    'tenants','leases','rent_charges','rent_payments','security_deposits',
    'vendors','expenses','documents','notes','maintenance_requests'
  ]
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s;', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at();',
      t
    );
  end loop;
end $$;

-- --------------------------- default expense categories --------------------
-- Global defaults (organization_id = null) available to every org.
insert into public.expense_categories (organization_id, name, slug, is_default, tax_line)
values
  (null, 'Repairs',              'repairs',             true, 'Schedule E - Repairs'),
  (null, 'Utilities',            'utilities',           true, 'Schedule E - Utilities'),
  (null, 'Insurance',            'insurance',           true, 'Schedule E - Insurance'),
  (null, 'Property Taxes',       'property_taxes',      true, 'Schedule E - Taxes'),
  (null, 'Mortgage',             'mortgage',            true, 'Schedule E - Mortgage interest'),
  (null, 'Legal',                'legal',               true, 'Schedule E - Legal & professional'),
  (null, 'Accounting',           'accounting',          true, 'Schedule E - Legal & professional'),
  (null, 'Supplies',             'supplies',            true, 'Schedule E - Supplies'),
  (null, 'Capital Improvements', 'capital_improvements',true, 'Depreciable asset'),
  (null, 'Other',                'other',               true, 'Schedule E - Other')
on conflict do nothing;

-- --------------------------- storage bucket --------------------------------
-- Create a private bucket for document/receipt uploads.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
