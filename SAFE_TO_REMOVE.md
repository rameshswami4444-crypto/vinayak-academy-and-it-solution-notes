# SAFE_TO_REMOVE

Audit date: 2026-08-03

This file lists only items that are confirmed unused and safe to remove. Nothing was deleted automatically.

## Confirmed Safe Removals

No files are currently confirmed safe to remove.

The project contains legacy-looking files and diagnostic utilities, but each reviewed candidate either has a direct reference, a dynamic runtime reference, or insufficient evidence for safe deletion.

| File | Reason | Risk | Dependencies |
| --- | --- | --- | --- |
| None | No confirmed unused files found during this audit. | N/A | N/A |

## Review Candidates - Not Safe To Remove Yet

These items may look removable but should not be deleted without owner confirmation and manual regression testing.

| File / Item | Why It Looks Unused | Why It Is Not Safe Yet | Dependencies / Notes |
| --- | --- | --- | --- |
| `JS/student-attendance.js` | Zero direct `<script>` references in HTML. | It is dynamically loaded by `JS/student-layout.js` when student pages initialize. | Required for student attendance modal/watcher. |
| `admin-r2-test.html` and `JS/admin-r2-test.js` | Diagnostic-only page. | It is intentionally referenced and useful for Cloudflare R2 production troubleshooting. | Uses `/api/r2/credentials`, `/api/r2/test`, `/api/r2/list`. |
| `database-relationship-fix-proposed.sql` | Proposed-only SQL file, not runtime code. | It documents a possible targeted rollback. Do not remove until FK audit is complete and owner approves. | Related to public enquiry/course FK risk. |
| `database-foreign-key-audit.sql` | Not runtime code. | This is the required read-only SQL audit script for Supabase FK inspection. | Must be kept for future DB audits. |
| `supabase-*.sql` migration files | Not loaded by runtime. | They document production schema compatibility and must remain as migration history. | Used for future audits/deployments. |
| `PROJECT_AUDIT.md`, `BANDWIDTH_AUDIT.md`, `FINAL_BANDWIDTH_REPORT.md`, `DATABASE_COMPATIBILITY_REPORT.md`, `ATTENDANCE_MODULE_DESIGN.md` | Historical docs. | They explain prior production fixes and regression context. | Keep unless owner wants documentation cleanup. |
| `login-prototype.css`, `login-prototype.js` | Prototype name. | They are actively referenced by `login.html`. | Do not remove unless login page is redesigned. |
| `responsive.css` | Legacy broad responsive CSS. | Referenced by admin/student/login pages. | Removing would likely break layouts. |
| `styles.css` | Large shared stylesheet. | Referenced by admin/student/login pages and contains mixed legacy/current styles. | Requires visual regression before pruning. |
| `uuid` package | No direct visible `require("uuid")` in current top-level scan. | Package removal needs full transitive/runtime audit and deploy test. | Leave installed until dependency cleanup phase. |

## Confirmed Active Runtime Files

The following files are directly or dynamically used:

- `server.js`
- `api/services/r2.js`
- `api/r2/delete.js`
- `api/r2/sign.js`
- `api/r2/test.js`
- `api/r2/credentials.js`
- `api/r2/list.js`
- `JS/admin.js`
- `JS/auth.js`
- `JS/api-config.js`
- `JS/supabase-config.js`
- `JS/announcements.js`
- `JS/student-layout.js`
- `JS/student-attendance.js`
- `JS/student-pages.js`
- `JS/script.js`
- `JS/notes-page.js`
- `JS/pdf-modal-viewer.js`
- `JS/pdf-viewer.js`
- `assets/js/public-layout.js`
- `assets/js/public-pages.js`
- `assets/js/course-detail.js`

## Audit Notes

- No duplicate Express route definitions were confirmed.
- Multiple page bundles define helper functions such as `apiUrl`, `apiFetch`, `escapeHtml`, and `money`. This is duplication, but it is not safe to remove without refactoring every page bundle.
- Console logging is extensive in R2/PDF/attendance/EMI code. It is not dead code, but production log verbosity should be reviewed separately.
- No old Render hosting config was found.
- “Railway” references are course content, not Railway hosting references.
- `.vercel.app` appears only in frontend API host fallback logic and may be historical compatibility.

