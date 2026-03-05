create table if not exists public.price_records (
  id uuid primary key default gen_random_uuid(),
  model text not null check (model in ('M4_Pro', 'M5_Pro')),
  platform text not null check (platform in ('Amazon', 'Costco_US', 'Costco_CA')),
  title text not null,
  price numeric(10,2) not null check (price > 0),
  price_usd numeric(10,2) not null check (price_usd > 0),
  currency text not null check (currency in ('USD', 'CAD')),
  original_price numeric(10,2),
  in_stock boolean not null default true,
  url text not null,
  scraped_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(platform, model, url, scraped_at)
);

create index if not exists idx_price_records_model_scraped_at
  on public.price_records (model, scraped_at desc);

create index if not exists idx_price_records_platform_scraped_at
  on public.price_records (platform, scraped_at desc);

create or replace view public.price_records_60d as
select *
from public.price_records
where scraped_at >= now() - interval '60 days';

alter table public.price_records enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'price_records'
      and policyname = 'Allow anon read price records'
  ) then
    create policy "Allow anon read price records"
      on public.price_records
      for select
      to anon
      using (true);
  end if;
end $$;
