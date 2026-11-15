-- Le Croissant: apply once with Supabase migrations or SQL Editor.
create type public.app_role as enum ('ADMIN','HR');
create type public.review_status as enum ('pending','reviewed','resolved','ignored');
create table public.profiles (
 id uuid primary key references auth.users(id), email text not null, full_name text not null default '',
 role public.app_role not null default 'HR', active boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function public.authorized() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and role in ('ADMIN','HR'));
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and role='ADMIN');
$$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,email,full_name) values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',''));
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id,email,full_name) select id,coalesce(email,''),coalesce(raw_user_meta_data->>'full_name','') from auth.users on conflict do nothing;
create table public.employees (
 id uuid primary key default gen_random_uuid(), first_name text not null, last_name text not null, normalized_name text not null,
 external_employee_id text, hikcentral_employee_id text, odoo_employee_id text, branch_id uuid,
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Intentionally non-unique: names are provisional matching keys, not identities.
create index employees_normalized_idx on public.employees(normalized_name);
create table public.attendance_imports (
 id uuid primary key, original_filename text not null, storage_path text not null unique,
 file_checksum text not null unique check(file_checksum ~ '^[a-f0-9]{64}$'), file_size bigint not null check(file_size between 1 and 20971520),
 exported_at timestamp, hikcentral_operator text, period_start date, period_end date,
 uploaded_by uuid not null references public.profiles(id), total_rows integer not null default 0, valid_rows integer not null default 0,
 issue_rows integer not null default 0, duplicate_rows integer not null default 0, inserted_rows integer not null default 0,
 status text not null default 'completed' check(status='completed'), created_at timestamptz not null default now()
);
create table public.attendance_records (
 id uuid primary key default gen_random_uuid(), import_id uuid not null references public.attendance_imports(id),
 employee_id uuid references public.employees(id), raw_first_name text not null, raw_last_name text not null, normalized_name text not null,
 work_date date, check_in time, check_out time, duration_minutes integer check(duration_minutes between 0 and 59999),
 raw_duration text not null, raw_row jsonb not null, source_row integer not null,
 row_fingerprint text not null unique, valid boolean not null, issue_flags text[] not null default '{}',
 review_status public.review_status not null default 'pending', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index attendance_date_idx on public.attendance_records(work_date);
create index attendance_employee_idx on public.attendance_records(employee_id);
create index attendance_import_idx on public.attendance_records(import_id);
create index attendance_review_idx on public.attendance_records(review_status);
create index attendance_name_date_idx on public.attendance_records(normalized_name,work_date);
create index attendance_issues_idx on public.attendance_records using gin(issue_flags);
create table public.attendance_record_notes (
 id uuid primary key default gen_random_uuid(), record_id uuid not null references public.attendance_records(id),
 user_id uuid not null references public.profiles(id), body text not null check(length(trim(body)) between 1 and 4000), created_at timestamptz not null default now()
);
create index notes_record_idx on public.attendance_record_notes(record_id,created_at);
create table public.attendance_record_events (
 id uuid primary key default gen_random_uuid(), record_id uuid not null references public.attendance_records(id), user_id uuid not null references public.profiles(id),
 previous_status public.review_status not null, next_status public.review_status not null, created_at timestamptz not null default now()
);
create index events_record_idx on public.attendance_record_events(record_id,created_at);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), action text not null,
 entity_type text not null, entity_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index audit_created_idx on public.audit_logs(created_at desc);
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end;$$;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger employees_updated before update on public.employees for each row execute function public.touch_updated_at();
create trigger records_updated before update on public.attendance_records for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.attendance_imports enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_record_notes enable row level security;
alter table public.attendance_record_events enable row level security;
alter table public.audit_logs enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.authorized());
create policy employees_read on public.employees for select to authenticated using(public.authorized());
create policy imports_read on public.attendance_imports for select to authenticated using(public.authorized());
create policy records_read on public.attendance_records for select to authenticated using(public.authorized());
create policy notes_read on public.attendance_record_notes for select to authenticated using(public.authorized());
create policy events_read on public.attendance_record_events for select to authenticated using(public.authorized());
create policy audit_read on public.audit_logs for select to authenticated using(public.is_admin());
-- All mutations go through authenticated, explicitly authorized RPCs.
revoke all on public.profiles,public.employees,public.attendance_imports,public.attendance_records,public.attendance_record_notes,public.attendance_record_events,public.audit_logs from anon,authenticated;
grant select on public.profiles,public.employees,public.attendance_imports,public.attendance_records,public.attendance_record_notes,public.attendance_record_events,public.audit_logs to authenticated;

