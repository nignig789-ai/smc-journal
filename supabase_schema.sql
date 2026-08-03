-- ═══════════════════════════════════════════════
--  SMC Journal — Supabase Schema
--  วาง SQL นี้ใน Supabase > SQL Editor > Run
-- ═══════════════════════════════════════════════

-- 1. PROFILES (ข้อมูลสมาชิก)
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  display_name  text not null default 'Trader',
  role          text not null default 'pending',   -- pending | member | admin
  approved_at   timestamptz,
  expires_at    timestamptz,                        -- null = ไม่หมดอายุ
  created_at    timestamptz default now()
);

-- 2. PORTFOLIOS (พอร์ตโฟลิโอ แต่ละคนมีได้หลายพอร์ต)
create table if not exists portfolios (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  name        text not null,
  currency    text default 'USD',
  initial_balance numeric default 100000,
  created_at  timestamptz default now()
);

-- 3. TRADES (รายการเทรด)
create table if not exists trades (
  id          uuid primary key default gen_random_uuid(),
  portfolio_id uuid references portfolios(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  date        date not null,
  symbol      text not null,
  market      text default 'Forex',
  direction   text not null,   -- BUY | SELL
  entry       numeric,
  sl          numeric,
  tp          numeric,
  lot         numeric,
  pnl         numeric default 0,
  result      text,            -- WIN | LOSS | BE
  setup       text,
  session     text,
  rr          numeric,
  note        text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 4. RLS POLICIES
alter table profiles   enable row level security;
alter table portfolios enable row level security;
alter table trades     enable row level security;

-- Profiles: ดูตัวเองได้, Admin ดูได้ทั้งหมด
create policy "profiles_select" on profiles for select using (
  auth.uid() = id or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "profiles_update_self" on profiles for update using (auth.uid() = id);

-- Portfolios: CRUD เฉพาะของตัวเอง
create policy "portfolios_all" on portfolios for all using (auth.uid() = user_id);

-- Trades: CRUD เฉพาะของตัวเอง
create policy "trades_all" on trades for all using (auth.uid() = user_id);

-- 5. TRIGGER — สร้าง profile อัตโนมัติเมื่อสมัคร
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', 'Trader'),
    case when new.email = current_setting('app.admin_email', true) then 'admin' else 'pending' end
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 6. TRIGGER — อัปเดต updated_at อัตโนมัติ
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trades_updated_at before update on trades
  for each row execute procedure update_updated_at();

-- 7. VIEW สำหรับ Admin ดูสมาชิกทั้งหมด
create or replace view admin_members as
  select
    p.id, p.email, p.display_name, p.role,
    p.approved_at, p.expires_at, p.created_at,
    count(t.id) as trade_count,
    coalesce(sum(t.pnl), 0) as total_pnl
  from profiles p
  left join trades t on t.user_id = p.id
  group by p.id, p.email, p.display_name, p.role, p.approved_at, p.expires_at, p.created_at;
