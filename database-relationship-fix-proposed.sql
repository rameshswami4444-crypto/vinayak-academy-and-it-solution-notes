-- PROPOSED ONLY: do not run until the read-only audit confirms these exist.
--
-- Why this change may be needed:
-- The public Apply Now workflow does not need a relational dependency from
-- enquiries.course_id to courses.id. The ERP stores a course_name_snapshot for
-- auditability, and adding this FK can cause unrelated public enquiry records
-- to depend on course lifecycle operations.
--
-- Feature fixed:
-- Prevents public enquiry/application records from interfering with Course
-- Management deletes/edits. It does not affect Student Edit, EMI, payments or
-- attendance data.
--
-- Existing data impact:
-- Dropping the FK does not delete or modify rows. It only removes the database
-- enforcement relationship. The course_id value and course_name_snapshot remain.

alter table public.enquiries
    drop constraint if exists enquiries_course_id_fkey;

-- If an older migration was run before the unified enquiries design, remove
-- the disconnected course_enquiries table only after confirming it has no
-- production records you need to keep.
-- drop table if exists public.course_enquiries;
