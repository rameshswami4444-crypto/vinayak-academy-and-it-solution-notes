create extension if not exists pgcrypto;

create table if not exists public.attendance_sessions (
    id uuid primary key default gen_random_uuid(),
    course_id text not null,
    subject text not null,
    lecture_title text not null,
    duration_minutes integer not null default 5,
    start_time timestamptz not null,
    end_time timestamptz not null,
    status text not null default 'OPEN',
    created_by text not null default 'admin',
    created_at timestamptz not null default now(),
    constraint attendance_sessions_status_check check (status in ('OPEN', 'CLOSED')),
    constraint attendance_sessions_duration_minutes_check check (duration_minutes > 0)
);

alter table public.attendance_sessions
    add column if not exists duration_minutes integer;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'attendance_sessions'
          and column_name = 'duration'
    ) then
        execute 'update public.attendance_sessions set duration_minutes = coalesce(duration_minutes, duration) where duration_minutes is null';
    end if;
end $$;

update public.attendance_sessions
set duration_minutes = 5
where duration_minutes is null;

alter table public.attendance_sessions
    alter column duration_minutes set default 5,
    alter column duration_minutes set not null;

create table if not exists public.attendance_responses (
    session_id uuid not null,
    student_id text not null,
    response text,
    response_time timestamptz,
    created_at timestamptz not null default now(),
    constraint attendance_responses_response_check check (response in ('PRESENT', 'ABSENT', 'AUTO_ABSENT') or response is null),
    constraint attendance_responses_session_student_unique unique (session_id, student_id)
);

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'attendance_sessions'
          and column_name = 'session_id'
    ) then
        update public.attendance_responses r
        set session_id = s.id::text
        from public.attendance_sessions s
        where r.session_id = s.session_id;
    end if;
end $$;

do $$
declare
    constraint_row record;
begin
    for constraint_row in
        select conname
        from pg_constraint
        where conrelid = 'public.attendance_responses'::regclass
          and contype = 'f'
    loop
        execute format('alter table public.attendance_responses drop constraint if exists %I', constraint_row.conname);
    end loop;
end $$;

alter table public.attendance_responses
    add column if not exists response text,
    add column if not exists response_time timestamptz,
    add column if not exists created_at timestamptz default now();

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'attendance_responses'
          and column_name = 'attendance_status'
    ) then
        execute 'update public.attendance_responses set response = nullif(attendance_status, ''WAITING'') where response is null';
    end if;
end $$;

alter table public.attendance_responses
    alter column session_id type uuid using session_id::uuid;

alter table public.attendance_responses
    drop constraint if exists attendance_responses_session_fk;

alter table public.attendance_responses
    add constraint attendance_responses_session_fk
    foreign key (session_id)
    references public.attendance_sessions(id)
    on delete cascade;

drop index if exists attendance_sessions_course_batch_idx;
create index if not exists attendance_sessions_course_start_idx
on public.attendance_sessions (course_id, start_time desc);

create index if not exists attendance_sessions_status_end_time_idx
on public.attendance_sessions (status, end_time);

create index if not exists attendance_responses_session_idx
on public.attendance_responses (session_id);

alter table public.attendance_sessions drop column if exists session_id;
alter table public.attendance_sessions drop column if exists batch_id;
alter table public.attendance_sessions drop column if exists duration;
alter table public.attendance_responses drop column if exists attendance_status;
alter table public.attendance_responses drop column if exists student_name;

alter table public.attendance_sessions enable row level security;
alter table public.attendance_responses enable row level security;

drop policy if exists "Allow attendance session select" on public.attendance_sessions;
create policy "Allow attendance session select"
on public.attendance_sessions
for select
using (true);

drop policy if exists "Allow attendance session insert" on public.attendance_sessions;
create policy "Allow attendance session insert"
on public.attendance_sessions
for insert
with check (true);

drop policy if exists "Allow attendance session update" on public.attendance_sessions;
create policy "Allow attendance session update"
on public.attendance_sessions
for update
using (true)
with check (true);

drop policy if exists "Allow attendance response select" on public.attendance_responses;
create policy "Allow attendance response select"
on public.attendance_responses
for select
using (true);

drop policy if exists "Allow attendance response insert" on public.attendance_responses;
create policy "Allow attendance response insert"
on public.attendance_responses
for insert
with check (true);

drop policy if exists "Allow attendance response update" on public.attendance_responses;
create policy "Allow attendance response update"
on public.attendance_responses
for update
using (true)
with check (true);
