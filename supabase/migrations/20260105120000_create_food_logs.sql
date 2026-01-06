-- Create a table for food logs
create table if not exists public.food_logs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    calories numeric,
    protein numeric,
    carbs numeric,
    fat numeric,
    date date default current_date not null,
    meal_type text -- 'breakfast', 'lunch', 'dinner', 'snack'
);

-- Set up RLS (Row Level Security)
alter table public.food_logs enable row level security;

create policy "Users can view their own food logs"
    on public.food_logs for select
    using (auth.uid() = user_id);

create policy "Users can insert their own food logs"
    on public.food_logs for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own food logs"
    on public.food_logs for update
    using (auth.uid() = user_id);

create policy "Users can delete their own food logs"
    on public.food_logs for delete
    using (auth.uid() = user_id);
