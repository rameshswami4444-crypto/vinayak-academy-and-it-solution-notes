-- Study Material Manager metadata migration
-- Scope: Study Material only. Does not alter students, fees, EMI, attendance, auth, or admissions.

alter table public.notes
    add column if not exists original_filename text,
    add column if not exists r2_key text,
    add column if not exists file_size bigint,
    add column if not exists mime_type text,
    add column if not exists course_ids jsonb,
    add column if not exists chapter text,
    add column if not exists uploaded_by text,
    add column if not exists uploaded_at timestamptz,
    add column if not exists storage_provider text default 'r2';

update public.notes
set
    r2_key = coalesce(r2_key, file_path),
    original_filename = coalesce(original_filename, title),
    mime_type = coalesce(mime_type, 'application/pdf'),
    uploaded_at = coalesce(uploaded_at, created_at),
    storage_provider = coalesce(storage_provider, 'r2')
where file_path is not null;

update public.notes n
set course_ids = mapped.course_ids
from (
    select note_id, jsonb_agg(distinct course_id) as course_ids
    from public.material_courses
    group by note_id
) mapped
where n.id = mapped.note_id
  and n.course_ids is null;

create index if not exists idx_notes_r2_key on public.notes (r2_key);
create index if not exists idx_notes_subject on public.notes (subject);
create index if not exists idx_notes_chapter on public.notes (chapter);
create index if not exists idx_notes_uploaded_at on public.notes (uploaded_at desc);
create index if not exists idx_material_courses_course_id on public.material_courses (course_id);
create index if not exists idx_material_courses_note_id on public.material_courses (note_id);

delete from public.material_courses a
using public.material_courses b
where a.ctid < b.ctid
  and a.note_id = b.note_id
  and a.course_id = b.course_id;

create unique index if not exists idx_material_courses_note_course_unique
    on public.material_courses (note_id, course_id);
