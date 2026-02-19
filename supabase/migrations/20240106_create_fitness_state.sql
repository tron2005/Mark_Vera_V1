-- Create table for storing latest calculated fitness metrics
create table if not exists public.user_fitness_state (
    user_id uuid references auth.users(id) primary key,
    ctl integer,
    atl integer,
    tsb integer,
    vo2max integer,
    marathon_shape integer,
    last_updated timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_fitness_state enable row level security;

-- Policy: User can select their own data
create policy "Users can view own fitness state" 
on public.user_fitness_state for select 
using (auth.uid() = user_id);

-- Policy: User can insert/update their own data
create policy "Users can insert own fitness state" 
on public.user_fitness_state for insert 
with check (auth.uid() = user_id);

create policy "Users can update own fitness state" 
on public.user_fitness_state for update 
using (auth.uid() = user_id);
