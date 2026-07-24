# Backend Bandwidth Audit

Date: 2026-07-24

Scope: Express backend, R2 API handlers, and the frontend calls that repeatedly hit backend endpoints. No database schema changes were made.

## Changes Made

### PDF Serving

- Changed `GET /api/material/:id/content` from proxy streaming R2 PDFs through Render to returning a `302` redirect to a signed Cloudflare R2 URL after authorization.
- Result: PDF bytes no longer pass through Render for the fallback PDF route.
- Functionality preserved: the backend still validates student session and course access before issuing the redirect.

### Study Material Lists

- `GET /api/materials`
  - Student lookup now selects only required columns instead of `students.*`.
  - Added response pagination metadata: `page`, `limit`, `total`, `has_more`.
  - Default limit: `200`, max: `500`.
  - R2 object existence checks are no longer run for every list item by default.
  - R2 verification can be requested with `?verify=1` or enabled with `VERIFY_R2_MATERIAL_LISTS=true`.

- `GET /api/admin/materials`
  - Added backend pagination with default `limit=250`, max `1000`.
  - `material_courses` now selects only `note_id, course_id` instead of `*`.
  - R2 object existence checks are opt-in with `?verify=1`.

### Attendance APIs

- `GET /api/student/attendance/active`
  - Large debug payloads are no longer returned on every poll.
  - Debug output is now opt-in via `?debug=1` or `API_DEBUG_PAYLOADS=true`.
  - Student-facing session payload now includes only popup-required fields.

- `GET /api/attendance/dashboard`
  - No longer returns all today's `attendance_sessions` by default.
  - Callers can request sessions with `?include_sessions=1`.

### Student Attendance Polling

- Student attendance listener now uses Supabase Realtime first.
- The 5-second polling cadence is used until Realtime subscribes.
- After Realtime is active, polling drops to a 30-second backup check.
- Popup countdown remains local and does not call the backend every second.

### R2 Diagnostic Endpoint

- `GET /api/r2/list`
  - Default response limited to 100 files.
  - Max limit capped at 500.
  - Removed pretty-printed JSON response.
  - `etag` is omitted unless `?include_etag=1`.

### Admin Student List

- Admin `fetchStudents()` no longer uses `select("*")`.
- It now selects the student columns used by the UI only.

## Large Response Endpoints Found

### `GET /api/materials`

Risk: High when a course has many PDFs.

Before:
- Loaded all linked notes and legacy notes.
- Verified every R2 object with HEAD checks.
- Returned every material in one response.

After:
- Paginates response.
- Skips R2 HEAD checks by default.
- Still returns legacy and mapped materials for compatibility.

### `GET /api/admin/materials`

Risk: High for admins with hundreds or thousands of PDFs.

Before:
- Returned all material metadata and all material-course mappings.
- Performed R2 existence checks for every file.

After:
- Paginates backend response.
- Limits mapping columns.
- Makes R2 verification opt-in.

Remaining:
- The current admin UI still loads one page into its existing client-side table. Full infinite/lazy loading UI would reduce bandwidth further.

### `GET /api/material/:id/content`

Risk: Critical if PDFs are viewed through fallback route.

Before:
- Render streamed the full PDF response.

After:
- Render authorizes and redirects to signed R2 URL.
- PDF bandwidth goes through Cloudflare R2.

### `GET /api/attendance/report`

Risk: Medium to high for large date ranges.

Current:
- Can return all matching attendance rows for a date range.

Recommendation:
- Add `page`, `limit`, and export-specific endpoints for large reports.
- Keep the UI report view paginated and use separate export generation when needed.

### `GET /api/student/attendance/history`

Risk: Medium for long-running students.

Current:
- Returns all attendance records for the student.

Recommendation:
- Add default monthly range or pagination.

### `GET /api/attendance/live/:sessionId`

Risk: Medium during live classes.

Current:
- Returns all students in the selected batch and their response state.
- Admin Realtime reduces polling, but fallback polling remains.

Recommendation:
- Keep Realtime enabled for `attendance_responses`.
- For very large batches, return changed response rows over Realtime and refresh full roster less often.

### `GET /api/r2/list`

Risk: Medium diagnostic endpoint.

After:
- Limited and compacted.

## Duplicate or Repeated Calls Found

- Student attendance:
  - `JS/student-attendance.js` polls `/api/student/attendance/active`.
  - Optimized to reduce polling after Realtime subscribes.

- Admin attendance:
  - `JS/admin.js` polls `/api/attendance/live/:sessionId` every 15 seconds only when Realtime is unavailable.
  - This is acceptable.

- Student session validation:
  - `JS/auth.js` has a silent session validation interval.
  - This hits Supabase directly, not the Express backend.

- Study material:
  - Student material page calls `/api/materials`, then `/api/material/:id` only when opening a PDF.
  - This is acceptable after pagination and R2 redirect changes.

## Remaining Supabase/Backend Bandwidth Bottlenecks

- Admin tables still load many records directly from Supabase in `JS/admin.js`:
  - `student_fees`
  - `emis`
  - `payments`
  - `announcements`
  - `batches`
- Several admin sections still use client-side pagination after fetching all rows.
- Attendance reports can return large ranges without backend pagination.
- Student attendance history has no backend page/range limit.
- `select("*")` still exists in some student-side direct Supabase calls outside the backend audit scope.

## Files Proxied Through Render

- PDFs:
  - Fixed for `/api/material/:id/content`; it now redirects to R2 instead of streaming.
  - Normal PDF open flow already uses signed R2 URLs from `/api/material/:id`.

- Images:
  - No backend image proxy endpoint was found in `server.js`.
  - Static images served by `express.static(__dirname)` still come from Render if referenced from the app bundle.

## Estimated Bandwidth Reduction

- PDF fallback route: up to nearly 100% Render bandwidth reduction for PDFs opened through `/api/material/:id/content`.
- Student attendance active checks: small per-request reduction, but significant over time because the call is repeated.
- Student attendance polling frequency: about 80% fewer active-check requests after Realtime subscribes.
- Material listing: large reduction for libraries with many PDFs because R2 HEAD checks are skipped and response size is capped.
- R2 list diagnostics: 50% to 90% smaller responses depending on bucket size.

## Production Recommendations

- Add backend paginated endpoints for Students, Fees, EMIs, Payments, Announcements, and Reports.
- Move admin tables away from direct `select("*")` Supabase calls.
- Add HTTP compression at Render or Express middleware level.
- Add `Cache-Control` headers for static JS/CSS/assets.
- Keep PDFs on signed R2 URLs; do not stream PDFs through Render.
- Use Realtime only for Attendance live updates and necessary notifications.
- Add server-side export jobs for very large Attendance reports instead of returning huge JSON.
