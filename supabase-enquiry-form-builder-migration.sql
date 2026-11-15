-- Enquiry Form Builder migration
-- Run this file by itself in Supabase SQL Editor.

alter table if exists public.enquiries
    add column if not exists form_data jsonb default '{}'::jsonb;

create table if not exists public.enquiry_form_configs (
    id boolean primary key default true check (id = true),
    title text not null default 'General Enquiry',
    description text not null default 'Send us your question and our team will contact you soon.',
    is_active boolean not null default true,
    fields jsonb not null default '[]'::jsonb,
    all_courses boolean not null default true,
    course_ids jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.enquiry_form_configs
    add column if not exists description text not null default 'Send us your question and our team will contact you soon.',
    add column if not exists is_active boolean not null default true,
    add column if not exists fields jsonb not null default '[]'::jsonb,
    add column if not exists all_courses boolean not null default true,
    add column if not exists course_ids jsonb not null default '[]'::jsonb,
    add column if not exists updated_at timestamptz not null default now();

insert into public.enquiry_form_configs (id, title, description, is_active, fields, all_courses, course_ids)
values (
    true,
    'General Enquiry',
    'Send us your question and our team will contact you soon.',
    true,
    '[{"key":"name","label":"Name","type":"text","required":true,"visible":true},{"key":"phone","label":"Mobile Number","type":"tel","required":true,"visible":true},{"key":"email","label":"Email","type":"email","required":false,"visible":true},{"key":"subject","label":"Subject","type":"text","required":true,"visible":true},{"key":"enquiry_type_option","label":"Enquiry Type","type":"select","required":true,"visible":true,"options":["Course Information","Fees","Admission","Other"]},{"key":"message","label":"Message","type":"textarea","required":true,"visible":true}]'::jsonb,
    true,
    '[]'::jsonb
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
