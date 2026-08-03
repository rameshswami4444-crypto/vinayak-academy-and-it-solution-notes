# PROJECT_INFO

Permanent technical documentation for the Vinayak Academy ERP and public website project.

Last updated: 2026-08-03

## 1. Project Overview

### Project Name

Vinayak Academy and IT Solution ERP / Student Portal / Public Website

### Purpose

This project runs the public website, admin ERP, and student learning portal for Vinayak Academy and IT Solution. It supports admissions, students, fees, EMI tracking, batches, courses, attendance, announcements, study material, Cloudflare R2 PDF delivery, public course pages, public enquiries, and student access control.

### Current Production Domain

- Primary production domain: `https://www.vinayakacademy.online`
- Alternate production host handled by API config: `https://vinayakacademy.online`
- Reference design website used during public-page work: `https://vinayakacademy.com/`

### Repository

- Local workspace: `D:\telegram alter`
- GitHub repository from `package.json`: `https://github.com/rameshswami4444-crypto/vinayak-academy-and-it-solution-notes`

### Tech Stack

- Runtime: Node.js CommonJS
- Backend framework: Express 5
- Database client: `@supabase/supabase-js`
- Database: Supabase Postgres
- Object storage: Cloudflare R2 using AWS S3-compatible SDK
- Upload parser: Multer
- Frontend: static HTML, CSS, vanilla JavaScript
- PDF rendering: PDF.js in browser
- Icons: Font Awesome, Lucide
- Spreadsheet import/export: XLSX browser library
- Process manager in production: PM2
- Reverse proxy in production: Nginx

## 2. Architecture

### Frontend Structure

Root HTML pages:

- `index.html`: public landing page.
- `public-page.html`: shared dynamic public listing/detail shell for skill courses, competition courses, services, gallery, contact, apply, legal pages.
- `course-detail.html`: dynamic public course detail page shell.
- `login.html`: student/admin login entry.
- `admin.html`: admin ERP interface.
- `dashboard.html`: student dashboard.
- `profile.html`: student profile page.
- `studymaterial.html`: student notes/material page.
- `assignments.html`: student assignments page.
- `emi.html`: student EMI/payment status page.
- `notices.html`: student announcements/notices page.
- `videolecures.html`: placeholder/student videos page.
- `pdf-viewer.html`: full page PDF viewer.
- `blocked.html`: blocked student payment/support page.
- `admin-r2-test.html`: admin-only R2 diagnostic page.

Main frontend JavaScript:

- `JS/supabase-config.js`: frontend Supabase config and route settings.
- `JS/api-config.js`: central API base resolver. All frontend API calls should use `window.VinayakApi`.
- `JS/auth.js`: student/admin auth, session storage, login limits, student blocking logic.
- `JS/admin.js`: admin ERP operations.
- `JS/script.js`: student dashboard.
- `JS/student-pages.js`: profile, EMI page, assignments, notices, videos.
- `JS/student-layout.js`: shared student shell, navigation, attendance script loader.
- `JS/student-attendance.js`: dynamically loaded student attendance modal/watcher.
- `JS/notes-page.js`: study material list and secure PDF opening.
- `JS/pdf-modal-viewer.js`: modal PDF viewer.
- `JS/pdf-viewer.js`: full page PDF viewer.
- `JS/announcements.js`: student-facing announcements.
- `JS/admin-r2-test.js`: R2 diagnostics page.
- `assets/js/public-layout.js`: public header/nav/auth-aware buttons.
- `assets/js/public-pages.js`: public dynamic page renderer.
- `assets/js/course-detail.js`: public dynamic course detail renderer.

CSS:

- `styles.css`: shared/admin/student legacy styles and public additions.
- `responsive.css`: legacy responsive styles.
- `student-portal.css`: student portal and attendance modal styles.
- `login-prototype.css`: login page styles.
- `assets/css/public.css`: public landing/header/footer styles.
- `assets/css/public-pages.css`: public dynamic page styles.
- `assets/css/course-detail.css`: public course detail styles.

### Backend Structure

- `server.js`: single Express server containing API routes, public route handlers, static serving, auth helpers, material authorization, attendance logic, public page data, and admin APIs.
- `api/services/r2.js`: Cloudflare R2 S3-compatible storage service.
- `api/r2/*.js`: R2 diagnostic/list/sign/delete helper endpoints.

### API Architecture

- Backend API routes live in `server.js` under `/api/*`.
- Static pages and assets are served from the project root.
- HTML files are served with `Cache-Control: no-cache`.
- JS/CSS/images are served with `public, max-age=604800, immutable`, so script query strings must be bumped after important frontend fixes.
- Frontend must use `JS/api-config.js` and `window.VinayakApi` instead of hardcoded backend URLs.

### Authentication Flow

Student authentication:

- Student enters ID and password on `login.html`.
- `JS/auth.js` queries the `students` table by configured identifier column, currently `id`.
- Successful login stores student session values in browser storage.
- `students.session_id` stores/validates the active student session.
- Blocked/disabled students are redirected to `blocked.html`.
- Student pages call `window.VinayakAuth.initProtectedPage()`.
- Backend student APIs use `X-Student-Id` and `X-Session-Token`.

Admin authentication:

- Admin login uses `admins` table.
- Admin session is stored in localStorage as `admin_session`.
- Admin API calls include `X-Admin-Id` and `X-Admin-Password` via `apiFetch` in `JS/admin.js`.
- Some legacy admin operations still use direct Supabase browser calls; do not remove those without a usage audit.

### Student Portal

Student pages are protected by `JS/auth.js`. Student features include:

