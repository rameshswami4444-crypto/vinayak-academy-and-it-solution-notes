-- Preferred schema for course-based access control.
-- The frontend supports both old text values and the new text[] format,
-- but text[] is recommended for storing multiple courses cleanly.

create table if not exists public.students (
    id text primary key,
    password text not null,
    course text[] not null default '{}',
    session_id text
);

alter table public.students
    add column if not exists password text,
    add column if not exists course text[] not null default '{}',
    add column if not exists session_id text;

alter table public.students
    alter column password set not null,
    alter column course set default '{}';
