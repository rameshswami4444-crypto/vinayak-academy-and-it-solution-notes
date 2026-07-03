# Vinayak Academy Coaching ERP + LMS

Responsive HTML, CSS and JavaScript portal for student learning, admissions, fees, EMI tracking, admin operations and study material delivery through Supabase.

## Current Stack

- HTML, CSS and JavaScript
- Supabase tables for students, admins, courses, fees, EMI, payments, notes and announcements
- Private Supabase Storage bucket: `study-material`
- Shared student layout and protected page checks

## Study Material Flow

Study material is managed from the Admin Panel under **Study Material Management**.

Admin upload fields:

- Course
- Subject
- Title
- PDF file

Files are uploaded to the private `study-material` bucket using this path format:

```text
COURSE/subject/timestamp-filename.pdf
```

The `notes` table stores:

```text
id
course_id
subject
title
created_at
file_path
```

Students only load notes for their assigned course. PDF files open through short-lived signed URLs and storage paths are not shown in the UI.

## Main Files

```text
index.html              Student dashboard
admin.html              Admin panel
login.html              Login page
blocked.html            Blocked student page
styles.css              Main design system
responsive.css          Responsive overrides
JS/auth.js              Login/session/course/EMI protection
JS/student-layout.js    Shared student header/sidebar/footer
JS/notes-page.js        Supabase Storage study material renderer
JS/script.js            Student dashboard logic
JS/admin.js             Admin dashboard, admission, EMI and material management
JS/supabase-config.js   Supabase project config
```

## Notes For Development

- Do not make the `study-material` bucket public.
- Use signed URLs for PDF access.
- Keep authentication, session checks and EMI blocking inside the existing auth flow.
- Add new study material through the admin module instead of hard-coded JavaScript data.

## Browser Support

- Chrome/Chromium
- Firefox
- Safari
- Edge
- Android and iOS mobile browsers
