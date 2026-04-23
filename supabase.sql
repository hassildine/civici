create table if not exists public.open_house_leads (
  id text primary key,
  full_name text not null,
  phone text not null,
  email text,
  notes text,
  event_name text not null,
  thank_you_message text not null,
  created_at timestamptz not null default now(),
  inserted_at timestamptz not null default now()
);
