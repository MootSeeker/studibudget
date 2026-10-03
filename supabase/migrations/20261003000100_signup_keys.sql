-- Bei der Registrierung liefert die App die (bereits verpackten, also unlesbaren) Schlüssel
-- als Metadaten mit. Die E-Mail-Bestätigung verhindert eine Sitzung direkt nach dem Signup,
-- deshalb übernimmt dieser Trigger sie in user_keys und entfernt sie danach aus den Metadaten.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if m ? 'wrapped_dek' and m ? 'wrapped_dek_recovery' and m ? 'kdf' then
    insert into public.user_keys (user_id, wrapped_dek, wrapped_dek_recovery, kdf)
    values (new.id, m ->> 'wrapped_dek', m ->> 'wrapped_dek_recovery', m -> 'kdf');

    update auth.users
       set raw_user_meta_data = raw_user_meta_data - 'wrapped_dek' - 'wrapped_dek_recovery' - 'kdf'
     where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Supabase Auth schreibt die Zeile nach dem Einfügen nochmals; die Schlüssel sollen auch dann
-- nie in den Metadaten (und damit nie im Token) bleiben.
create function public.strip_key_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    - 'wrapped_dek' - 'wrapped_dek_recovery' - 'kdf';
  return new;
end;
$$;

create trigger strip_key_metadata_on_update
  before update of raw_user_meta_data on auth.users
  for each row execute function public.strip_key_metadata();
