# Production Checklist

## Environment

- [ ] `.env` exists only on the VPS.
- [ ] `.env` is not committed.
- [ ] `NODE_ENV=production`.
- [ ] `SESSION_SECRET` is configured.
- [ ] `PDF_ACCESS_SECRET` is configured.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is configured server-side only.
- [ ] R2 credentials are configured.
- [ ] `ALLOWED_ORIGINS` contains only production domains.

## Database

- [ ] Required tables exist: `students`, `admins`, `courses`, `batches`, `notes`, `material_courses`, `enquiries`, `course_enrollments`, `student_fees`, `payments`, `assignments`, `announcements`, `attendance`, `institutes`, `settings`.
- [ ] `approved_students` view exists.
- [ ] RLS reviewed for sensitive tables.
- [ ] Useful indexes reviewed for login, courses, enquiries, enrollments, and notes.
- [ ] Supabase backup/export completed.

## Auth

- [ ] Student Login works.
- [ ] Student session persists after refresh.
- [ ] Student logout works.
- [ ] Admin Login works only through `/admin/login`.
- [ ] Admin session persists after refresh.
- [ ] Admin logout works.
- [ ] Admin Login is not visible on public header/footer/mobile menu.

## PDF Upload And Access

- [ ] Admin can upload a test PDF.
- [ ] Public user cannot upload.
- [ ] Student cannot upload.
- [ ] Authorized student can open assigned PDF.
- [ ] Unauthorized student cannot open PDF.
- [ ] Expired/invalid material token is rejected.
- [ ] Browser never sees stack traces or server file paths.

## Enquiry And Admission

- [ ] Enquiry form submits to backend.
- [ ] Enquiry appears in Admin Enquiries.
- [ ] WhatsApp link opens with normalized number.
- [ ] Get Started submits to backend.
- [ ] Admission appears pending.
- [ ] Approve creates/links student and enrollment.
- [ ] Approved student appears in Approved Students.
- [ ] Approved student dashboard shows course.
- [ ] Reject sets rejected status without student/enrollment creation.

## HTTP And Deployment

- [ ] `/health` returns `{"status":"ok"}`.
- [ ] Nginx redirects HTTP to HTTPS.
- [ ] HTTPS certificate is valid.
- [ ] Nginx forwards `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`.
- [ ] `client_max_body_size` supports legitimate PDFs.
- [ ] PM2 starts `vinayak-academy` in fork mode.
- [ ] `pm2 save` and `pm2 startup` completed.
- [ ] PM2 log rotation configured.

## Cache And Security

- [ ] Static assets are cacheable.
- [ ] Auth/private pages use `no-store`.
- [ ] API auth/material token responses use `no-store`.
- [ ] Sensitive files are not publicly reachable.
- [ ] Security headers are present.
- [ ] HSTS enabled only after HTTPS is confirmed.
- [ ] No secret values appear in logs or browser responses.

## Responsive Smoke Test

- [ ] 360px homepage/login/get-started/enquiry.
- [ ] 375px homepage/login/get-started/enquiry.
- [ ] 414px homepage/login/get-started/enquiry.
- [ ] 768px homepage/login/course/PDF viewer.
- [ ] 1024px admin/student workflows.
- [ ] 1440px homepage/admin/student workflows.

## Rollback

- [ ] Previous commit/tag recorded.
- [ ] Previous app directory backup exists.
- [ ] Previous `.env` secured.
- [ ] Database rollback plan reviewed.
- [ ] Uploaded material handling reviewed.
