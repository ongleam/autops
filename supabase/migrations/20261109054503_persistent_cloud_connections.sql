create table public.autops_connections (
  github_user_id bigint not null check (github_user_id > 0),
  provider text not null check (provider in ('vercel', 'supabase')),
  credentials text,
  status text not null default 'connected' check (status in ('connected', 'reauthorization_required')),
  revision uuid not null default gen_random_uuid(),
  refresh_lease uuid,
  refresh_locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (github_user_id, provider),
  check ((status = 'connected') = (credentials is not null))
);
alter table public.autops_connections enable row level security;
create policy autops_server_only on public.autops_connections for all to service_role using (true) with check (true);
revoke all on public.autops_connections from public, anon, authenticated;
grant select, insert, update, delete on public.autops_connections to service_role;

create function public.autops_claim_refresh(p_user_id bigint, p_provider text, p_revision uuid, p_lease uuid)
returns boolean language sql security invoker set search_path = '' as $$
  with claimed as (
    update public.autops_connections
    set refresh_lease = p_lease, refresh_locked_until = now() + interval '30 seconds'
    where github_user_id = p_user_id and provider = p_provider and revision = p_revision
      and status = 'connected' and (refresh_locked_until is null or refresh_locked_until < now())
    returning 1
  ) select exists(select 1 from claimed);
$$;
revoke all on function public.autops_claim_refresh(bigint, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.autops_claim_refresh(bigint, text, uuid, uuid) to service_role;