create function public.clean_name(value text) returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(coalesce(value,''),'\s+',' ','g'));
$$;
create function public.match_name(value text) returns text language sql immutable set search_path='' as $$
 select translate(lower(public.clean_name(value)),'áéíóúüñàèìòùâêîôûäëïöç','aeiouunaeiouaeiouaeioc');
$$;
create function public.safe_date(value text) returns date language plpgsql immutable set search_path='' as $$
declare d date;begin
 if value !~ '^\d{4}-\d{2}-\d{2}$' then return null;end if;
 d=value::date; if d < date '1900-01-01' or d > date '2100-12-31' then return null;end if;return d;
exception when others then return null;end;$$;

create function public.confirm_import(p_id uuid,p_filename text,p_path text,p_checksum text,p_size bigint,p_metadata jsonb,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; flags text[]; fn text; ln text; nm text; wd date; ci time; co time; dur integer; ds text;
 emp uuid; candidates integer; fp text; is_valid boolean; total integer=0; valids integer=0; issues integer=0; dupes integer=0; inserted integer=0;
begin
 if not public.authorized() then raise exception 'No autorizado' using errcode='42501';end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Se requiere una lista de filas';end if;
 if jsonb_array_length(p_rows) not between 1 and 10000 then raise exception 'Entre 1 y 10000 filas requeridas';end if;
 if p_path <> auth.uid()::text || '/' || p_id::text || '/' || p_filename or p_filename ~ '[/\\]' or length(p_filename)>200 then raise exception 'Ruta de archivo inválida';end if;
 if not exists(select 1 from storage.objects where bucket_id='attendance-imports' and name=p_path) then raise exception 'Falta subir el archivo original';end if;
 -- Serializes imports to make name matching, conflicts and duplicate handling deterministic.
 perform pg_advisory_xact_lock(721904);
 if exists(select 1 from public.attendance_imports where file_checksum=p_checksum) then raise exception 'Este archivo parece haber sido importado anteriormente.' using errcode='23505';end if;
 insert into public.attendance_imports(id,original_filename,storage_path,file_checksum,file_size,exported_at,hikcentral_operator,period_start,period_end,uploaded_by)
 values(p_id,p_filename,p_path,p_checksum,p_size,nullif(p_metadata->>'exported_at','')::timestamp,p_metadata->>'hikcentral_operator',public.safe_date(p_metadata->>'period_start'),public.safe_date(p_metadata->>'period_end'),auth.uid());
 for r in select value from jsonb_array_elements(p_rows) loop
  total=total+1; flags='{}'; emp=null;ci=null;co=null;dur=null;
  fn=public.clean_name(r->>'first_name');ln=public.clean_name(r->>'last_name');nm=public.match_name(fn||' '||ln);
  if length(fn)>200 or length(ln)>200 then raise exception 'Nombre demasiado largo en fila %',total;end if;
  wd=public.safe_date(trim(r->>'date'));if wd is null then flags=array_append(flags,'INVALID_DATE');end if;
  if trim(r->>'check_in') ~ '^([01]\d|2[0-3]):[0-5]\d$' then ci=trim(r->>'check_in')::time;else flags=array_append(flags,'INVALID_CHECK_IN');end if;
  if coalesce(trim(r->>'check_out'),'') in ('','-') then flags=array_append(flags,'MISSING_CHECK_OUT');
  elsif trim(r->>'check_out') ~ '^([01]\d|2[0-3]):[0-5]\d$' then co=trim(r->>'check_out')::time;else flags=array_append(flags,'INVALID_CHECK_OUT');end if;
  ds=regexp_replace(coalesce(r->>'duration',''),'\s','','g');
  if ds ~ '^\d{1,3}:[0-5]\d$' then dur=split_part(ds,':',1)::integer*60+split_part(ds,':',2)::integer;if dur=0 then flags=array_append(flags,'ZERO_DURATION');end if;
  else flags=array_append(flags,'INVALID_DURATION');end if;
  if ci is not null and co is not null and dur is not null and mod((extract(epoch from (co-ci))/60)::integer+1440,1440)<>dur then flags=array_append(flags,'DURATION_MISMATCH');end if;
  is_valid=not (flags && array['INVALID_DATE','INVALID_CHECK_IN','INVALID_CHECK_OUT','INVALID_DURATION']);
  if is_valid then valids=valids+1;end if;
  fp=md5(jsonb_build_array(nm,coalesce(wd::text,trim(r->>'date')),coalesce(left(ci::text,5),trim(r->>'check_in')),coalesce(left(co::text,5),nullif(trim(r->>'check_out'),''),'-'),coalesce(dur::text,trim(r->>'duration')))::text);
  if exists(select 1 from public.attendance_records where row_fingerprint=fp) then dupes=dupes+1;continue;end if;
  if fn='' or ln='' then flags=array_append(flags,'EMPLOYEE_MATCH_REQUIRED');else
   select count(*),(array_agg(id))[1] into candidates,emp from public.employees where normalized_name=nm and active;
   if candidates=0 then insert into public.employees(first_name,last_name,normalized_name) values(fn,ln,nm) returning id into emp;
   elsif candidates>1 then emp=null;flags=array_append(flags,'NEEDS_EMPLOYEE_REVIEW');end if;
  end if;
  if exists(select 1 from public.attendance_records where normalized_name=nm and work_date=wd and check_in=ci) then flags=array_append(flags,'POSSIBLE_DUPLICATE');end if;
  if cardinality(flags)>0 then issues=issues+1;end if;
  insert into public.attendance_records(import_id,employee_id,raw_first_name,raw_last_name,normalized_name,work_date,check_in,check_out,duration_minutes,raw_duration,raw_row,source_row,row_fingerprint,valid,issue_flags,review_status)
  values(p_id,emp,coalesce(r->>'first_name',''),coalesce(r->>'last_name',''),nm,wd,ci,co,dur,coalesce(r->>'duration',''),r,coalesce((r->>'source_row')::integer,total),fp,is_valid,flags,case when cardinality(flags)>0 then 'pending'::public.review_status else 'reviewed'::public.review_status end);
  inserted=inserted+1;
 end loop;
 update public.attendance_imports set total_rows=total,valid_rows=valids,issue_rows=issues,duplicate_rows=dupes,inserted_rows=inserted where id=p_id;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,metadata) values
 (auth.uid(),'FILE_UPLOADED','import',p_id,jsonb_build_object('storage_path',p_path)),
 (auth.uid(),'IMPORT_CONFIRMED','import',p_id,jsonb_build_object('total',total,'inserted',inserted,'duplicates',dupes));
 return jsonb_build_object('id',p_id,'total',total,'valid',valids,'issues',issues,'duplicates',dupes,'inserted',inserted);