- Dashboard
- Course material previews
- R2 PDF access through signed URLs/proxy
- EMI summary
- Profile
- Attendance modal and attendance history
- Assignments
- Announcements/notices
- Blocked-account support page

### Admin Portal

`admin.html` is a single-page admin ERP. `JS/admin.js` controls:

- Dashboard overview
- Admissions
- Student management
- Student edit
- Fee summary
- EMI create/update/delete
- Course management
- Batch management
- Study material upload/rename/delete/course assignment
- Announcements
- Attendance start/live/edit/report/dashboard
- Reports
- Enquiries
- Bulk import/export
- R2 diagnostics via separate page

### Public Landing Page

Public website integration includes:

- `index.html`: homepage based on Vinayak Academy public design.
- Shared public top bar/header/nav/dropdowns/footer in `assets/js/public-layout.js`.
- Dynamic page shell: `public-page.html` and `/api/public/page-data`.
- Course detail shell: `course-detail.html` and `/api/public/courses/:slug`.
- Apply/contact forms saved to `enquiries`.

## 3. Database

The project uses Supabase Postgres. The original local schema is documented in `sql.txt`. Additional compatibility migrations exist in `supabase-*.sql`.

Important identifier rule: `students.id` is the canonical student identifier. Finance and attendance rows use this value as `student_id`.

Do not assume `uuid`, `login_id`, or `admission_id` exists for student finance flows.

### students

- Purpose: Master student account/profile table and login source.
- Primary key: `id` text.
- Important columns: `password`, `course`, `course_id`, `batch_id`, `batch`, `session_id`, `fees_status`, `due_date`, `payment_note`, `name`, `father_name`, `mobile`, `alternate_mobile`, `email`, `address`, `admission_date`, `account_status`, `course_duration`, `failed_attempts`, `locked_until`, `last_failed_login`.
- Relationships: Original schema has `attendance_responses.student_id -> students.id`. Finance tables store `student_id` text but original schema does not define FKs from `student_fees`, `emis`, or `payments` to `students`.
- APIs using it: student login in `JS/auth.js`, `/api/student/profile`, `/api/dashboard`, `/api/admin/students`, `/api/admin/dashboard/stats`, `/api/admin/student-report`, `/api/admin/emis` create validation, attendance APIs.

### admins

- Purpose: Admin login/accounts.
- Primary key: `username`.
- Important columns: `password`, `role`, `full_name`, `status`, `account_status`, `failed_attempts`, `locked_until`, `last_failed_login`, subscription fields.
- Relationships: `institute_id` references institutes conceptually; original SQL does not list FK constraint for admins.
- APIs using it: admin login in `JS/auth.js`, `requireAdmin()` for `/api/admin/enquiries`.

### courses

- Purpose: Course catalog for ERP, public pages, study material scoping, attendance course selection.
- Primary key: `id` uuid.
- Important columns from original schema: `course_name`, `duration`, `total_fee`, `description`, `created_at`, `institute_id`.
- Public course additions: `slug`, `category`, `instructor_name`, `image_url`, `level`, `total_lessons`, `total_quizzes`, `total_students`, `rating`, `review_count`, `short_description`, `highlights`, `curriculum`, `faqs`, `requirements`.
- Relationships: `courses.institute_id -> institutes.id`; `attendance_sessions.course_id -> courses.id`; `material_courses.course_id -> courses.id`.
- APIs using it: `/api/public/courses/:slug`, `/api/public/page-data`, course management in `JS/admin.js`, `/api/materials`, `/api/admin/materials`, attendance batch/course APIs.

### batches

- Purpose: Course batch definitions for student grouping and attendance.
- Primary key: `id` uuid.
- Important columns: `batch_name`, `course_id`, `start_date`, `end_date`, `status`, `timing`.
- Relationships: Original schema has no FK on `course_id`; batch management treats `course_id` as related to `courses.id`.
- APIs using it: admin batch management direct Supabase calls, `/api/attendance/batches`, attendance start/live/report APIs, dashboard stats.

### student_fees

- Purpose: One fee summary per student.
- Primary key: `id` bigint identity.
- Important columns: `student_id`, `total_fee`, `admission_fee`, `paid_amount`, `remaining_fee`, `total_emis`, `status`, `institute_id`.
- Relationships: Original schema only has `student_fees.institute_id -> institutes.id`. `student_id` must match `students.id` but should not be assumed to have an FK unless live DB audit confirms one.
- APIs using it: `/api/admin/fees`, `/api/student/profile`, `/api/dashboard`, admin admissions, admin student edit, reports.

### emis

- Purpose: Student EMI schedule.
- Primary key: `id` bigint identity.
- Important columns: `student_id`, `emi_number`, `amount`, `due_date`, `paid_date`, `status`, `payment_id`, `institute_id`.
- Relationships: Original schema has `emis.institute_id -> institutes.id`. `student_id` is the selected `students.id`. `payment_id` is a UUID used to correlate with `payments.emi_id`.
- APIs using it: `/api/admin/emis` GET/POST/PATCH/DELETE, `/api/student/profile`, `/api/dashboard`, admin dashboard stats, reports, login status sync in `JS/auth.js`.

### payments

- Purpose: Payment history rows.
- Primary key: `id` bigint identity.
- Important columns: `student_id`, `emi_id`, `amount`, `payment_mode`, `transaction_id`, `payment_date`, `remark`, `institute_id`.
- Relationships: Original schema has `payments.institute_id -> institutes.id`. The project treats `payments.emi_id` as the UUID counterpart for `emis.payment_id`, not as `emis.id`.
- APIs using it: `/api/admin/payments`, student/admin payment views, EMI delete payment-history guard.

