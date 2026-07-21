# Database Compatibility Report

Source of truth: `sql.txt`

## Schema Read

`sql.txt` was read before this repair. Relevant verified tables and columns:

### `students`

Existing columns:

- `id`
- `password`
- `course`
- `session_id`
- `fees_status`
- `due_date`
- `payment_note`
- `name`
- `father_name`
- `mobile`
- `email`
- `address`
- `course_id`
- `batch_id`
- `admission_date`
- `account_status`
- `created_at`
- `alternate_mobile`
- `batch`
- `course_duration`
- `failed_attempts`
- `locked_until`
- `last_failed_login`

Important: `students.full_name` and `students.student_name` do not exist.

### `courses`

Existing columns:

- `id`
- `course_name`
- `duration`
- `total_fee`
- `description`
- `created_at`
- `institute_id`

### `batches`

Existing columns:

- `id`
- `batch_name`
- `course_id`
- `start_date`
- `end_date`
- `timing`
- `institute_id`

Important: `batches.start_time`, `batches.end_time`, `batches.created_at`, and `batches.updated_at` do not exist.

### `attendance_sessions`

Existing columns:

- `id`
- `course_id`
- `subject`
- `lecture_title`
- `duration_minutes`
- `start_time`
- `end_time`
- `status`
- `created_by`
- `created_at`
- `session_id`

Important: `attendance_sessions.batch_id` does not exist in `sql.txt` and is required for Batch Attendance filtering.

### `attendance_responses`

Existing columns:

- `id`
- `session_id`
- `student_id`
- `response`
- `response_time`
- `created_at`

Important: session attendance responses must use `attendance_responses`, not `attendance`.

### `attendance`

Existing columns:

- `id`
- `student_id`
- `date`
- `status`
- `institute_id`

This table has no `session_id`, `remarks`, `marked_at`, or `updated_at`.

## Fixed Mismatches

### `students.full_name`

Status: fixed.

Problem:

Backend attendance queries selected `students.full_name`, causing:

`column students.full_name does not exist`

Fix:

All Supabase `students` SELECT statements in Attendance now use only:

`id, name, course_id, course, batch_id, batch`

Display name now comes from `students.name` only.

### `students.student_name`

Status: fixed for database queries.

Problem:

Backend attendance queries also selected `students.student_name`, which does not exist in `sql.txt`.

Fix:

Removed from Supabase SELECTs. The JSON response field `student_name` remains only as an API/frontend alias generated from `students.name`.

### `batches.start_time` and `batches.end_time`

Status: fixed.

Problem:

The Batch UI originally attempted to select/write `start_time` and `end_time` on `batches`, but `sql.txt` defines only `timing`.

Fix:

The UI still shows Start Time and End Time, but storage uses existing `batches.timing` as:

`HH:MM - HH:MM`

### `batches.created_at` and `batches.updated_at`

Status: fixed.

Problem:

The Batch code attempted to select/write timestamps that do not exist in `sql.txt`.

Fix:

Batch Management no longer selects or writes those columns.

### `attendance.session_id`

Status: fixed.

Problem:

The session attendance workflow previously queried the `attendance` table as if it had `session_id`.

Fix:

Session attendance now uses `attendance_responses.session_id`.

### `attendance.marked_at`, `attendance.updated_at`, `attendance.remarks`

Status: fixed.

Problem:

These columns do not exist in `sql.txt`.

Fix:

Database writes now use `attendance_responses.response` and `attendance_responses.response_time`. Frontend display aliases like `marked_at` are produced by the backend from `response_time`; they are not queried from Supabase.

## Missing Columns Required By Requested Features

### `batches.status`

Not present in `sql.txt`, but required by the user-requested features:

- Activate Batch
- Deactivate Batch
- Status filter
- Active/Inactive display

Migration:

- `supabase-batches-schema.sql`

### `attendance_sessions.batch_id`

Not present in `sql.txt`, but required by:

- Attendance by Course → Batch
- Attendance Edit by batch
- Attendance Report by batch

Migration:

- `supabase-attendance-schema.sql`

## Required Migrations

Run these compatibility migrations:

1. `supabase-batches-schema.sql`
2. `supabase-attendance-schema.sql`
3. `supabase-students-schema.sql`

`supabase-students-schema.sql` only adds indexes because `students.course_id` and `students.batch_id` already exist in `sql.txt`.

## Batch Management Compatibility Result

Batch Management now uses:

- `batches.id`
- `batches.batch_name`
- `batches.course_id`
- `batches.timing`
- `batches.status` after migration
- `students.batch_id`
- `students.batch` as legacy display fallback
- `students.course_id`
- `students.course`

## Attendance Compatibility Result

Attendance now uses:

- `attendance_sessions.id`
- `attendance_sessions.course_id`
- `attendance_sessions.batch_id` after migration
- `attendance_sessions.subject`
- `attendance_sessions.lecture_title`
- `attendance_sessions.duration_minutes`
- `attendance_sessions.start_time`
- `attendance_sessions.end_time`
- `attendance_sessions.status`
- `attendance_sessions.created_by`
- `attendance_sessions.created_at`
- `attendance_responses.session_id`
- `attendance_responses.student_id`
- `attendance_responses.response`
- `attendance_responses.response_time`

## Remaining Non-Batch LMS Schema Mismatches

These are existing non-Batch/Attendance areas and were not changed in this repair:

### Study Material / Notes

Code references columns not present in `sql.txt` `notes` table:

- `chapter`
- `original_filename`
- `r2_key`
- `file_size`
- `mime_type`
- `uploaded_by`
- `uploaded_at`
- `storage_provider`

### Announcements

Code references columns not present in `sql.txt` `announcements` table:

- `content`
- `is_pinned`
- `all_courses`
- `target_courses`
- `expires_at`

These should be handled separately to avoid mixing unrelated production fixes into the Batch/Attendance repair.
