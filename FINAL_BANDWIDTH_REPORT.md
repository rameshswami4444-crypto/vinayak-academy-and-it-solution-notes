# Final Bandwidth Optimization Report

Date: 2026-07-24

Scope: Backend Express APIs, high-frequency frontend calls, admin table loading, PDF/R2 handling, and wildcard Supabase selects. Database schema was not changed.

## Files Modified

- `server.js`
- `JS/admin.js`
- `JS/auth.js`
- `JS/script.js`
- `JS/student-pages.js`
- `JS/announcements.js`
- `JS/student-attendance.js`
- `admin.html`
- `api/r2/list.js`
- `package.json`
- `package-lock.json`

## Priority 1: Removed `select("*")`

All scanned runtime files now use explicit column selections.

Verification command used:

```text
Select-String -Path server.js,JS\*.js,api\*.js,api\r2\*.js -Pattern 'select("*")','select(''*'')','select(``*``)' -SimpleMatch
```

Result: no matches.

Examples of replacements:

- `students`: exact student/auth/profile/admin columns from `sql.txt`
- `student_fees`: `id, student_id, total_fee, admission_fee, remaining_fee, total_emis, status, paid_amount, institute_id`
- `emis`: `id, student_id, emi_number, amount, due_date, paid_date, status, payment_id, institute_id`
- `payments`: `id, student_id, emi_id, amount, payment_mode, transaction_id, payment_date, remark, institute_id`
- `announcements`: `id, title, message, target_course, created_at, institute_id, all_courses, content, expires_at, is_pinned, target_courses`
- `admins`: exact auth/account columns from `sql.txt`

## Priority 2: Backend Pagination Added

Added paginated backend APIs:

- `GET /api/admin/students`
- `GET /api/admin/fees`
- `GET /api/admin/emis`
- `GET /api/admin/payments`
- `GET /api/admin/announcements`
- `GET /api/admin/student-report`
- `GET /api/attendance/report`
- `GET /api/student/attendance/history`

All return page metadata:

- `page`
- `limit`
- `total`
- `total_pages`
- `has_more`

Existing material endpoints already had pagination from the previous audit pass:

- `GET /api/materials`
- `GET /api/admin/materials`

## Priority 3: Admin UI Server-Side Pagination

Updated Admin UI to avoid downloading full datasets first for the highest-volume screens:

- Students now load through `/api/admin/students`
- EMI table now loads through `/api/admin/emis`
- Announcements now load through `/api/admin/announcements`
- Student/Fee report now loads through `/api/admin/student-report`
- Attendance report now sends page/limit to `/api/attendance/report`

Existing pagination controls now support:

- Previous
- Next
- Page buttons around current page only
- Page size selector
- Server-side search/filter for the patched tables

Also reduced pagination HTML size by rendering only a small page window instead of every page button.

## Priority 4: Compression and Caching

Enabled Express compression:

- Added `compression` dependency.
- Enabled middleware with `threshold: 1024`.

Enabled/confirmed ETag:

- `app.set("etag", "strong")`
- Static middleware has `etag: true`

Static asset cache headers:

- HTML: `Cache-Control: no-cache`
- JS/CSS/images/fonts: `Cache-Control: public, max-age=604800, immutable`

## Priority 5: Duplicate/Repeated Requests

Reduced repeated attendance requests:

- Student attendance uses Realtime first.
- Polling is 5 seconds only before Realtime subscribes.
- After Realtime subscribes, polling drops to 30 seconds as a backup.
- Debug payloads are opt-in with `?debug=1`.

Reduced repeated material/R2 checks:

- Material list endpoints do not HEAD-check every R2 object by default.
- Verification is opt-in with `?verify=1`.

Reduced repeated full admin fetches:

- Students, EMIs, announcements, reports and attendance reports now fetch current page only.

## PDF and File Bandwidth

Previously optimized:

- `/api/material/:id/content` redirects to a signed R2 URL instead of streaming PDF bytes through the app server.

Current state:

- Normal PDF access uses signed R2 URLs.
- The app server no longer proxies PDF bytes for the fallback content route.
- R2 diagnostic listing is capped and compact.

## Remaining Unpaginated APIs

No known high-volume backend API remains completely unpaginated for the requested categories.

Low/medium-volume endpoints that still return bounded lists:

- `GET /api/attendance/batches`: course-filtered batch list, small by nature.
- `GET /api/attendance/live/:sessionId`: returns one selected batch roster for live attendance.
- `GET /api/attendance/history`: session history can still return many sessions if filters are broad. It should be paginated in a future pass if history grows large.

## Remaining Direct Supabase Reads

Some admin/student functionality still reads directly from Supabase, but explicit column selections are now used.

Remaining direct reads are mostly:

- Courses
- Batches
- Notes
- Assignments
- Login/session validation

These are lower bandwidth than the paginated high-volume tables but should eventually move to backend APIs if central throttling/caching is required.

## Estimated Bandwidth Reduction

Estimated reductions depend on data size:

- Student Management: 70% to 95% less response data for large student tables.
- EMI table: 70% to 95% less response data for large EMI datasets.
- Announcements: 50% to 90% less response data where historical announcements are large.
- Attendance report: 70% to 95% less response data for large date ranges.
- Student attendance polling: about 80% fewer repeated active-check requests after Realtime subscription.
- PDF fallback route: near 100% app-server bandwidth reduction for PDF bytes.
- Static assets: strong reduction on repeat visits due to cache headers and ETag.
- JSON/API compression: 40% to 80% smaller transferred JSON for compressible responses.

## Verification

Commands run:

```text
node --check server.js
node --check JS/admin.js
node --check JS/auth.js
node --check JS/script.js
node --check JS/student-pages.js
node --check JS/announcements.js
node --check JS/student-attendance.js
node --check api/r2/list.js
npm test
```

Results:

- Syntax checks passed.
- `npm test` ran the existing script successfully.
- Wildcard `select("*")` scan returned no matches.

## Production Notes

- Run `npm install` during deployment so the new `compression` dependency is installed.
- Monitor `/api/attendance/live/:sessionId` during very large batches; it intentionally returns the whole selected batch roster.
- Keep `API_DEBUG_PAYLOADS` disabled in production unless diagnosing a live issue.
- Keep `VERIFY_R2_MATERIAL_LISTS` disabled in production unless auditing missing R2 objects.
