-- Attendance compatibility migration based on sql.txt.
-- Existing attendance_sessions columns in sql.txt include:
-- id, course_id, subject, lecture_title, duration_minutes, start_time, end_time, status, created_by, created_at, session_id.
-- Batch integration requires batch_id on attendance_sessions.

alter table public.attendance_sessions
    add column if not exists batch_id uuid;

create index if not exists attendance_sessions_course_batch_created_idx
on public.attendance_sessions (course_id, batch_id, created_at desc);

create index if not exists attendance_responses_session_student_idx
on public.attendance_responses (session_id, student_id);

create index if not exists attendance_responses_student_response_time_idx
on public.attendance_responses (student_id, response_time desc);
