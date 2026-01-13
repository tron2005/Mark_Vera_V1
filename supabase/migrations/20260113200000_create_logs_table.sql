-- Create logs table for system logging
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now() not null,
  user_id uuid references auth.users(id) on delete cascade,
  level text not null check (level in ('info', 'warning', 'error')),
  source text not null, -- 'chat', 'google', 'strava', etc.
  message text not null,
  details jsonb,
  metadata jsonb
);

-- Create index for faster queries
create index logs_created_at_idx on public.logs(created_at desc);
create index logs_user_id_idx on public.logs(user_id);
create index logs_level_idx on public.logs(level);
create index logs_source_idx on public.logs(source);

-- Enable RLS
alter table public.logs enable row level security;

-- Users can only see their own logs
create policy "Users can view own logs"
  on public.logs
  for select
  using (auth.uid() = user_id);

-- Service role can insert logs
create policy "Service role can insert logs"
  on public.logs
  for insert
  with check (true);

-- Add comment
comment on table public.logs is 'System logs for debugging and monitoring';
