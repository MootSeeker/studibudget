-- StudiBudget: Ende-zu-Ende-verschlüsselter Speicher.
-- Der Server sieht nur Chiffretext, Datensatz-IDs, Zeitstempel (hlc) und das Löschkennzeichen.

create table public.user_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wrapped_dek text not null check (length(wrapped_dek) < 1000),
  wrapped_dek_recovery text not null check (length(wrapped_dek_recovery) < 1000),
  kdf jsonb not null,
  updated_at timestamptz not null default now()
);

create sequence public.records_seq;

create table public.records (
  user_id uuid not null references auth.users (id) on delete cascade,
  id uuid not null,
  hlc text not null check (length(hlc) between 1 and 64),
  deleted boolean not null default false,
  ciphertext text not null check (length(ciphertext) < 200000),
  seq bigint not null default nextval('public.records_seq'),
  primary key (user_id, id)
);

create index records_user_seq_idx on public.records (user_id, seq);

alter table public.user_keys enable row level security;
alter table public.records enable row level security;

-- user_keys: jede Person verwaltet nur die eigene Zeile.
create policy "user_keys_select_own" on public.user_keys for select to authenticated using (user_id = auth.uid());
create policy "user_keys_insert_own" on public.user_keys for insert to authenticated with check (user_id = auth.uid());
create policy "user_keys_update_own" on public.user_keys for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- records: Lesen nur eigene; Schreiben ausschliesslich über push_records().
create policy "records_select_own" on public.records for select to authenticated using (user_id = auth.uid());

revoke all on public.user_keys, public.records from anon, authenticated;
grant select, insert, update on public.user_keys to authenticated;
grant select on public.records to authenticated;
revoke all on sequence public.records_seq from anon, authenticated;

-- Last-Writer-Wins pro Datensatz: nur überschreiben, wenn die neue hlc grösser ist.
create function public.push_records(rows jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  max_seq bigint;
begin
  if uid is null then
    raise exception 'nicht angemeldet' using errcode = '42501';
  end if;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) > 500 then
    raise exception 'ungültige Datenmenge' using errcode = '22023';
  end if;

  insert into public.records as r (user_id, id, hlc, deleted, ciphertext, seq)
  select uid, x.id, x.hlc, x.deleted, x.ciphertext, nextval('public.records_seq')
  from jsonb_to_recordset(rows) as x (id uuid, hlc text, deleted boolean, ciphertext text)
  on conflict (user_id, id) do update
    set hlc = excluded.hlc,
        deleted = excluded.deleted,
        ciphertext = excluded.ciphertext,
        seq = nextval('public.records_seq')
    where r.hlc < excluded.hlc;

  select coalesce(max(seq), 0) into max_seq from public.records where user_id = uid;
  return max_seq;
end;
$$;

-- Konto samt allen Daten löschen (Cascade über auth.users).
create function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.push_records(jsonb) from public, anon;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;
grant execute on function public.delete_account() to authenticated;
