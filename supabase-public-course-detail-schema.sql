-- Optional additive schema for richer public course detail pages.
-- Current production code works with the existing courses table, but these fields
-- let public pages render exact images, slugs, highlights, curriculum and FAQs.

alter table public.courses
    add column if not exists slug text,
    add column if not exists category text,
    add column if not exists instructor_name text,
    add column if not exists image_url text,
    add column if not exists level text default 'All Levels',
    add column if not exists total_lessons integer default 0,
    add column if not exists total_quizzes integer default 0,
    add column if not exists total_students integer default 0,
    add column if not exists rating numeric default 0,
    add column if not exists review_count integer default 0,
    add column if not exists short_description text,
    add column if not exists highlights jsonb default '[]'::jsonb,
    add column if not exists curriculum jsonb default '[]'::jsonb,
    add column if not exists faqs jsonb default '[]'::jsonb,
    add column if not exists requirements jsonb default '[]'::jsonb;

create unique index if not exists courses_slug_unique_idx
    on public.courses (slug)
    where slug is not null;

create table if not exists public.enquiries (
    id uuid primary key default gen_random_uuid(),
    enquiry_number text unique,
    enquiry_type text default 'general',
    name text not null,
    father_guardian_name text,
    phone text not null,
    alternate_phone text,
    email text,
    date_of_birth text,
    gender text,
    address text,
    city text,
    state text,
    pin_code text,
    course_category text,
    course_id uuid,
    course_name_snapshot text,
    qualification text,
    preferred_learning_mode text,
    subject text,
    message text not null,
    source text default 'public_contact',
    status text default 'new',
    priority text default 'normal',
    assigned_to text,
    admin_notes text,
    consent_given boolean default false,
    ip_address text,
    user_agent text,
    follow_up_date text,
    updated_at timestamptz default now(),
    contacted_at timestamptz,
    closed_at timestamptz,
    created_at timestamptz default now()
);

alter table public.enquiries
    add column if not exists enquiry_number text,
    add column if not exists enquiry_type text default 'general',
    add column if not exists father_guardian_name text,
    add column if not exists alternate_phone text,
    add column if not exists date_of_birth text,
    add column if not exists gender text,
    add column if not exists address text,
    add column if not exists city text,
    add column if not exists state text,
    add column if not exists pin_code text,
    add column if not exists course_category text,
    add column if not exists course_id uuid,
    add column if not exists course_name_snapshot text,
    add column if not exists qualification text,
    add column if not exists preferred_learning_mode text,
    add column if not exists priority text default 'normal',
    add column if not exists assigned_to text,
    add column if not exists admin_notes text,
    add column if not exists consent_given boolean default false,
    add column if not exists ip_address text,
    add column if not exists user_agent text,
    add column if not exists follow_up_date text,
    add column if not exists updated_at timestamptz default now(),
    add column if not exists contacted_at timestamptz,
    add column if not exists closed_at timestamptz;

alter table public.enquiries
    alter column message drop not null;

create index if not exists enquiries_status_created_idx
    on public.enquiries (status, created_at desc);

create index if not exists enquiries_type_source_created_idx
    on public.enquiries (enquiry_type, source, created_at desc);

create index if not exists enquiries_phone_course_created_idx
    on public.enquiries (phone, course_name_snapshot, created_at desc);

create unique index if not exists enquiries_enquiry_number_unique_idx
    on public.enquiries (enquiry_number)
    where enquiry_number is not null;

create table if not exists public.services (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    title text not null,
    description text,
    full_description text,
    image_url text,
    features jsonb default '[]'::jsonb,
    benefits jsonb default '[]'::jsonb,
    process_steps jsonb default '[]'::jsonb,
    audience text,
    faqs jsonb default '[]'::jsonb,
    status text default 'published',
    created_at timestamptz default now()
);

create index if not exists services_status_slug_idx
    on public.services (status, slug);

create table if not exists public.gallery (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    category text default 'Classroom',
    image_url text not null,
    alt_text text,
    status text default 'published',
    sort_order integer default 0,
    created_at timestamptz default now()
);

create index if not exists gallery_status_category_idx
    on public.gallery (status, category, sort_order);

-- Example seed for the first requested public test page. Run only if this
-- production course should be published.
insert into public.courses (
    course_name,
    slug,
    duration,
    total_fee,
    description,
    category,
    instructor_name,
    level,
    short_description,
    highlights,
    curriculum,
    faqs,
    requirements
)
values (
    'Railway Group D',
    'railway-group-d',
    '6 Months',
    999,
    'Railway Group D preparation course for students targeting central government railway recruitment exams. The program focuses on mathematics, reasoning, general science, general awareness, practice tests and exam-oriented guidance.',
    'Central Government Exams',
    'Admin',
    'All Levels',
    'Exam-oriented preparation for Railway Group D with practical guidance and regular practice.',
    '["Complete coverage of Railway Group D syllabus","Maths, Reasoning, General Science and GK practice","Regular mock tests and doubt support","Guidance from experienced faculty"]'::jsonb,
    '[{"title":"Mathematics","description":"Number system, simplification, percentage, ratio, time and work, speed and distance."},{"title":"Reasoning","description":"Coding-decoding, analogy, series, classification, directions and puzzles."},{"title":"General Science","description":"Physics, Chemistry and Biology topics useful for Railway Group D."},{"title":"General Awareness","description":"Current affairs, Indian polity, history, geography and railway exam updates."}]'::jsonb,
    '[{"question":"Who can join Railway Group D course?","answer":"Students preparing for Railway Group D recruitment can join after confirming eligibility for the official exam."},{"question":"Does the course include practice tests?","answer":"Yes, the course can include regular mock tests and practice sessions."}]'::jsonb,
    '["Basic reading and writing ability","Interest in central government railway exams"]'::jsonb
)
on conflict (slug) do update set
    course_name = excluded.course_name,
    duration = excluded.duration,
    total_fee = excluded.total_fee,
    description = excluded.description,
    category = excluded.category,
    instructor_name = excluded.instructor_name,
    level = excluded.level,
    short_description = excluded.short_description,
    highlights = excluded.highlights,
    curriculum = excluded.curriculum,
    faqs = excluded.faqs,
    requirements = excluded.requirements;

-- Optional rollback guidance:
-- Drop only the new public workflow objects if you have confirmed no production
-- enquiry data is needed:
-- drop index if exists public.enquiries_type_source_created_idx;
-- drop index if exists public.enquiries_phone_course_created_idx;
-- drop index if exists public.enquiries_enquiry_number_unique_idx;
-- drop table if exists public.enquiries;
