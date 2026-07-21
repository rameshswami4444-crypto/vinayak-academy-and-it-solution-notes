# Coaching Attendance Module

The attendance module is intentionally small and built for a coaching institute.

## Database Concepts

- Course
- Batch
- Attendance Session
- Attendance

## Tables

`attendance_sessions` contains only:

- `id`
- `course_id`
- `batch_id`
- `duration_minutes`
- `created_at`
- `created_by`

`attendance` contains only:

- `id`
- `session_id`
- `student_id`
- `status`
- `remarks`
- `marked_at`
- `updated_at`

Allowed status values are `Present`, `Absent`, `Late`, and `Leave`.

## Admin Workflow

1. Select Course.
2. Select Batch.
3. Enter Duration Minutes.
4. Start Attendance.
5. The system loads students from the selected batch.
6. Teacher changes each student's dropdown.
7. Each change auto-saves immediately.

There is no save button, no class scheduling, and no student-side attendance popup.

## Edit Attendance

Attendance Edit uses Course, Batch, and Date filters. If a matching session exists, it is loaded. If not, a simple session is created for that date so the teacher can mark or correct attendance.

## Report

Attendance Report filters by date range, Course, Batch, optional Student ID, and optional Status. It supports sorting, Excel export, PDF print, and direct print.
