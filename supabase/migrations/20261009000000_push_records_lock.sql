-- #48: Advisory-Lock pro Nutzer, damit seq in Commit-Reihenfolge sichtbar wird und ein Pull keine Zeile überspringt.

create or replace function public.push_records(rows jsonb)
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
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

revoke all on function public.push_records(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;
