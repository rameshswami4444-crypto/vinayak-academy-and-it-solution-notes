-- Multi-course study material mapping.
-- Run this once in Supabase SQL editor before using multi-course upload.

create table if not exists public.material_courses (
    id uuid primary key default gen_random_uuid(),
    note_id uuid not null references public.notes(id) on delete cascade,
    course_id uuid not null references public.courses(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (note_id, course_id)
);

create index if not exists material_courses_note_id_idx
    on public.material_courses(note_id);

create index if not exists material_courses_course_id_idx
    on public.material_courses(course_id);