### announcements

- Purpose: Notices/announcements for students and admin notifications.
- Primary key: `id` bigint identity.
- Important columns: `title`, `message`, `content`, `target_course`, `target_courses`, `all_courses`, `expires_at`, `is_pinned`, `created_at`, `institute_id`.
- Relationships: `announcements.institute_id -> institutes.id`.
- APIs using it: `/api/admin/announcements`, `JS/announcements.js`, admin announcement management direct Supabase calls.

### attendance

- Purpose: Legacy attendance table.
- Primary key: `id` bigint identity.
- Important columns: `student_id`, `date`, `status`, `institute_id`.
- Relationships: `attendance.institute_id -> institutes.id`.
- APIs using it: not the primary attendance module; current module uses `attendance_sessions` and `attendance_responses`.

### attendance_sessions

- Purpose: Live attendance sessions started by admin.
- Primary key: `id` uuid.
- Important columns: `course_id`, `batch_id`, `subject`, `lecture_title`, `duration_minutes`, `start_time`, `end_time`, `status`, `created_by`, `created_at`, `session_id`.
- Relationships: `attendance_sessions.course_id -> courses.id`. Original `batch_id` type in `sql.txt` is text; compatibility migration adds `batch_id uuid` if needed, so verify live schema before altering.
- APIs using it: `/api/attendance/start`, `/api/attendance/live/:sessionId`, `/api/attendance/edit`, `/api/attendance/history`, `/api/attendance/report`, `/api/student/attendance/active`.

### attendance_responses

- Purpose: Student/admin attendance marks for each session.
- Primary key: `id` uuid.
- Important columns: `session_id`, `student_id`, `response`, `response_time`, `created_at`.
- Relationships: `attendance_responses.session_id -> attendance_sessions.id`; `attendance_responses.student_id -> students.id`.
- APIs using it: `/api/attendance/live/:sessionId`, `/api/attendance/mark`, `/api/attendance/report`, `/api/student/attendance/respond`, `/api/student/attendance/history`.

### notes

- Purpose: Study material metadata. PDFs are not stored here; only metadata and R2 object keys are stored.
- Primary key: `id` bigint identity.
- Important original columns: `course_id`, `subject`, `title`, `file_path`, `created_at`, `institute_id`.
- Study material manager additions: `chapter`, `original_filename`, `r2_key`, `file_size`, `mime_type`, `uploaded_by`, `uploaded_at`, `updated_at`, `course_ids`.
- Relationships: `notes.institute_id -> institutes.id`; `material_courses.note_id -> notes.id`.
- APIs using it: `/api/upload-material`, `/api/materials`, `/api/admin/materials`, `/api/material/:id`, `/api/material/:id/content`, R2 delete/sign workflows.

### material_courses

- Purpose: Many-to-many mapping between notes and courses.
- Primary key: `id` bigint.
- Important columns: `note_id`, `course_id`, `created_at`.
- Relationships: `material_courses.note_id -> notes.id`; `material_courses.course_id -> courses.id`.
- APIs using it: `/api/upload-material`, `/api/materials`, `/api/admin/materials`, material course assignment in admin.

### assignments

- Purpose: Assignment metadata for students.
- Primary key: `id` bigint identity.
- Important columns: `course_id`, `title`, `description`, `due_date`, `file_url`, `institute_id`.
- Relationships: `assignments.institute_id -> institutes.id`.
- APIs using it: Student assignment page uses notes/material fallback in current code; direct assignment APIs are not currently exposed in `server.js`.

### settings

- Purpose: Institute settings such as branding, contact, QR code.
- Primary key: `institute_name`.
- Important columns: `logo_url`, `payment_qr`, `contact_number`, `whatsapp`, `address`, `institute_id`.
- Relationships: `settings.institute_id -> institutes.id`.
- APIs using it: no dedicated Express API currently documented; may be used by direct Supabase in older UI.

### institutes

- Purpose: Multi-institute/subscription ownership model.
- Primary key: `id` uuid.
- Important columns: `institute_name`, `institute_code`, `owner`, `email`, `contact`, `logo_url`, `primary_color`, `status`, `domain`, `subdomain`, subscription/payment fields.
- Relationships: Referenced by several `institute_id` columns.
- APIs using it: indirect only through table FKs and metadata.

### enquiries

- Purpose: Public contact/apply-now form submissions and admin enquiry management.
- Primary key: `id` uuid.
- Important columns: `enquiry_number`, `enquiry_type`, `source`, `name`, `father_guardian_name`, `phone`, `alternate_phone`, `email`, address fields, `course_category`, `course_id`, `course_name_snapshot`, `qualification`, `preferred_learning_mode`, `message`, `status`, `priority`, `assigned_to`, `admin_notes`, `consent_given`, tracking timestamps.
- Relationships: Public workflow should rely on `course_name_snapshot`; do not add a required FK to courses unless explicitly justified.
- APIs using it: `/api/public/contact`, `/api/public/apply-now`, `/api/admin/enquiries`, `/api/admin/enquiries/:id`.

### services

- Purpose: Public website service detail data.
- Primary key: `id` uuid.
- Important columns: `slug`, `title`, `description`, `full_description`, `image_url`, `features`, `benefits`, `process_steps`, `audience`, `faqs`, `status`, `created_at`.
- Relationships: none.
- APIs using it: public pages may use service catalog fallback in server code; no dedicated CRUD API yet.

### gallery

- Purpose: Public gallery image metadata.
- Primary key: `id` uuid.
- Important columns: `title`, `category`, `image_url`, `alt_text`, `status`, `sort_order`, `created_at`.
- Relationships: none.
- APIs using it: public page gallery fallback/static data; no dedicated CRUD API yet.

