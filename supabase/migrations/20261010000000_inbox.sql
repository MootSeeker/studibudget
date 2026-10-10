-- #157: Posteingang des KI-Konnektors. Der Server speichert nur Chiffretext (mit dem öffentlichen Schlüssel der
-- Verbindung auf dem Gerät verschlüsselt) und vom Token nur den SHA-256-Hash. Mit dem Token kann man ausschliesslich
-- über inbox_insert() einfügen: kein Lesen, kein Zugriff auf records oder user_keys.

create table public.inbox_connections (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.inbox (
  user_id uuid not null references auth.users (id) on delete cascade,
  proposal_id uuid not null,
  connection_id uuid not null references public.inbox_connections (id) on delete cascade,
  ciphertext text not null check (length(ciphertext) between 1 and 4000),
  created_at timestamptz not null default now(),
  primary key (user_id, proposal_id)
);

create index inbox_connection_idx on public.inbox (connection_id);

alter table public.inbox_connections enable row level security;
alter table public.inbox enable row level security;

create policy "inbox_connections_select_own" on public.inbox_connections for select to authenticated
  using (user_id = auth.uid());
create policy "inbox_connections_insert_own" on public.inbox_connections for insert to authenticated
  with check (user_id = auth.uid() and revoked_at is null);
create policy "inbox_select_own" on public.inbox for select to authenticated using (user_id = auth.uid());
create policy "inbox_delete_own" on public.inbox for delete to authenticated using (user_id = auth.uid());

revoke all on public.inbox_connections, public.inbox from anon, authenticated;
grant select, insert on public.inbox_connections to authenticated;
grant select, delete on public.inbox to authenticated;

-- Einliefern mit dem Token einer Verbindung (MCP-Server, Rolle anon). Dieselbe Vorschlags-ID liegt nur einmal da.
create function public.inbox_insert(p_token text, p_proposal_id uuid, p_ciphertext text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conn public.inbox_connections%rowtype;
begin
  if p_token is null or length(p_token) > 200 then
    raise exception 'ungültiges Token' using errcode = '42501';
  end if;
  select * into conn from public.inbox_connections
   where token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex')
     and revoked_at is null;
  if not found then
    raise exception 'ungültiges oder widerrufenes Token' using errcode = '42501';
  end if;
  if (select count(*) from public.inbox where connection_id = conn.id) >= 500 then
    raise exception 'Posteingang voll' using errcode = '54000';
  end if;
  insert into public.inbox (user_id, proposal_id, connection_id, ciphertext)
  values (conn.user_id, p_proposal_id, conn.id, p_ciphertext)
  on conflict (user_id, proposal_id) do nothing;
end;
$$;

-- Widerruf durch die angemeldete Person: Token ungültig, liegende Einträge der Verbindung weg.
create function public.inbox_revoke(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet' using errcode = '42501';
  end if;
  update public.inbox_connections set revoked_at = coalesce(revoked_at, now())
   where id = p_connection_id and user_id = auth.uid();
  delete from public.inbox where connection_id = p_connection_id and user_id = auth.uid();
end;
$$;

revoke all on function public.inbox_insert(text, uuid, text) from public, anon, authenticated;
revoke all on function public.inbox_revoke(uuid) from public, anon, authenticated;
grant execute on function public.inbox_insert(text, uuid, text) to anon, authenticated;
grant execute on function public.inbox_revoke(uuid) to authenticated;
