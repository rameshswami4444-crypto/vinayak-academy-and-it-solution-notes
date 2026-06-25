-- Preferred schema for the current portal flow:
-- store one uppercase course string like ADFA / ECCE / DCFA.

create table if not exists public.students (
    id text primary key,
    password text not null,
    course text not null default '',
    session_id text,
    fees_status text not null default 'paid',
    due_date date,
    payment_note text
);

alter table public.students
    add column if not exists password text,
    add column if not exists course text,
    add column if not exists session_id text,
    add column if not exists fees_status text,
    add column if not exists due_date date,
    add column if not exists payment_note text;

do $$
declare
    course_type text;
begin
    select data_type
    into course_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'course';

    if course_type = 'ARRAY' then
        execute $sql$
            alter table public.students
            alter column course type text
            using upper(
                trim(
                    both ' '
                    from replace(
                        replace(
                            replace(coalesce(array_to_string(course, ', '), ''), '[', ''),
                            ']',
                            ''
                        ),
                        '"',
                        ''
                    )
                )
            )
        $sql$;
    else
        execute $sql$
            update public.students
            set course = upper(
                trim(
                    both ' '
                    from replace(replace(replace(course, '[', ''), ']', ''), '"', '')
                )
            )
            where course is not null
        $sql$;
    end if;
end $$;

alter table public.students
    alter column password set not null,
    alter column course set default '',
    alter column course set not null,
    alter column fees_status set default 'paid';

update public.students
set fees_status = 'paid'
where fees_status is null
   or trim(fees_status) = '';

update public.students
set fees_status = lower(trim(fees_status))
where fees_status is not null;

alter table public.students
    alter column fees_status set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'students_fees_status_check'
    ) then
        alter table public.students
            add constraint students_fees_status_check
            check (fees_status in ('paid', 'due'));
    end if;
end $$;

alter table public.students enable row level security;

drop policy if exists "Allow select" on public.students;
create policy "Allow select"
on public.students
for select
using (true);

drop policy if exists "Allow insert" on public.students;
create policy "Allow insert"
on public.students
for insert
with check (true);

drop policy if exists "Allow update" on public.students;
create policy "Allow update"
on public.students
for update
using (true)
with check (true);

drop policy if exists "Allow delete" on public.students;
create policy "Allow delete"
on public.students
for delete
using (true);