### login_sessions

- Purpose: Requested documentation item, but no `login_sessions` table is present in `sql.txt` or local migrations.
- Current behavior: student login sessions are stored on `students.session_id` and browser localStorage. Admin sessions are browser localStorage plus `admins` table credential checks.
- Rule: Do not build against a `login_sessions` table unless a live schema audit confirms it exists and the code is updated deliberately.

### study_materials

- Purpose: Requested documentation item. There is no separate `study_materials` table in the local schema.
- Current behavior: `notes` is the production study-material metadata table. Cloudflare R2 stores the PDF objects.
- Rule: Do not create a new `study_materials` table without a migration plan and compatibility layer.

## 4. Cloud Storage

PDF storage rule:

- PDFs are stored ONLY in Cloudflare R2.
- Supabase Storage is NOT used.
- Supabase Storage buckets should remain unused.
- Supabase database stores metadata only.
- Signed URLs are generated from R2 for secure PDF access.

R2 metadata fields:

- `notes.file_path`: R2 object key or legacy file path.
- `notes.r2_key`: preferred R2 object key where available.
- `notes.original_filename`: original PDF name.
- `notes.file_size`, `notes.mime_type`: metadata only.
- `material_courses`: course access mapping.

R2 service:

- `api/services/r2.js`
- Uses AWS SDK S3-compatible commands against Cloudflare R2.

Storage endpoints:

- `POST /api/upload-material`: upload PDF to R2 and save/update note metadata.
- `GET /api/materials`: list student-accessible R2-backed materials.
- `GET /api/admin/materials`: list admin material rows.
- `GET /api/upload-material/health`: R2/Supabase health check.
- `GET /api/material/:id`: authorize material and return signed R2 URL/token metadata.
- `GET /api/material/:id/content`: proxy/stream PDF content from R2 after signed token validation.
- `POST /api/r2/delete`: delete R2 object by key.
- `GET /api/r2/sign`: diagnostic/manual signed URL generation.
- `GET /api/r2/test`: R2 connectivity test.
- `GET /api/r2/credentials`: credential diagnostics.
- `GET /api/r2/list`: list R2 objects.

## 5. Environment Variables

Required in production:

- `PORT`: Express listen port. Defaults to `3000`.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-side Supabase key. Required for backend routes that bypass browser RLS. The current `.env` value appears not to have metadata service-role privileges; verify in Supabase.
- `SUPABASE_ANON_KEY`: browser/public Supabase key and fallback backend key.
- `R2_ACCOUNT_ID`: Cloudflare account id for R2.
- `R2_ACCESS_KEY`: Cloudflare R2 S3 access key.
- `R2_SECRET_KEY`: Cloudflare R2 S3 secret key.
- `R2_BUCKET`: R2 bucket name. Current bucket from `.env`: `vinayak-study-material`.
- `R2_ENDPOINT`: R2 S3 endpoint. Can be generated from account id but should be set in production.

Optional:

- `SUPABASE_SERVICE_KEY`: alternate server-side Supabase key name supported by code.
- `SUPABASE_PUBLISHABLE_KEY`: alternate public Supabase key name supported by code.
- `R2_REGION`: defaults to `auto`.
- `ALLOWED_ORIGINS`: comma-separated CORS allowlist additions.
- `PDF_ACCESS_SECRET`: signs PDF access tokens; falls back to `SESSION_SECRET`, Supabase service key, or frontend key.
- `SESSION_SECRET`: fallback signing secret.
- `API_DEBUG_PAYLOADS`: set `true` for debug payloads.
- `DEBUG_R2_MATERIALS`: set `true` to log R2 material verification details.
- `NODE_ENV`: production hides error details in API responses.

Frontend config:

- `JS/supabase-config.js` sets `window.VINAYAK_SUPABASE_CONFIG`.
- `JS/api-config.js` sets `window.API_BASE_URL` and `window.VINAYAK_API_BASE`.
- Do not hardcode new frontend API URLs. Use `window.VinayakApi`.

## 6. APIs

### Study Material / R2

- `POST /api/upload-material`
  - Purpose: Upload one PDF to Cloudflare R2 and create/update `notes` metadata.
  - Auth: Admin page context; route itself relies on server-side Supabase/R2 config.
  - Body: multipart form with `file`, course ids, subject, chapter, title, note id optionally.
  - Response: JSON success with note metadata/object key.

- `GET /api/materials`
  - Purpose: List R2-backed materials available to a course/student.
  - Auth: Student headers when used by portal.
  - Query: `course`, `course_id`, optional debug.
  - Response: JSON rows.

- `GET /api/admin/materials`
  - Purpose: Admin material manager list.
  - Auth: Admin UI/API context.
  - Response: JSON rows.

- `GET /api/upload-material/health`
  - Purpose: R2 and backend health diagnostics.
  - Auth: Admin/diagnostic use.
  - Response: config/connection status.

- `GET /api/material/:id`
  - Purpose: Authorize student/admin material access and generate signed R2 URL/token.
  - Auth: student headers or signed token flow.
  - Response: signed URL and metadata.

- `GET /api/material/:id/content`
  - Purpose: Stream/proxy PDF from R2 after token validation.
  - Auth: signed access token.
  - Response: PDF stream.

- `POST /api/r2/delete`
  - Purpose: Delete an R2 object.
  - Auth: diagnostic/admin endpoint; protect before public exposure.
  - Body: object key.
  - Response: deleted key/status.

- `GET /api/r2/sign`
  - Purpose: Generate diagnostic signed URL.
  - Query: object key.
  - Response: signed URL.