end;$$;

create function public.review_record(p_id uuid,p_status public.review_status,p_note text default '') returns void language plpgsql security definer set search_path='' as $$
declare prev public.review_status;begin
 if not public.authorized() then raise exception 'No autorizado' using errcode='42501';end if;
 select review_status into prev from public.attendance_records where id=p_id for update;
 if not found then raise exception 'Registro no encontrado';end if;
 if p_status<>prev then
  update public.attendance_records set review_status=p_status where id=p_id;
  insert into public.attendance_record_events(record_id,user_id,previous_status,next_status) values(p_id,auth.uid(),prev,p_status);
  insert into public.audit_logs(user_id,action,entity_type,entity_id,metadata) values(auth.uid(),case when p_status='resolved' then 'RECORD_RESOLVED' else 'RECORD_REVIEWED' end,'record',p_id,jsonb_build_object('before',prev,'after',p_status));
 end if;
 if trim(p_note)<>'' then
  insert into public.attendance_record_notes(record_id,user_id,body) values(p_id,auth.uid(),trim(p_note));
  insert into public.audit_logs(user_id,action,entity_type,entity_id) values(auth.uid(),'NOTE_ADDED','record',p_id);
 end if;
end;$$;
create function public.manage_user(p_id uuid,p_role public.app_role,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Solo administradores' using errcode='42501';end if;
 if p_id=auth.uid() then raise exception 'No puedes modificar tu propio acceso';end if;
 update public.profiles set role=p_role,active=p_active where id=p_id;
 if not found then raise exception 'Usuario no encontrado';end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,metadata) values(auth.uid(),'USER_UPDATED','profile',p_id,jsonb_build_object('role',p_role,'active',p_active));
