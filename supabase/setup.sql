-- GymLedger 2.0.3 · Supabase
-- Ejecutar en SQL Editor del proyecto Supabase compartido.
-- Los objetos de GymLedger usan prefijo gymledger_ y no modifican GigPlan ni WorkCycle.

create table if not exists public.gymledger_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  record_type text not null check (record_type in ('exercise','routine','plan','session')),
  payload jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, record_id)
);

create index if not exists gymledger_records_user_type_idx
  on public.gymledger_records(user_id, record_type);
create index if not exists gymledger_records_user_updated_idx
  on public.gymledger_records(user_id, server_updated_at);

create table if not exists public.gymledger_counters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_exercise_number integer not null default 23 check (next_exercise_number > 0)
);

create or replace function public.gymledger_prepare_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code_text text;
  code_number integer;
begin
  new.server_updated_at := now();

  if new.record_type = 'exercise' and new.deleted_at is null then
    code_text := nullif(upper(trim(new.payload->>'exerciseCode')), '');

    if code_text is null then
      insert into public.gymledger_counters(user_id, next_exercise_number)
      values (new.user_id, 23)
      on conflict (user_id) do update
      set next_exercise_number = greatest(public.gymledger_counters.next_exercise_number, 23);

      select next_exercise_number into code_number
      from public.gymledger_counters
      where user_id = new.user_id
      for update;

      code_text := 'EX-' || lpad(code_number::text, 4, '0');
      update public.gymledger_counters
      set next_exercise_number = code_number + 1
      where user_id = new.user_id;

      new.payload := jsonb_set(new.payload, '{exerciseCode}', to_jsonb(code_text), true);
    elsif code_text ~ '^EX-[0-9]+$' then
      code_number := substring(code_text from 4)::integer;
      insert into public.gymledger_counters(user_id, next_exercise_number)
      values (new.user_id, greatest(code_number + 1, 23))
      on conflict (user_id) do update
      set next_exercise_number = greatest(public.gymledger_counters.next_exercise_number, excluded.next_exercise_number, 23);
      new.payload := jsonb_set(new.payload, '{exerciseCode}', to_jsonb(code_text), true);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists gymledger_prepare_record_trg on public.gymledger_records;
create trigger gymledger_prepare_record_trg
before insert or update on public.gymledger_records
for each row execute function public.gymledger_prepare_record();

-- EX-0001..EX-0022 quedan reservados para los 22 ejercicios iniciales.
-- Esta reparación es idempotente y corrige una primera sincronización parcial de
-- versiones 2.0.0-2.0.2, donde un ejercicio nuevo podía recibir EX-0001 antes
-- de que los ejercicios iniciales llegaran al servidor.
alter table public.gymledger_counters
  alter column next_exercise_number set default 23;

update public.gymledger_counters
set next_exercise_number = greatest(next_exercise_number, 23);

update public.gymledger_records
set payload = payload - 'exerciseCode'
where record_type = 'exercise'
  and deleted_at is null
  and record_id not like 'seed-ex-%'
  and coalesce(payload->>'exerciseCode','') ~ '^EX-(000[1-9]|001[0-9]|002[0-2])$';

create unique index if not exists gymledger_exercise_code_unique
on public.gymledger_records(user_id, (payload->>'exerciseCode'))
where record_type = 'exercise'
  and deleted_at is null
  and coalesce(payload->>'exerciseCode','') <> '';

alter table public.gymledger_records enable row level security;
alter table public.gymledger_counters enable row level security;

drop policy if exists "gymledger select own" on public.gymledger_records;
create policy "gymledger select own" on public.gymledger_records
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "gymledger insert own" on public.gymledger_records;
create policy "gymledger insert own" on public.gymledger_records
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "gymledger update own" on public.gymledger_records;
create policy "gymledger update own" on public.gymledger_records
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "gymledger delete own" on public.gymledger_records;
create policy "gymledger delete own" on public.gymledger_records
for delete to authenticated using (auth.uid() = user_id);

-- El cliente no necesita acceder a gymledger_counters directamente.
-- La función SECURITY DEFINER mantiene el contador de forma atómica.

grant select, insert, update, delete on public.gymledger_records to authenticated;
revoke all on public.gymledger_counters from anon, authenticated;
