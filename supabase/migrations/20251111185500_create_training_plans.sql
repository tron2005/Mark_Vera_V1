create table if not exists public.training_plans (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    start_date date not null,
    end_date date not null,
    goal text not null,
    status text not null default 'active' check (status in ('active', 'completed', 'archived')),
    schedule jsonb not null,
    analysis text
);

-- RLS Policies
alter table public.training_plans enable row level security;

drop policy if exists "Users can view their own training plans" on public.training_plans;
create policy "Users can view their own training plans"
    on public.training_plans for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own training plans" on public.training_plans;
create policy "Users can insert their own training plans"
    on public.training_plans for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own training plans" on public.training_plans;
create policy "Users can update their own training plans"
    on public.training_plans for update
    using (auth.uid() = user_id);
