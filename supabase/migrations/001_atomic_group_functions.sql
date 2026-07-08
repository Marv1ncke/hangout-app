-- ============================================================
-- Atomaire group-functies (elimineren race conditions)
-- Draai dit één keer in de Supabase SQL Editor.
-- ============================================================

-- 1) Groep aanmaken: insert group + insert member + update profile
--    in ÉÉN transactie. Alles-of-niets, geen tussenstadium met 0 leden.
create or replace function create_group_atomic(
  p_name text,
  p_join_code text,
  p_is_protected boolean
)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_group groups;
begin
  if v_user_id is null then
    raise exception 'Niet ingelogd';
  end if;

  insert into groups (name, join_code, invite_code, is_protected, created_by)
  values (p_name, p_join_code, p_join_code, p_is_protected, v_user_id)
  returning * into v_group;

  insert into group_members (group_id, user_id, status)
  values (v_group.id, v_user_id, 'active');

  update profiles
  set selected_group_id = v_group.id
  where id = v_user_id;

  return v_group;
end;
$$;

-- 2) Groep joinen via code: insert member (active of pending) + evt.
--    update profile, atomisch. Voorkomt dubbele memberships bij dubbelklik.
create or replace function join_group_atomic(
  p_join_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_group groups;
  v_existing group_members;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Niet ingelogd';
  end if;

  select * into v_group from groups where join_code = p_join_code;
  if v_group.id is null then
    raise exception 'Code niet gevonden';
  end if;

  select * into v_existing
  from group_members
  where group_id = v_group.id and user_id = v_user_id;

  if v_existing.id is not null then
    -- Al lid of al pending: geen duplicaat, geef status terug.
    return jsonb_build_object('group', to_jsonb(v_group), 'status', v_existing.status, 'already_member', true);
  end if;

  v_status := case when v_group.is_protected then 'pending' else 'active' end;

  insert into group_members (group_id, user_id, status)
  values (v_group.id, v_user_id, v_status);

  if v_status = 'active' then
    update profiles set selected_group_id = v_group.id where id = v_user_id;
  end if;

  return jsonb_build_object('group', to_jsonb(v_group), 'status', v_status, 'already_member', false);
end;
$$;

-- 3) Groep verlaten of verwijderen (laatste lid) in één transactie,
--    inclusief het opnieuw bepalen van selected_group_id op de fallback.
create or replace function leave_group_atomic(
  p_group_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_active_count int;
  v_deleted_group boolean := false;
  v_next_group_id uuid;
begin
  if v_user_id is null then
    raise exception 'Niet ingelogd';
  end if;

  select count(*) into v_active_count
  from group_members
  where group_id = p_group_id and status = 'active';

  if v_active_count <= 1 then
    -- Laatste lid: hele groep weg. ON DELETE CASCADE ruimt members/events/attendance op.
    delete from groups where id = p_group_id and created_by = v_user_id;
    -- Val terug op created_by check hierboven; als het niet de owner is, alsnog netjes verlaten:
    if not found then
      delete from group_members where group_id = p_group_id and user_id = v_user_id;
    else
      v_deleted_group := true;
    end if;
  else
    delete from group_members where group_id = p_group_id and user_id = v_user_id;
    delete from availability_slots where group_id = p_group_id and user_id = v_user_id;
  end if;

  -- Bepaal volgende actieve groep voor deze user (of null)
  select gm.group_id into v_next_group_id
  from group_members gm
  where gm.user_id = v_user_id and gm.status = 'active'
  order by gm.created_at asc
  limit 1;

  update profiles set selected_group_id = v_next_group_id where id = v_user_id;

  return jsonb_build_object('deleted_group', v_deleted_group, 'next_group_id', v_next_group_id);
end;
$$;

grant execute on function create_group_atomic(text, text, boolean) to authenticated;
grant execute on function join_group_atomic(text) to authenticated;
grant execute on function leave_group_atomic(uuid) to authenticated;