- `GET /api/r2/test`
  - Purpose: Test R2 bucket connectivity.
  - Response: connectivity details.

- `GET /api/r2/credentials`
  - Purpose: Show masked R2 credential diagnostics.
  - Response: masked config and missing variables.

- `GET /api/r2/list`
  - Purpose: List R2 objects.
  - Query: optional prefix.
  - Response: object list.

### Student APIs

- `GET /api/student/profile`
  - Purpose: Authenticated student profile, fees, EMIs.
  - Auth: `X-Student-Id`, `X-Session-Token`.
  - Response: sanitized student, fee, EMI rows.

- `GET /api/dashboard`
  - Purpose: Student dashboard payload.
  - Auth: `X-Student-Id`, `X-Session-Token`.
  - Response: student, fee, EMI, materials/announcements where available.

- `GET /api/student/attendance/active`
  - Purpose: Check if student has active attendance session.
  - Auth: `X-Student-Id`, `X-Session-Token`.
  - Response: active session, existing response, can respond.

- `POST /api/student/attendance/respond`
  - Purpose: Student submits attendance.
  - Auth: `X-Student-Id`, `X-Session-Token`.
  - Body: `session_id`, `status`.
  - Response: saved response.

- `GET /api/student/attendance/history`
  - Purpose: Student attendance history.
  - Auth: `X-Student-Id`, `X-Session-Token`.
  - Response: rows and summary.

### Attendance Admin APIs

- `GET /api/attendance/batches`
  - Purpose: Load batches for attendance controls.
  - Auth: Admin UI context.

- `POST /api/attendance/start`
  - Purpose: Start attendance session.
  - Body: `course_id`, `batch_id`, `subject`, `lecture_title`, `duration_minutes`, `created_by`.

- `GET /api/attendance/live/:sessionId`
  - Purpose: Live attendance rows for session.

- `POST /api/attendance/mark`
  - Purpose: Admin marks/updates student attendance.
  - Body: `session_id`, `student_id`, `status`.

- `GET /api/attendance/edit`
  - Purpose: Load attendance session for editing.

- `GET /api/attendance/history`
  - Purpose: Attendance history list.

- `GET /api/attendance/report`
  - Purpose: Filtered attendance report.

- `GET /api/attendance/report/:sessionId`
  - Purpose: One session attendance report.

- `GET /api/attendance/dashboard`
  - Purpose: Attendance dashboard cards.

### Admin ERP APIs

- `GET /api/admin/dashboard/stats`
  - Purpose: dashboard totals and lists.
  - Query: optional `course_id`, search scope.

- `GET /api/admin/students`
  - Purpose: paginated/filterable student list.
  - Query: `page`, `limit`, `search`, `course_id`, `course`, `batch_id`, `status`.

- `GET /api/admin/fees`
  - Purpose: paginated fee rows.
  - Query: `student_id`, `status`, `search`.

- `GET /api/admin/emis`
  - Purpose: paginated EMI rows; Student Edit uses `student_id`.
  - Query: `student_id`, `status`, `search`.

- `POST /api/admin/emis`
  - Purpose: create exactly one EMI for a student.
  - Body: `student_id`, `emi_number`, `amount`, `due_date`, `status`, `paid_date`.
  - Response: created EMI row.

- `PATCH /api/admin/emis/:id`
  - Purpose: update one EMI by database id and selected student context.
  - Body: `student_id`, optional `emi_id`, `emi_number`, `amount`, `due_date`, `status`, `paid_date`.
  - Response: updated EMI row.

- `DELETE /api/admin/emis/:id`
  - Purpose: delete one EMI by database id and selected student context.
  - Body or query: `student_id`, optional `emi_id`.
  - Business rule: refuses delete when payment history exists for `emis.payment_id -> payments.emi_id`.

- `GET /api/admin/payments`
  - Purpose: paginated payments.
  - Query: `student_id`, `search`.

- `GET /api/admin/announcements`
  - Purpose: paginated announcements.

- `GET /api/admin/student-report`
  - Purpose: course/batch-wise student fee report.

- `GET /api/admin/enquiries`
  - Purpose: list public enquiries/applications.
  - Auth: admin headers.
  - Query: `search`, `status`, `source`, `enquiry_type`, `course`, dates, sort.

- `GET /api/admin/enquiries/:id`
  - Purpose: enquiry detail.
  - Auth: admin headers.

- `PATCH /api/admin/enquiries/:id`
  - Purpose: update enquiry status/priority/follow-up/admin notes.
  - Auth: admin headers.

### Public APIs and Routes

- `GET /api/public/courses/:slug`
  - Purpose: public course detail data.

- `GET /api/public/page-data`
  - Purpose: dynamic public page data.
  - Query: `path`.

- `GET /courses/:slug`
  - Purpose: serve course detail HTML shell.

- `GET /skill-courses`, `/skill-courses/:categorySlug`
  - Purpose: public skill course pages.

- `GET /competition-courses`, `/competition-courses/:categorySlug`
  - Purpose: public competition course pages.

- `GET /services`, `/services/:serviceSlug`
  - Purpose: public service pages.

- `GET /course-gallery`, `/contact`, `/apply-now`, `/about`, `/privacy-policy`, `/terms-and-conditions`
  - Purpose: public content pages.

- `GET /gallery`
  - Purpose: redirect to `/course-gallery`.

- `GET /*.html legacy public redirects`
  - Purpose: redirect selected `.html` public routes to clean routes.

- `POST /api/public/contact`
  - Purpose: public contact enquiry.
  - Body: `name`, `phone`, `email`, `subject`, `message`.
  - Response: saved enquiry id.

