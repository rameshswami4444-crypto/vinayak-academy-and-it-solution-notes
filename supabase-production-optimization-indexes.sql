-- Production indexes for low-egress LMS runtime queries.
-- Safe to run multiple times.

create index if not exists students_course_id_idx
on public.students (course_id);

create index if not exists students_course_idx
on public.students (course);

create index if not exists students_session_id_idx
on public.students (session_id);

create index if not exists emis_student_due_idx
on public.emis (student_id, due_date);

create index if not exists emis_student_status_idx
on public.emis (student_id, status);

create index if not exists student_fees_student_id_idx
on public.student_fees (student_id);

create index if not exists payments_student_created_idx
on public.payments (student_id, created_at desc);

create index if not exists notes_course_created_idx
on public.notes (course_id, created_at desc);

create index if not exists notes_storage_provider_idx
on public.notes (storage_provider);

create index if not exists material_courses_course_note_idx
on public.material_courses (course_id, note_id);

create index if not exists material_courses_note_course_idx
on public.material_courses (note_id, course_id);

create index if not exists announcements_created_idx
on public.announcements (created_at desc);

create index if not exists announcements_expires_idx
on public.announcements (expires_at);

create index if not exists attendance_sessions_active_course_time_idx
on public.attendance_sessions (course_id, status, start_time, end_time);

create index if not exists attendance_responses_session_student_idx
on public.attendance_responses (session_id, student_id);

create index if not exists attendance_responses_student_created_idx
on public.attendance_responses (student_id, created_at desc);
