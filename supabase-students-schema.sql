-- Student compatibility migration based on sql.txt.
-- sql.txt already defines students.course_id and students.batch_id.
-- This file only adds safe indexes used by Batch Management filters.

create index if not exists students_course_batch_idx
on public.students (course_id, batch_id);

create index if not exists students_batch_id_idx
on public.students (batch_id);