- `POST /api/public/apply-now`
  - Purpose: public admission application.
  - Body: student/applicant details, selected course, consent.
  - Response: enquiry number and applicant summary.

- `POST /apply-now`
  - Purpose: redirect form post to `/api/public/apply-now`.

## 7. Admin Features

### Admissions

- Create student in `students`.
- Create fee summary in `student_fees`.
- Create EMI schedule in `emis`.
- Supports auto and manual EMI creation.
- Validates student ID, name, course, batch, mobile, fee totals, and EMI totals.

### Students

- Search/filter/list students.
- View profile.
- Edit profile.
- Archive/delete behavior is soft archive/disable to preserve ERP history.
- Student ID change syncs `student_fees.student_id`, `emis.student_id`, and `payments.student_id`.

### Courses

- Course CRUD via Supabase client in admin UI.
- Courses drive batches, study material access, reports, and public course pages.

### Batches

- Batch CRUD and status.
- Batch course assignment.
- Batch details show students and attendance percentage.
- Prevent deleting batch when students are assigned.

### Study Material

- Upload PDF to Cloudflare R2.
- Save metadata in `notes`.
- Assign courses through `material_courses` / `course_ids`.
- Rename, move subject, replace file, delete file.
- Preview through secure PDF viewer.

### EMI

- List global EMIs.
- Student Edit loads selected student EMIs immediately.
- Add EMI creates one EMI.
- Update EMI by `emis.id` and selected `student_id`.
- Delete EMI by `emis.id` and selected `student_id`.
- Payment-history guard prevents deleting EMIs linked to payment records.

### Payments

- Payment history is currently read/list focused in APIs.
- `payments.student_id` must match `students.id`.
- `payments.emi_id` is UUID counterpart to `emis.payment_id`.

### Attendance

- Start attendance for course/batch.
- Live attendance table.
- Manual mark/edit.
- Student response modal.
- Attendance reports and dashboard.

### Notifications / Announcements

- Create/update/delete announcements.
- Pin/unpin.
- Target all courses or selected courses.
- Student pages show visible announcements.

### Reports

- Course/batch-wise student and fee reports.
- Attendance reports.
- Dashboard stats.

### Settings

- Settings section exists as placeholder in current admin UI.

### Admins

- Admins section exists as placeholder in current admin UI.
- Admin login uses `admins` table.

### Assignments

- Student assignment page currently uses notes/material behavior for assignment PDFs.
- No full assignment admin CRUD API is exposed in `server.js`.

### Enquiries

- Public contact and Apply Now forms insert `enquiries`.
- Admin can list, view, and update enquiry status/priority/follow-up/admin notes.

### Bulk Import

- CSV/XLSX validation.
- Creates students, fee rows, and EMI schedules.
- Supports export to CSV/XLSX.

## 8. Student Features

### Student Dashboard

- Shows profile summary, fee/EMI summary, recent study material, announcements, quick access.
- Uses `/api/dashboard` with direct Supabase fallback.

### Attendance

- Student attendance modal is dynamically loaded by `student-layout.js`.
- Polls `/api/student/attendance/active`.
- Submits to `/api/student/attendance/respond`.
- Profile page shows attendance history.

### Notes / Study Material

- Loads course-specific notes/materials.
- Only R2-backed materials should be shown.
- Opens PDFs through signed R2 URL flow.

### Assignments

- Assignment page loads course material/assignment-like PDFs.
- Uses `student-pages.js` and `notes-page.js`.

### Profile

- Shows student personal, course, fee, EMI, and attendance details.

### Announcements

- Shows visible announcements and notices.

### Payment / EMI

- EMI page shows fee summary and EMI history.
- Blocked students are redirected to blocked page.

### PDF Viewer

- Modal viewer and full-page viewer use PDF.js.
- PDFs are fetched through `/api/material/:id` signed URL or `/api/material/:id/content` proxy fallback.
- Viewer must not expose raw permanent public storage URLs.

## 9. Business Rules

### Student Identifier

- `students.id` is the canonical student identifier.
- Use the same value for `student_fees.student_id`, `emis.student_id`, `payments.student_id`, and attendance response `student_id`.

### EMI Creation

- Admission can create multiple EMIs from schedule.
- Student Edit Add EMI creates one new EMI.
- Next EMI number is one greater than the selected student current max.
- Prevent duplicate click insertion with in-flight guard.

### EMI Update

- Use `emis.id` plus selected `student_id`.
- Do not update by `emi_number` alone because numbers can repeat across students.

### EMI Delete

- Use `emis.id` plus selected `student_id`.
- Do not rely on global paginated EMI cache.
- Do not delete an EMI if payment history exists.
- Payment-history check is `emis.payment_id` to `payments.emi_id`, not `emis.id` to `payments.emi_id`.

### EMI Payment / Student Blocking

- Login/status sync checks unpaid overdue EMIs.
- Overdue unpaid EMIs can set `students.account_status` to `blocked` and `fees_status` to `due`.
- Disabled students should remain disabled.
- Paid/no-overdue students should remain active unless manually disabled.

### Fee Status

- `student_fees.status` and `students.fees_status` are both used.
- Be careful when changing either; reports and login blocking depend on them.

### Student Delete

- Intended ERP behavior is archival/disable, not destructive delete, because fee, EMI, payment, and attendance history must be preserved.

### Attendance

- Attendance sessions are tied to course and batch.
- Students can respond only when active, matching their course/batch, and not already responded.
- Expired sessions can auto-mark missing students absent.

### Login

