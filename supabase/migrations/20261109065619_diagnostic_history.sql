create table public.autops_diagnostics (
  id uuid primary key default gen_random_uuid(),
  github_user_id bigint not null check (github_user_id > 0),
  repository_id bigint not null check (repository_id > 0),
  repository text not null,
  stage text not null check (stage in ('before', 'after', 'inspection')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now()
);
create index autops_diagnostics_owner_repository on public.autops_diagnostics (github_user_id, repository_id, created_at desc);
alter table public.autops_diagnostics enable row level security;
revoke all on public.autops_diagnostics from public, anon, authenticated;
grant select, insert on public.autops_diagnostics to service_role;
