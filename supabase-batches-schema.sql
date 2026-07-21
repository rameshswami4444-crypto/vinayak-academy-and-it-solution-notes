-- Compatibility migration based on sql.txt.
-- Existing batches columns in sql.txt:
-- id, batch_name, course_id, start_date, end_date, timing, institute_id.
-- Required Batch Management addition: status.

alter table public.batches
    add column if not exists status text default 'Active';

update public.batches
set status = 'Active'
where status is null or trim(status) = '';

alter table public.batches
    drop constraint if exists batches_status_check;

alter table public.batches
    add constraint batches_status_check
    check (status in ('Active', 'Inactive'));

create index if not exists batches_course_status_idx
on public.batches (course_id, status, batch_name);

create index if not exists students_course_batch_idx
on public.students (course_id, batch_id);

create index if not exists students_batch_id_idx
on public.students (batch_id);