- Failed attempts increment lock fields.
- Student login validates account status and fees/EMI blocking.
- Admin login validates `admins` table.

### PDF Permissions

- PDFs must be accessible only to enrolled/authorized students or admins.
- R2 object existence is verified/cached.
- Signed URLs expire.
- Do not store or expose permanent public R2 URLs as the primary access mechanism.

### Course Permissions

- Material access checks student course/course_id against note course fields/mappings.
- Public course pages may use fallback catalog data when course rows do not exist.

## 10. Deployment

### Production Components

- Host: Hostinger VPS
- Node process: PM2
- Reverse proxy: Nginx
- Source control: GitHub
- Database: Supabase
- PDF/object storage: Cloudflare R2
- Domain: `www.vinayakacademy.online`

### First-Time Setup

```bash
git clone https://github.com/rameshswami4444-crypto/vinayak-academy-and-it-solution-notes.git
cd vinayak-academy-and-it-solution-notes
npm install --production
cp .env.example .env
```

Create `.env` with production values:

```bash
PORT=3000
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=vinayak-study-material
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
ALLOWED_ORIGINS=https://www.vinayakacademy.online,https://vinayakacademy.online
NODE_ENV=production
```

### PM2 Commands

```bash
pm2 start server.js --name vinayak-erp
pm2 save
pm2 status
pm2 logs vinayak-erp
pm2 restart vinayak-erp
pm2 stop vinayak-erp
```

### Update Commands

```bash
cd /path/to/project
git pull origin main
npm install --production
node --check server.js
find JS assets/js api -name "*.js" -print -exec node --check {} \;
pm2 restart vinayak-erp
pm2 logs vinayak-erp --lines 100
```

### Nginx Example

