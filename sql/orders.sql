create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  public_token text not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  coaching_context text,
  product_name text not null,
  amount_vnd integer not null check (amount_vnd > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'manual_review')),
  payment_transaction_id text unique,
  payment_reference_code text,
  payment_gateway text,
  paid_at timestamptz,
  owner_email_sent_at timestamptz,
  customer_email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