end;$$;
create function public.log_export(p_metadata jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.authorized() then raise exception 'No autorizado' using errcode='42501';end if;
 insert into public.audit_logs(user_id,action,entity_type,metadata) values(auth.uid(),'EXPORT_GENERATED','attendance',p_metadata);
end;$$;

create function public.dashboard_stats(p_from date default null,p_to date default null,p_import uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$
 with filtered as (select * from public.attendance_records where (p_from is null or work_date>=p_from) and (p_to is null or work_date<=p_to) and (p_import is null or import_id=p_import)),
 days as(select work_date as day,count(*) as records,round(sum(coalesce(duration_minutes,0)) filter(where valid)/60.0,2) as hours from filtered where work_date is not null group by work_date order by work_date),
 flags as(select unnest(issue_flags) as issue from filtered),
 kinds as(select issue,count(*) as count from flags group by issue),
 people as(select normalized_name as name,count(*) as count from filtered where 'MISSING_CHECK_OUT'=any(issue_flags) group by normalized_name order by count(*) desc limit 5)
 select jsonb_build_object('records',count(*),'employees',count(distinct employee_id),'complete',count(*) filter(where cardinality(issue_flags)=0),'issues',count(*) filter(where cardinality(issue_flags)>0),'pending',count(*) filter(where cardinality(issue_flags)>0 and review_status='pending'),'missing',count(*) filter(where 'MISSING_CHECK_OUT'=any(issue_flags)),'minutes',coalesce(sum(duration_minutes) filter(where valid),0),'imports',(select count(*) from public.attendance_imports where (p_import is null or id=p_import) and (p_from is null or period_end>=p_from) and (p_to is null or period_start<=p_to)),'daily',coalesce((select jsonb_agg(days) from days),'[]'),'by_issue',coalesce((select jsonb_agg(kinds) from kinds),'[]'),'people',coalesce((select jsonb_agg(people) from people),'[]')) from filtered;
$$;
create view public.employee_summary with (security_invoker=true) as
 select e.*,count(r.id) as record_count,min(r.work_date) as first_date,max(r.work_date) as last_date,count(r.id) filter(where cardinality(r.issue_flags)>0) as issue_count
 from public.employees e left join public.attendance_records r on r.employee_id=e.id group by e.id;
grant select on public.employee_summary to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('attendance-imports','attendance-imports',false,20971520,array['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream','application/vnd.ms-excel']);
create policy attendance_storage_read on storage.objects for select to authenticated using(bucket_id='attendance-imports' and public.authorized());
create policy attendance_storage_upload on storage.objects for insert to authenticated with check(bucket_id='attendance-imports' and public.authorized() and (storage.foldername(name))[1]=auth.uid()::text);
-- Only orphan uploads may be removed. Committed originals are immutable.
create policy attendance_storage_cleanup on storage.objects for delete to authenticated using(bucket_id='attendance-imports' and public.authorized() and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.attendance_imports i where i.storage_path=name));

revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.authorized(),public.is_admin() to authenticated;
grant execute on function public.confirm_import(uuid,text,text,text,bigint,jsonb,jsonb),public.review_record(uuid,public.review_status,text),public.manage_user(uuid,public.app_role,boolean),public.log_export(jsonb),public.dashboard_stats(date,date,uuid) to authenticated;