```nginx
server {
    server_name www.vinayakacademy.online vinayakacademy.online;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Rollback Procedure

```bash
cd /path/to/project
git log --oneline -n 10
git checkout <known-good-commit>
npm install --production
node --check server.js
pm2 restart vinayak-erp
```

If a database migration caused the regression, do not guess. Run `database-foreign-key-audit.sql` in Supabase SQL editor, document the exact constraint, then apply a targeted rollback.

## 11. Project Rules

- Never store PDFs in Supabase Storage.
- Always store PDFs in Cloudflare R2.
- Supabase Storage buckets should remain unused.
- Database stores PDF metadata only.
- Never break existing ERP features while adding Landing Page features.
- Never remove existing APIs without checking every HTML/JS/server usage.
- Do not introduce unnecessary foreign keys.
- Do not add FKs from finance tables to `students` unless the ERP delete/archive behavior has been redesigned and tested.
- Do not change database schema without a migration file and documentation update.
- Do not hardcode URLs. Always use `JS/api-config.js` / `window.VinayakApi`.
- Do not use `emis.payment_id` and `payments.emi_id` as if they were numeric `emis.id`.
- Student Edit finance workflow must use one selected `student_id`.
- Do not let global paginated caches drive selected-student Edit forms.
- Bump script query strings after critical frontend fixes because static assets are cached.
- Keep admin dashboard and student dashboard designs unchanged unless specifically requested.
- Do not delete production data during tests. Use temporary test rows and clean up.

## 12. Regression Prevention

### R2 / Supabase Storage Regression

- Cause: Risk of using Supabase Storage or stale file URLs for PDFs.
- Solution: Centralized R2 service and signed URL/proxy flow.
- Files affected: `api/services/r2.js`, `server.js`, `JS/notes-page.js`, `JS/pdf-viewer.js`, `JS/pdf-modal-viewer.js`.
- Avoid: Never create Supabase Storage upload paths for PDFs.

### API Base / Static Host Regression

- Cause: Frontend pages opened from static hosts could call the wrong `/api/*` origin.
- Solution: `JS/api-config.js` resolves local static dev to `http://localhost:3000` and production to Hostinger domain.
- Files affected: `JS/api-config.js`, frontend pages.
- Avoid: Never hardcode ad hoc API bases in feature files.

### Student Attendance Polling/Bandwidth Regression

- Cause: Large/debug attendance payloads and frequent polling.
- Solution: Debug payloads opt-in and attendance endpoints return compact data.
- Files affected: `server.js`, `JS/student-attendance.js`, attendance reports.
- Avoid: Keep debug payloads behind `?debug=1` or env flag.

### Student Edit EMI Cache Regression

- Cause: Student Edit used global paginated `emisCache`, so selected student EMIs could be absent until Add EMI fetched them.
- Solution: Added stable `editStudentContextId`, selected-student finance fetch, and row-level `data-emi-id`.
- Files affected: `JS/admin.js`, `server.js`, `admin.html`.
- Avoid: Do not use global paginated table cache as the source for selected-student edit forms.

### EMI Delete Identifier Regression

- Cause: Delete tried to match visible row against stale cache and payment guard compared numeric `emis.id` to UUID `payments.emi_id`.
- Solution: Delete sends `student_id` and EMI `id`; backend scopes by both and checks `emis.payment_id -> payments.emi_id`.
- Files affected: `JS/admin.js`, `server.js`.
- Avoid: Do not delete/update EMI by `emi_number` alone.

### Browser Cache Regression

- Cause: Static JS/CSS/images are cached for 7 days, so old `admin.js` can keep running after deployment.
- Solution: Bump query strings in `admin.html`.
- Files affected: `admin.html`.
- Avoid: Update asset version parameters after important frontend fixes.

### Public Website / ERP Coupling Regression

- Cause: Landing page work introduced public routes and schema files near ERP code.
- Solution: Keep public page additions isolated and avoid touching ERP dashboard/student logic unless required.
- Files affected: `index.html`, `public-page.html`, `course-detail.html`, `assets/*`, public API routes in `server.js`.
- Avoid: Do not modify admin/student flows while making visual public-site changes.

### Foreign Key Regression Risk

- Cause: Adding FKs to original no-FK finance relationships can break archive/delete/edit flows.
- Solution: Original schema should be respected; run read-only FK audit before any schema rollback.
- Files affected: `database-foreign-key-audit.sql`, schema migration files.
- Avoid: Never add/drop constraints blindly.

## 13. Feature Test Checklist

All features must be manually tested before production release:

- [ ] Public homepage desktop
- [ ] Public homepage mobile
- [ ] Public top bar/header/navigation
- [ ] Public dropdown menus
- [ ] Public mobile navigation
- [ ] Public course listing pages
- [ ] Public course detail pages
- [ ] Public service pages
- [ ] Public gallery
- [ ] Public contact form
- [ ] Public Apply Now form
- [ ] Student Login
- [ ] Admin Login
- [ ] Logout
- [ ] Role-aware dashboard button
- [ ] Student Dashboard
- [ ] Student Profile
- [ ] Student EMI page
- [ ] Student notices
- [ ] Student assignments
- [ ] Student study material
- [ ] Student attendance modal
- [ ] Student attendance history
- [ ] Blocked student page
- [ ] Admin dashboard
- [ ] Admissions
- [ ] Auto EMI creation
- [ ] Manual EMI creation
- [ ] Student list/search/filter
- [ ] Student Edit
- [ ] Student Delete/archive
- [ ] Student Status
- [ ] Fee Management
- [ ] EMI Create
- [ ] EMI Update
- [ ] EMI Delete
- [ ] EMI Mark Paid
- [ ] Payments load
- [ ] Course CRUD
- [ ] Batch CRUD
- [ ] Batch transfer
- [ ] Study Material Upload
- [ ] R2 Upload
- [ ] R2 Delete
- [ ] Signed URLs
- [ ] PDF modal viewer
- [ ] PDF full-page viewer
- [ ] Notes
- [ ] Assignments
- [ ] Announcements
- [ ] Notifications
- [ ] Attendance start
- [ ] Attendance live view
- [ ] Attendance student response
- [ ] Attendance edit
- [ ] Attendance reports
- [ ] Student reports
- [ ] Enquiries list
- [ ] Enquiry detail
- [ ] Enquiry update
- [ ] Bulk Import
- [ ] CSV export
- [ ] XLSX export
- [ ] API health
- [ ] Search
- [ ] Filters
- [ ] Dashboard cards
- [ ] Mobile UI
- [ ] Desktop UI
- [ ] Responsive layout
- [ ] Production deployment
- [ ] PM2 restart
- [ ] Nginx proxy
- [ ] Cloudflare R2 credentials
- [ ] Supabase connectivity

## 14. Final Audit

Audit performed on 2026-08-03 from local workspace.

Commands run:

```bash
rg --files
Select-String -Path server.js -Pattern 'app\.(get|post|put|patch|delete)\('
Select-String -Path sql.txt -Pattern '^CREATE TABLE public\.|FOREIGN KEY|PRIMARY KEY'
rg -n "students|student_fees|emis|payments" JS server.js admin.html
rg -n "Render|Railway|Vercel|localhost:|debug|console\.log|TODO|FIXME|temporary|test" . --glob "!node_modules/**"
npm test
node --check server.js
node --check JS/*.js
node --check assets/js/*.js
node --check api/**/*.js
```

Findings:

- Dead code: no confirmed safe dead runtime file. `JS/student-attendance.js` has zero static HTML references but is dynamically loaded by `JS/student-layout.js`; it is not safe to remove.
- Unused JS: none confirmed safe to remove.
- Unused CSS: none confirmed safe to remove; shared CSS files are broad and require visual regression review before pruning.
- Unused APIs: no duplicate Express route definitions found in the extracted route list. R2 diagnostic endpoints are intentionally diagnostic.
- Unused SQL: `database-relationship-fix-proposed.sql` is proposed-only rollback guidance and should not be run automatically.
- Duplicate functions: multiple frontend files define local `apiUrl`, `apiFetch`, `escapeHtml`, `money`; this is duplication but intentional/legacy due separate page bundles. Do not refactor without full regression testing.
- Duplicate queries: selected-student finance queries exist in Student Profile, Student Dashboard fallback, and Admin Edit. They target different surfaces and are not safe to remove.
- Unused assets: no confirmed safe unused image asset. Public images are referenced directly or may be fallback/public content.
- Broken imports: `node --check` passed for JS files checked.
- Unused packages: no confirmed unused dependency; `uuid` should be reviewed because current visible server code does not require it directly, but package-level removal needs full dependency audit.
- Debug code: many `console.log`, `console.warn`, and `console.error` statements exist, especially R2/PDF/attendance/EMI diagnostics. They are useful for production incident debugging but may be too verbose.
- Old Render references: none found as runtime config.
- Old Railway references: “Railway Group D” appears as course content, not hosting config.
- Vercel reference: `JS/api-config.js` treats `.vercel.app` as production-like host for API base fallback. This is a compatibility reference, not confirmed dead.
- Unused environment variables: no confirmed unused required env. Optional envs are fallback/debug only.
- Unused database columns: cannot confirm from local code alone because Supabase/live data and RLS are not fully introspectable from this workspace.
- Foreign key live audit: REST access to `information_schema` and `pg_catalog` is blocked; current key cannot list live FKs. Use `database-foreign-key-audit.sql` in Supabase SQL Editor for authoritative live FK list.

