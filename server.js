"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const {
    deletePDF,
    fileExists,
    generateSignedUrl,
    getDiagnostics,
    getPDFObject,
    serializeR2Error,
    testConnection,
    uploadPDF
} = require("./api/services/r2");

const PORT = Number(process.env.PORT || 3000);
const MAX_PDF_SIZE = 200 * 1024 * 1024;
const ATTENDANCE_SESSION_COLUMNS = "id, course_id, batch_id, subject, lecture_title, duration_minutes, start_time, end_time, status, created_by, created_at, session_id";
const ATTENDANCE_RESPONSE_COLUMNS = "id, session_id, student_id, response, response_time, created_at";
const STUDENT_COLUMNS = "id, password, course, session_id, fees_status, due_date, payment_note, name, father_name, mobile, email, address, course_id, batch_id, admission_date, account_status, created_at, alternate_mobile, batch, course_duration, failed_attempts, locked_until, last_failed_login, student_name";
const STUDENT_ADMIN_COLUMNS = "id, password, course, session_id, fees_status, due_date, payment_note, name, father_name, mobile, email, address, course_id, batch_id, admission_date, account_status, created_at, alternate_mobile, batch, course_duration";
const STUDENT_FEE_COLUMNS = "id, student_id, total_fee, admission_fee, remaining_fee, total_emis, status, paid_amount, institute_id";
const EMI_COLUMNS = "id, student_id, emi_number, amount, due_date, paid_date, status, payment_id, institute_id";
const PAYMENT_COLUMNS = "id, student_id, emi_id, amount, payment_mode, transaction_id, payment_date, remark, institute_id";
const ANNOUNCEMENT_COLUMNS = "id, title, message, target_course, created_at, institute_id, all_courses, content, expires_at, is_pinned, target_courses";
const COURSE_COLUMNS = "id, course_name, duration, total_fee, description, created_at, institute_id";
const DB = {
    batches: {
        table: "batches",
        columns: "id, course_id, batch_name, timing, status",
        id: "id",
        courseId: "course_id",
        name: "batch_name",
        timing: "timing",
        status: "status"
    },
    students: {
        table: "students",
        batchId: "batch_id",
        courseId: "course_id"
    },
    attendanceSessions: {
        table: "attendance_sessions",
        batchId: "batch_id",
        courseId: "course_id"
    },
    attendanceResponses: {
        table: "attendance_responses",
        response: "response",
        responseTime: "response_time"
    }
};
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PDF_SIZE }
});

function parsePositiveInt(value, fallback, maxValue) {
    const number = Math.floor(Number(value));
    const safeFallback = Math.max(1, Math.floor(Number(fallback) || 1));
    if (!Number.isFinite(number) || number < 1) return safeFallback;
    return Math.min(number, Math.max(1, Math.floor(Number(maxValue) || number)));
}

function getPageSettings(request, defaults) {
    const settings = defaults || {};
    const page = parsePositiveInt(request.query.page, settings.page || 1, 100000);
    const limit = parsePositiveInt(request.query.limit || request.query.page_size, settings.limit || 25, settings.max || 100);
    return {
        page: page,
        limit: limit,
        from: (page - 1) * limit,
        to: (page - 1) * limit + limit - 1
    };
}

function sendPaged(response, rows, count, pageSettings) {
    const total = Number(count || 0);
    response.json({
        success: true,
        rows: rows || [],
        data: rows || [],
        page: pageSettings.page,
        limit: pageSettings.limit,
        total: total,
        total_pages: Math.max(1, Math.ceil(total / pageSettings.limit)),
        has_more: pageSettings.to + 1 < total
    });
}

function applyIlikeOr(query, columns, search) {
    const term = String(search || "").trim();
    if (!term) return query;
    const escaped = term.replace(/[%(),]/g, " ");
    return query.or(columns.map(function (column) {
        return column + ".ilike.%" + escaped + "%";
    }).join(","));
}

function shouldIncludeDebug(request) {
    return String(request && request.query && request.query.debug || "").trim() === "1" ||
        process.env.API_DEBUG_PAYLOADS === "true";
}

function readFrontendSupabaseConfig() {
    const configPath = path.join(__dirname, "JS", "supabase-config.js");
    if (!fs.existsSync(configPath)) return {};
    const source = fs.readFileSync(configPath, "utf8");
    const urlMatch = source.match(/url:\s*["']([^"']+)["']/) ||
        source.match(/SUPABASE_URL\s*=\s*["']([^"']+)["']/);
    const keyMatch = source.match(/publishableKey:\s*["']([^"']+)["']/) ||
        source.match(/anonKey:\s*["']([^"']+)["']/) ||
        source.match(/SUPABASE_ANON_KEY\s*=\s*["']([^"']+)["']/);
    return {
        url: urlMatch ? urlMatch[1] : "",
        key: keyMatch ? keyMatch[1] : ""
    };
}

function getSupabaseConfig() {
    const frontendConfig = readFrontendSupabaseConfig();
    const url = process.env.SUPABASE_URL || frontendConfig.url || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        frontendConfig.key ||
        "";

    if (!url || !key) {
        const missing = [];
        if (!url) missing.push("SUPABASE_URL");
        if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY");
        throw new Error("Missing Supabase server configuration: " + missing.join(", "));
    }

    return { url: url, key: key };
}

function getSupabaseClient() {
    const config = getSupabaseConfig();
    return createClient(config.url, config.key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
}

function slugPart(value) {
    return String(value || "general").trim()
        .replace(/[\\\/]+/g, "-")
        .replace(/[^a-zA-Z0-9._ -]+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/^-+|-+$/g, "") || "general";
}

function parseCourseIds(value, fallback) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (!value) return fallback ? [String(fallback)] : [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch (error) {
        // Plain comma-separated form values are accepted below.
    }
    return String(value).split(",").map(function (item) {
        return item.trim();
    }).filter(Boolean);
}

function buildObjectKey(courseId, subject, originalName) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString("hex");
    const baseName = String(originalName || "material.pdf").replace(/\.[^/.]+$/, "");
    return [
        String(courseId || "").trim(),
        slugPart(subject),
        timestamp + "-" + random + "-" + slugPart(baseName) + ".pdf"
    ].join("/");
}

function validateMaterialRequest(body, file) {
    const title = String(body.title || "").trim();
    const subject = String(body.subject || "").trim();
    const chapter = String(body.chapter || "").trim();
    const uploadedBy = String(body.uploaded_by || body.uploadedBy || "admin").trim();
    const primaryCourseId = String(body.course_id || body.courseId || body.primary_course_id || "").trim();
    const courseIds = parseCourseIds(body.course_ids || body.courseIds, primaryCourseId);

    if (!title) throw new Error("Title is required.");
    if (!subject) throw new Error("Subject is required.");
    if (!courseIds.length) throw new Error("At least one course UUID is required.");
    if (!file) throw new Error("PDF file is required.");
    if (file.size > MAX_PDF_SIZE) throw new Error("PDF must be 200 MB or smaller.");
    if (file.mimetype && file.mimetype !== "application/pdf") throw new Error("Only PDF files are allowed.");
    if (!/\.pdf$/i.test(file.originalname || "") && file.mimetype !== "application/pdf") {
        throw new Error("Only PDF files are allowed.");
    }

    return {
        noteId: String(body.note_id || body.noteId || "").trim(),
        title: title,
        subject: subject,
        chapter: chapter,
        uploadedBy: uploadedBy,
        originalFilename: String(body.original_filename || body.originalFilename || file.originalname || "").trim(),
        courseIds: courseIds,
        primaryCourseId: courseIds[0]
    };
}

function getUnknownColumn(error) {
    const message = String(error && error.message || "");
    const postgresMatch = message.match(/column [^.]+\.([a-zA-Z0-9_]+) does not exist/);
    if (postgresMatch) return postgresMatch[1];
    const postgrestMatch = message.match(/Could not find the '([^']+)' column/i);
    return postgrestMatch ? postgrestMatch[1] : "";
}

async function runNoteWriteWithFallback(action, payload) {
    const nextPayload = Object.assign({}, payload);
    let lastResult = null;
    for (let attempts = 0; attempts < 12; attempts += 1) {
        lastResult = await action(nextPayload);
        if (!lastResult.error) return lastResult;
        if (lastResult.error.code !== "42703" && lastResult.error.code !== "PGRST204") break;
        const column = getUnknownColumn(lastResult.error);
        if (!column || !Object.prototype.hasOwnProperty.call(nextPayload, column)) break;
        delete nextPayload[column];
    }
    return lastResult;
}

async function syncMaterialCourses(client, noteId, courseIds) {
    await client.from("material_courses").delete().eq("note_id", noteId);
    const rows = courseIds.map(function (courseId) {
        return { note_id: noteId, course_id: courseId };
    });
    const result = await client.from("material_courses").insert(rows);
    if (result.error) throw result.error;
}

async function updateNoteRecord(client, noteId, payload) {
    const withProvider = Object.assign({}, payload, { storage_provider: "r2" });
    const result = await runNoteWriteWithFallback(function (nextPayload) {
        return client.from("notes").update(nextPayload).eq("id", noteId);
    }, withProvider);
    if (result.error) throw result.error;
    return result;
}

async function insertNoteRecord(client, payload) {
    const withProvider = Object.assign({}, payload, { storage_provider: "r2" });
    const result = await runNoteWriteWithFallback(function (nextPayload) {
        return client.from("notes").insert([nextPayload]).select("id").single();
    }, withProvider);
    if (result.error) throw result.error;
    return result;
}

function sendError(response, error, statusCode) {
    const details = serializeR2Error(error);
    console.error("Error details", {
        name: details.name,
        message: details.message,
        code: details.code,
        status: details.status,
        stack: details.stack,
        metadata: details.metadata
    });
    response.status(statusCode || 500).json({
        success: false,
        message: details.message,
        code: details.code,
        status: details.status,
        stack: process.env.NODE_ENV === "production" ? undefined : details.stack,
        details: process.env.NODE_ENV === "production" ? undefined : details
    });
}

function sendApiError(response, statusCode, message, error, context) {
    const details = error ? serializeR2Error(error) : {};
    console.error("API error", {
        message: message,
        context: context || {},
        error: details
    });
    response.status(statusCode || 500).json({
        success: false,
        message: message,
        error: message,
        context: process.env.NODE_ENV === "production" ? undefined : context,
        details: process.env.NODE_ENV === "production" ? undefined : details
    });
}

function getStudentAuthFromRequest(request) {
    return {
        studentId: String(request.get("x-student-id") || request.query.student_id || "").trim(),
        sessionToken: String(request.get("x-session-token") || request.get("authorization") || "").replace(/^Bearer\s+/i, "").trim()
    };
}

function getStudentTokens(student) {
    return [student && student.session_token, student && student.session_id, student && student.sessionId]
        .map(function (value) { return String(value || "").trim(); })
        .filter(Boolean);
}

function isActiveStudent(student) {
    const accountStatus = String(student && (student.account_status || student.status || "active")).trim().toLowerCase();
    return !["blocked", "inactive", "suspended", "disabled"].includes(accountStatus);
}

async function getStudentCourseIds(client, student) {
    const courseIds = [];
    const directCourseId = String(student && student.course_id || "").trim();
    if (directCourseId) courseIds.push(directCourseId);
    const courseName = String(student && (student.course || student.course_name) || "").trim();
    if (!courseName) return courseIds;

    const result = await client
        .from("courses")
        .select("id, course_name")
        .eq("course_name", courseName);
    if (result.error) throw result.error;
    (result.data || []).forEach(function (course) {
        if (course.id && !courseIds.includes(String(course.id))) {
            courseIds.push(String(course.id));
        }
    });
    return courseIds;
}

async function canAccessMaterial(client, note, courseIds) {
    if (!note || !courseIds || !courseIds.length) return false;
    if (courseIds.includes(String(note.course_id || ""))) return true;

    const result = await client
        .from("material_courses")
        .select("id")
        .eq("note_id", note.id)
        .in("course_id", courseIds)
        .limit(1);
    if (result.error) throw result.error;
    return Boolean(result.data && result.data.length);
}

async function selectNotes(client, queryBuilder) {
    let result = await queryBuilder(client
        .from("notes")
        .select("id, course_id, subject, chapter, title, original_filename, r2_key, file_path, file_size, mime_type, uploaded_by, uploaded_at, created_at, storage_provider"));
    if (result.error && (result.error.code === "42703" || result.error.code === "PGRST204")) {
        result = await queryBuilder(client
            .from("notes")
            .select("id, course_id, subject, title, created_at, file_path"));
    }
    if (result.error) throw result.error;
    return result.data || [];
}

function isR2MaterialRecord(note) {
    const provider = String(note && note.storage_provider || "").trim().toLowerCase();
    const key = String(note && (note.r2_key || note.file_path) || "").trim();
    if (provider && provider !== "r2") return false;
    if (!key || /^https?:\/\//i.test(key)) return false;
    return true;
}

const R2_EXISTENCE_CACHE_TTL_MS = 5 * 60 * 1000;
const r2ExistenceCache = new Map();

async function cachedFileExists(objectKey) {
    const key = String(objectKey || "").trim();
    if (!key) return false;
    const cached = r2ExistenceCache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.exists;
    const exists = await fileExists(key);
    r2ExistenceCache.set(key, {
        exists: exists,
        expiresAt: now + R2_EXISTENCE_CACHE_TTL_MS
    });
    return exists;
}

async function filterExistingR2Materials(notes, options) {
    const verifyFiles = !(options && options.verifyFiles === false);
    const unique = {};
    const candidates = [];
    (notes || []).forEach(function (note) {
        const id = String(note && note.id || "");
        if (!id || unique[id] || !isR2MaterialRecord(note)) return;
        unique[id] = true;
        candidates.push({
            id: note.id,
            course_id: note.course_id,
            subject: note.subject,
            chapter: note.chapter || "",
            title: note.title,
            original_filename: note.original_filename || "",
            r2_key: note.r2_key || note.file_path,
            file_size: note.file_size || null,
            mime_type: note.mime_type || "application/pdf",
            uploaded_at: note.uploaded_at || note.created_at,
            created_at: note.created_at,
            storage_provider: "r2"
        });
    });
    if (!verifyFiles) {
        return candidates.sort(function (a, b) {
            return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        });
    }

    const filtered = [];
    const concurrency = 8;
    let cursor = 0;
    let missingCount = 0;
    let failedCount = 0;
    let lastFailure = null;
    async function worker() {
        while (cursor < candidates.length) {
            const item = candidates[cursor];
            cursor += 1;
            try {
                if (await cachedFileExists(item.r2_key)) {
                    filtered.push(item);
                } else {
                    missingCount += 1;
                    console.warn("Skipping note because R2 object is missing", {
                        noteId: item.id,
                        bucket: getDiagnostics().bucket,
                        objectKey: item.r2_key
                    });
                }
            } catch (error) {
                failedCount += 1;
                lastFailure = {
                    noteId: item.id,
                    r2_key: item.r2_key,
                    error: serializeR2Error(error)
                };
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, worker));
    if (missingCount || failedCount || process.env.DEBUG_R2_MATERIALS === "true") {
        console.warn("Study material R2 verification complete", {
            checked: candidates.length,
            returned: filtered.length,
            missingCount: missingCount,
            failedCount: failedCount,
            lastFailure: lastFailure
        });
    }
    return filtered.sort(function (a, b) {
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
}

async function resolveAuthorizedMaterial(request, materialId) {
    const auth = getStudentAuthFromRequest(request);
    console.log("PDF retrieval step: material id received", {
        materialId: materialId
    });
    console.log("PDF retrieval step: student id received", {
        studentId: auth.studentId,
        hasSessionToken: Boolean(auth.sessionToken)
    });

    if (!materialId) {
        const error = new Error("Material id is required.");
        error.statusCode = 400;
        throw error;
    }
    if (!auth.studentId || !auth.sessionToken) {
        const error = new Error("Student session is required.");
        error.statusCode = 401;
        throw error;
    }

    const client = getSupabaseClient();
    console.log("PDF retrieval step: querying student", {
        studentId: auth.studentId
    });
    const studentResult = await client
        .from("students")
        .select(STUDENT_COLUMNS)
        .eq("id", auth.studentId)
        .limit(1);
    if (studentResult.error) throw studentResult.error;

    const student = studentResult.data && studentResult.data[0];
    console.log("PDF retrieval step: student query result", {
        found: Boolean(student),
        studentId: auth.studentId,
        accountStatus: student && (student.account_status || student.status || "active"),
        course: student && (student.course || student.course_name || ""),
        courseId: student && student.course_id
    });
    const tokens = getStudentTokens(student);
    if (!student || !tokens.includes(auth.sessionToken)) {
        const error = new Error("Invalid or expired student session.");
        error.statusCode = 401;
        error.context = { studentId: auth.studentId, materialId: materialId, tokenCount: tokens.length };
        throw error;
    }
    if (!isActiveStudent(student)) {
        const error = new Error("Your account is not active.");
        error.statusCode = 403;
        throw error;
    }

    console.log("PDF retrieval step: querying material", {
        materialId: materialId
    });
    let noteResult = await client
        .from("notes")
        .select("id, course_id, subject, title, r2_key, file_path")
        .eq("id", materialId)
        .limit(1);
    if (noteResult.error && (noteResult.error.code === "42703" || noteResult.error.code === "PGRST204")) {
        noteResult = await client
            .from("notes")
            .select("id, course_id, subject, title, file_path")
            .eq("id", materialId)
            .limit(1);
    }
    if (noteResult.error) throw noteResult.error;

    const note = noteResult.data && noteResult.data[0];
    console.log("PDF retrieval step: database query result", {
        found: Boolean(note),
        materialId: materialId,
        courseId: note && note.course_id,
        title: note && note.title,
        subject: note && note.subject
    });
    if (!note || !(note.r2_key || note.file_path)) {
        const error = new Error("Study material was not found.");
        error.statusCode = 404;
        throw error;
    }

    console.log("PDF retrieval step: file_path/object_key", {
        materialId: materialId,
        objectKey: note.r2_key || note.file_path
    });
    if (!isR2MaterialRecord(note)) {
        const error = new Error("This material has not been migrated to Cloudflare R2.");
        error.statusCode = 404;
        error.context = { materialId: materialId, objectKey: note.r2_key || note.file_path };
        throw error;
    }

    const studentCourseIds = await getStudentCourseIds(client, student);
    console.log("PDF retrieval step: verifying course access", {
        materialId: materialId,
        studentId: auth.studentId,
        noteCourseId: note.course_id,
        studentCourseIds: studentCourseIds
    });
    const allowed = await canAccessMaterial(client, note, studentCourseIds);
    if (!allowed) {
        const error = new Error("You do not have access to this material.");
        error.statusCode = 403;
        error.context = {
            studentId: auth.studentId,
            materialId: materialId,
            noteCourseId: note.course_id,
            studentCourseIds: studentCourseIds
        };
        throw error;
    }

    console.log("PDF retrieval step: verifying R2 object exists", {
        materialId: materialId,
        bucket: getDiagnostics().bucket,
        objectKey: note.r2_key || note.file_path
    });
    const exists = await cachedFileExists(note.r2_key || note.file_path);
    if (!exists) {
        const error = new Error("This PDF file is missing from Cloudflare R2. Please contact admin.");
        error.statusCode = 404;
        error.context = { materialId: materialId, bucket: getDiagnostics().bucket, objectKey: note.r2_key || note.file_path };
        console.warn("PDF open blocked because R2 object is missing", error.context);
        throw error;
    }

    return {
        auth: auth,
        note: note
    };
}

function normalizeAttendanceStatus(value) {
    const raw = String(value || "").trim().toLowerCase();
    const map = {
        present: "Present",
        absent: "Absent",
        late: "Late",
        leave: "Leave"
    };
    return map[raw] || "";
}

function getAttendanceStudentName(student) {
    return String((student && student.name) || "").trim();
}

function buildAttendanceSummary(rows) {
    const summary = {
        total_students: rows.length,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
        attendance_percentage: 0
    };
    rows.forEach(function (row) {
        const status = normalizeAttendanceStatus(row.status || row.response);
        if (status === "Present") summary.present += 1;
        if (status === "Absent") summary.absent += 1;
        if (status === "Late") summary.late += 1;
        if (status === "Leave") summary.leave += 1;
    });
    summary.attendance_percentage = summary.total_students ? Math.round((summary.present / summary.total_students) * 100) : 0;
    return summary;
}

function getRemainingSeconds(session) {
    if (!session || !session.end_time) return 0;
    const endTime = new Date(session.end_time).getTime();
    return Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
}

function toStudentAttendanceSession(session) {
    return session ? {
        id: session.id,
        course_id: session.course_id,
        batch_id: session.batch_id,
        subject: session.subject,
        lecture_title: session.lecture_title,
        duration_minutes: session.duration_minutes,
        start_time: session.start_time,
        end_time: session.end_time,
        status: session.status,
        created_by: session.created_by
    } : null;
}

async function getAttendanceRows(client, session) {
    const sessionId = String(session && session.id || "");
    const courseId = String(session && session.course_id || "");
    const batchId = String(session && session.batch_id || "").trim();
    if (!sessionId || !courseId) return [];

    let studentQuery = client
        .from("students")
        .select("id, name, course_id, course, batch_id, batch");
    if (batchId) {
        studentQuery = studentQuery.eq("batch_id", batchId);
    } else {
        studentQuery = studentQuery.eq("course_id", courseId);
    }
    const students = await studentQuery.order("name", { ascending: true });
    if (students.error) throw students.error;

    const result = await client
        .from(DB.attendanceResponses.table)
        .select(ATTENDANCE_RESPONSE_COLUMNS)
        .eq("session_id", sessionId)
        .order("response_time", { ascending: true });
    if (result.error) throw result.error;

    const responseByStudentId = {};
    (result.data || []).forEach(function (row) {
        responseByStudentId[String(row.student_id)] = row;
    });

    return (students.data || []).map(function (student) {
        const responseRow = responseByStudentId[String(student.id)] || {};
        return {
            session_id: sessionId,
            attendance_id: responseRow.id || "",
            student_id: String(student.id || ""),
            student_name: getAttendanceStudentName(student) || String(student.id || ""),
            batch_id: student.batch_id || "",
            batch: student.batch || "",
            course_id: courseId,
            status: normalizeAttendanceStatus(responseRow.response),
            response: normalizeAttendanceStatus(responseRow.response),
            remarks: "",
            marked_at: responseRow.response_time || responseRow.created_at || null,
            updated_at: responseRow.response_time || responseRow.created_at || null
        };
    });
}

async function getStudentByIdForAttendance(client, studentId) {
    const studentResult = await client
        .from("students")
        .select("id, name, course_id, course, batch_id, batch, session_id, account_status, fees_status")
        .eq("id", studentId)
        .limit(1);
    if (studentResult.error) {
        console.error("Student attendance lookup failed", {
            table: "students",
            studentId: studentId,
            error: studentResult.error
        });
        throw studentResult.error;
    }
    return studentResult.data && studentResult.data[0] ? studentResult.data[0] : null;
}

async function getBatchForAttendance(client, batchId) {
    const batchResult = await client
        .from("batches")
        .select("id, course_id, batch_name")
        .eq("id", batchId)
        .limit(1);
    if (batchResult.error) throw batchResult.error;
    return batchResult.data && batchResult.data[0] ? batchResult.data[0] : null;
}

async function assertAttendanceBatchMatchesCourse(client, courseId, batchId) {
    const batch = await getBatchForAttendance(client, batchId);
    if (!batch) {
        const error = new Error("Selected batch was not found.");
        error.statusCode = 404;
        throw error;
    }
    if (String(batch.course_id || "") !== String(courseId || "")) {
        const error = new Error("Selected batch does not belong to the selected course.");
        error.statusCode = 400;
        throw error;
    }
    return batch;
}

async function ensureStudentCourseIdForAttendance(client, student) {
    return student;
}
async function getAttendanceSession(client, sessionId) {
    const result = await client
        .from("attendance_sessions")
        .select(ATTENDANCE_SESSION_COLUMNS)
        .eq("id", sessionId)
        .limit(1);
    if (result.error) throw result.error;
    return result.data && result.data[0] ? result.data[0] : null;
}

async function buildAttendanceLivePayload(client, session) {
    const rows = await getAttendanceRows(client, session);
    return {
        success: true,
        session: toStudentAttendanceSession(session),
        summary: buildAttendanceSummary(rows),
        remaining_seconds: getRemainingSeconds(session),
        students: rows
    };
}

async function resolveStudentForAttendance(request) {
    const auth = getStudentAuthFromRequest(request);
    if (!auth.studentId || !auth.sessionToken) {
        const error = new Error("Student session is required.");
        error.statusCode = 401;
        throw error;
    }

    const client = getSupabaseClient();
    let student = await getStudentByIdForAttendance(client, auth.studentId);
    student = await ensureStudentCourseIdForAttendance(client, student);
    const tokens = getStudentTokens(student);
    if (!student || !tokens.includes(auth.sessionToken)) {
        const error = new Error("Invalid or expired student session.");
        error.statusCode = 401;
        throw error;
    }
    if (!isActiveStudent(student)) {
        const error = new Error("Your account is not active.");
        error.statusCode = 403;
        throw error;
    }

    return { client: client, auth: auth, student: student };
}

async function getStudentAttendanceCourseIds(client, student) {
    const courseId = String(student && student.course_id || "").trim();
    return courseId ? [courseId] : [];
}

async function getStudentActiveAttendance(client, student, options) {
    const includeDebug = Boolean(options && options.includeDebug);
    const now = new Date().toISOString();
    const courseId = String(student && student.course_id || "").trim();
    const batchId = String(student && student.batch_id || "").trim();
    const debug = {
        student_id: String(student && student.id || ""),
        student_course_id: courseId,
        student_batch_id: batchId,
        attendance_query: {
            table: "attendance_sessions",
            status: "OPEN",
            course_id: courseId,
            batch_id: batchId,
            start_time: "<= " + now,
            end_time: ">= " + now
        },
        sessions_found: 0,
        query_result: [],
        existing_response: null,
        supabase_error: null
    };
    console.log("Student active attendance lookup", debug);
    if (!courseId || !batchId) {
        debug.reason = !courseId ? "Student course_id is missing." : "Student batch_id is missing.";
        return Object.assign({ active: false, session: null, response: null }, includeDebug ? { debug: debug } : {});
    }

    const expiredResult = await client
        .from("attendance_sessions")
        .select(ATTENDANCE_SESSION_COLUMNS)
        .eq("status", "OPEN")
        .eq("course_id", courseId)
        .eq("batch_id", batchId)
        .lt("end_time", now)
        .order("end_time", { ascending: false })
        .limit(3);
    if (expiredResult.error) {
        debug.supabase_error = expiredResult.error;
        throw expiredResult.error;
    }
    for (const expiredSession of (expiredResult.data || [])) {
        const existingExpired = await getStudentAttendance(client, expiredSession.id, student.id);
        if (!existingExpired) {
            console.log("Auto-marking expired student attendance as Absent", {
                student_id: student.id,
                session_id: expiredSession.id,
                batch_id: batchId
            });
            await upsertAttendance(client, {
                session_id: expiredSession.id,
                student_id: student.id,
                status: "Absent",
                marked_at: expiredSession.end_time || now
            });
        }
    }

    const sessionResult = await client
        .from("attendance_sessions")
        .select(ATTENDANCE_SESSION_COLUMNS)
        .eq("status", "OPEN")
        .eq("course_id", courseId)
        .eq("batch_id", batchId)
        .lte("start_time", now)
        .gte("end_time", now)
        .order("created_at", { ascending: false })
        .limit(1);
    if (sessionResult.error) {
        debug.supabase_error = sessionResult.error;
        throw sessionResult.error;
    }
    const sessions = sessionResult.data || [];
    debug.sessions_found = sessions.length;
    debug.query_result = sessions.map(function (row) {
        return {
            id: row.id,
            course_id: row.course_id,
            batch_id: row.batch_id,
            status: row.status,
            start_time: row.start_time,
            end_time: row.end_time
        };
    });
    const session = sessions[0] || null;
    if (!session) {
        console.log("No active attendance session for student", debug);
        return Object.assign({ active: false, session: null, response: null }, includeDebug ? { debug: debug } : {});
    }

    const existing = await getStudentAttendance(client, session.id, student.id);
    debug.existing_response = existing ? {
        id: existing.id,
        session_id: existing.session_id,
        student_id: existing.student_id,
        response: existing.response,
        response_time: existing.response_time
    } : null;
    console.log("Active attendance session found for student", {
        student_id: student.id,
        course_id: courseId,
        batch_id: batchId,
        session_id: session.id,
        already_responded: Boolean(existing)
    });
    return Object.assign({
        active: true,
        session: session,
        response: existing,
        can_respond: !existing,
        remaining_seconds: getRemainingSeconds(session)
    }, includeDebug ? { debug: debug } : {});
}

async function getStudentAttendance(client, sessionId, studentId) {
    const result = await client
        .from(DB.attendanceResponses.table)
        .select(ATTENDANCE_RESPONSE_COLUMNS)
        .eq("session_id", sessionId)
        .eq("student_id", studentId)
        .limit(1);
    if (result.error) throw result.error;
    return result.data && result.data[0] ? result.data[0] : null;
}

async function upsertAttendance(client, settings) {
    const sessionId = String(settings.session_id || "");
    const studentId = String(settings.student_id || "");
    const newStatus = normalizeAttendanceStatus(settings.status);
    const nowIso = new Date().toISOString();
    const payload = {
        session_id: sessionId,
        student_id: studentId,
        response: newStatus,
        response_time: settings.marked_at || nowIso
    };
    const existing = await getStudentAttendance(client, sessionId, studentId);
    const result = existing && existing.id
        ? await client.from(DB.attendanceResponses.table).update(payload).eq("id", existing.id).select(ATTENDANCE_RESPONSE_COLUMNS).single()
        : await client.from(DB.attendanceResponses.table).insert([payload]).select(ATTENDANCE_RESPONSE_COLUMNS).single();
    if (result.error) throw result.error;
    return result.data;
}

function summarizeStudentAttendance(rows) {
    const summary = {
        total: rows.length,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
        percentage: 0
    };
    rows.forEach(function (row) {
        const status = normalizeAttendanceStatus(row.status || row.response);
        if (status === "Present") summary.present += 1;
        if (status === "Absent") summary.absent += 1;
        if (status === "Late") summary.late += 1;
        if (status === "Leave") summary.leave += 1;
    });
    summary.percentage = summary.total ? Math.round((summary.present / summary.total) * 100) : 0;
    return summary;
}

const app = express();
app.set("etag", "strong");
const DEFAULT_ALLOWED_ORIGINS = [
    "https://www.vinayakacademy.online",
    "https://vinayakacademy.online",
    "http://localhost:3000",
    "http://localhost:5500",
    "http://localhost:5501",
    "http://localhost:5502",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:5501",
    "http://127.0.0.1:5502"
];
const configuredAllowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(function (origin) { return origin.trim(); })
    .filter(Boolean);
const allowedOrigins = DEFAULT_ALLOWED_ORIGINS.concat(configuredAllowedOrigins);

const corsOptions = {
    origin: function (origin, callback) {
        try {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
        } catch (error) {
            callback(new Error("Invalid CORS origin."));
            return;
        }
        callback(new Error("CORS origin not allowed."));
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Student-Id", "X-Session-Token"],
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options(/^\/api\//, cors(corsOptions));
app.use(function securityHeaders(request, response, next) {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "SAMEORIGIN");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
});
app.use(compression({
    threshold: 1024
}));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.post("/api/upload-material", upload.single("file"), async function (request, response) {
    console.log("Request received: POST /api/upload-material");

    let objectKey = "";
    try {
        const file = request.file;
        const payload = validateMaterialRequest(request.body, file);
        const client = getSupabaseClient();
        objectKey = buildObjectKey(payload.primaryCourseId, payload.subject, file.originalname);

        console.log("File received", {
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
        });
        console.log("Uploading to R2...");
        await uploadPDF(file.buffer, objectKey);
        console.log("Upload success", { objectKey: objectKey });

        let noteId = payload.noteId;
        let oldObjectKey = "";
        const uploadedAt = new Date().toISOString();
        const notePayload = {
            course_id: payload.primaryCourseId,
            subject: payload.subject,
            chapter: payload.chapter || null,
            title: payload.title,
            original_filename: payload.originalFilename || file.originalname,
            r2_key: objectKey,
            file_path: objectKey,
            file_size: file.size,
            mime_type: file.mimetype || "application/pdf",
            course_ids: payload.courseIds,
            uploaded_by: payload.uploadedBy || "admin",
            uploaded_at: uploadedAt,
            created_at: uploadedAt
        };

        if (noteId) {
            const existing = await client.from("notes").select("id,file_path").eq("id", noteId).single();
            if (existing.error) throw existing.error;
            oldObjectKey = existing.data && existing.data.file_path ? existing.data.file_path : "";
            await updateNoteRecord(client, noteId, notePayload);
        } else {
            const insertResult = await insertNoteRecord(client, notePayload);
            noteId = insertResult.data && insertResult.data.id;
            if (!noteId) throw new Error("Supabase insert succeeded without returning notes.id.");
        }

        await syncMaterialCourses(client, noteId, payload.courseIds);
        console.log("Supabase insert success", {
            noteId: noteId,
            courses: payload.courseIds.length
        });

        if (oldObjectKey && oldObjectKey !== objectKey) {
            deletePDF(oldObjectKey).catch(function (deleteError) {
                console.error("Old R2 object cleanup failed", deleteError);
            });
        }

        response.json({
            success: true,
            noteId: noteId,
            key: objectKey,
            file_path: objectKey,
            courseIds: payload.courseIds
        });
    } catch (error) {
        if (objectKey) {
            deletePDF(objectKey).catch(function (deleteError) {
                console.error("R2 cleanup after upload-material failure failed", deleteError);
            });
        }
        sendError(response, error, 500);
    }
});

app.get("/api/materials", async function (request, response) {
    const auth = getStudentAuthFromRequest(request);
    console.log("Material list requested", {
        studentId: auth.studentId
    });

    try {
        if (!auth.studentId || !auth.sessionToken) {
            response.status(401).json({ success: false, message: "Student session is required." });
            return;
        }

        const client = getSupabaseClient();
        const studentResult = await client
            .from("students")
            .select("id, course, course_id, session_id, account_status, fees_status")
            .eq("id", auth.studentId)
            .limit(1);
        if (studentResult.error) throw studentResult.error;

        const student = studentResult.data && studentResult.data[0];
        const tokens = getStudentTokens(student);
        if (!student || !tokens.includes(auth.sessionToken)) {
            response.status(401).json({ success: false, message: "Invalid or expired student session." });
            return;
        }
        if (!isActiveStudent(student)) {
            response.status(403).json({ success: false, message: "Your account is not active." });
            return;
        }

        const courseIds = await getStudentCourseIds(client, student);
        if (!courseIds.length) {
            response.json({ success: true, materials: [] });
            return;
        }

        const page = parsePositiveInt(request.query.page, 1, 100000);
        const limit = parsePositiveInt(request.query.limit, 200, 500);
        const offset = (page - 1) * limit;
        const verifyFiles = String(request.query.verify || "").trim() !== "0";

        const linkResult = await client
            .from("material_courses")
            .select("note_id")
            .in("course_id", courseIds);
        if (linkResult.error) throw linkResult.error;

        const noteIds = Array.from(new Set((linkResult.data || []).map(function (row) {
            return row.note_id;
        }).filter(Boolean)));

        const linkedNotes = noteIds.length
            ? await selectNotes(client, function (query) { return query.in("id", noteIds); })
            : [];
        const legacyNotes = await selectNotes(client, function (query) {
            return query.in("course_id", courseIds);
        });
        const allMaterials = await filterExistingR2Materials(linkedNotes.concat(legacyNotes), { verifyFiles: verifyFiles });
        const materials = allMaterials.slice(offset, offset + limit);

        console.log("Material list returned", {
            studentId: auth.studentId,
            total: materials.length
        });

        response.json({
            success: true,
            materials: materials,
            page: page,
            limit: limit,
            total: allMaterials.length,
            has_more: offset + limit < allMaterials.length
        });
    } catch (error) {
        console.error("Material list fetch error", serializeR2Error(error));
        sendError(response, error, 500);
    }
});

async function resolveStudentForApi(request) {
    const auth = getStudentAuthFromRequest(request);
    if (!auth.studentId || !auth.sessionToken) {
        const error = new Error("Student session is required.");
        error.statusCode = 401;
        throw error;
    }

    const client = getSupabaseClient();
    const studentResult = await client
        .from("students")
        .select(STUDENT_COLUMNS)
        .eq("id", auth.studentId)
        .limit(1);
    if (studentResult.error) throw studentResult.error;
    const student = studentResult.data && studentResult.data[0];
    const tokens = getStudentTokens(student);
    if (!student || !tokens.includes(auth.sessionToken)) {
        const error = new Error("Invalid or expired student session.");
        error.statusCode = 401;
        throw error;
    }
    if (!isActiveStudent(student)) {
        const error = new Error("Your account is not active.");
        error.statusCode = 403;
        throw error;
    }
    return { client: client, auth: auth, student: student };
}

function sanitizeStudent(student) {
    const safe = Object.assign({}, student || {});
    delete safe.password;
    delete safe.session_id;
    delete safe.session_token;
    delete safe.sessionId;
    if (!safe.name && safe.student_name) safe.name = safe.student_name;
    return safe;
}

async function getStudentFinanceRows(client, studentId) {
    const feeResult = await client
        .from("student_fees")
        .select(STUDENT_FEE_COLUMNS)
        .eq("student_id", studentId)
        .limit(1);
    if (feeResult.error) throw feeResult.error;

    const emiResult = await client
        .from("emis")
        .select(EMI_COLUMNS)
        .eq("student_id", studentId)
        .order("due_date", { ascending: true })
        .limit(60);
    if (emiResult.error) throw emiResult.error;

    return {
        fee: feeResult.data && feeResult.data[0] ? feeResult.data[0] : null,
        emis: emiResult.data || []
    };
}

app.get("/api/student/profile", async function (request, response) {
    try {
        const resolved = await resolveStudentForApi(request);
        const finance = await getStudentFinanceRows(resolved.client, resolved.auth.studentId);
        response.json({
            success: true,
            student: sanitizeStudent(resolved.student),
            fee: finance.fee,
            emis: finance.emis
        });
    } catch (error) {
        sendApiError(response, error.statusCode || 500, error.message || "Could not load student profile.", error);
    }
});

app.get("/api/dashboard", async function (request, response) {
    try {
        const resolved = await resolveStudentForApi(request);
        const finance = await getStudentFinanceRows(resolved.client, resolved.auth.studentId);
        const announcementResult = await resolved.client
            .from("announcements")
            .select(ANNOUNCEMENT_COLUMNS)
            .limit(100);
        if (announcementResult.error) throw announcementResult.error;
        response.json({
            success: true,
            student: sanitizeStudent(resolved.student),
            fee: finance.fee,
            emis: finance.emis,
            announcements: announcementResult.data || []
        });
    } catch (error) {
        sendApiError(response, error.statusCode || 500, error.message || "Could not load dashboard.", error);
    }
});

app.get("/api/admin/materials", async function (request, response) {
    try {
        const client = getSupabaseClient();
        const page = parsePositiveInt(request.query.page, 1, 100000);
        const limit = parsePositiveInt(request.query.limit, 250, 1000);
        const offset = (page - 1) * limit;
        const verifyFiles = String(request.query.verify || "").trim() !== "0";
        const notes = await selectNotes(client, function (query) {
            return query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
        });
        const materials = await filterExistingR2Materials(notes, { verifyFiles: verifyFiles });
        const noteIds = materials.map(function (note) { return note.id; }).filter(Boolean);
        const links = noteIds.length
            ? await client.from("material_courses").select("note_id, course_id").in("note_id", noteIds)
            : { data: [], error: null };
        if (links.error) throw links.error;
        response.json({
            success: true,
            materials: materials,
            material_courses: links.data || [],
            page: page,
            limit: limit,
            has_more: notes.length === limit
        });
    } catch (error) {
        console.error("Admin material list fetch error", serializeR2Error(error));
        sendError(response, error, 500);
    }
});

app.get("/api/upload-material/health", async function (request, response) {
    const diagnostics = getDiagnostics();
    response.json({
        success: true,
        route: "/api/upload-material",
        method: "POST",
        r2: {
            accountIdLoaded: Boolean(diagnostics.accountId),
            accessKeyLoaded: diagnostics.accessKeyLoaded,
            secretKeyLoaded: diagnostics.secretKeyLoaded,
            bucketLoaded: Boolean(diagnostics.bucket),
            endpointLoaded: Boolean(diagnostics.endpoint),
            bucket: diagnostics.bucket,
            endpoint: diagnostics.endpoint,
            missingVariables: diagnostics.missingVariables
        }
    });
});

app.get("/api/material/:id", async function (request, response) {
    const materialId = String(request.params.id || "").trim();
    const expiresInSeconds = 300;
    const expiryTime = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    try {
        const authorized = await resolveAuthorizedMaterial(request, materialId);
        const auth = authorized.auth;
        const note = authorized.note;
        const objectKey = note.r2_key || note.file_path;

        console.log("Generating signed R2 URL", {
            studentId: auth.studentId,
            materialId: materialId,
            bucket: getDiagnostics().bucket,
            objectKey: objectKey,
            expiryTime: expiryTime
        });
        const signedUrl = await generateSignedUrl(objectKey, { expiresIn: expiresInSeconds });
        const fallbackUrl = "/api/material/" + encodeURIComponent(materialId) + "/content?access_token=" + encodeURIComponent(createMaterialAccessToken({
            materialId: materialId,
            studentId: auth.studentId,
            objectKey: objectKey,
            expiresAt: Date.now() + expiresInSeconds * 1000
        }));
        console.log("PDF retrieval step: generated signed URL", {
            materialId: materialId,
            objectKey: objectKey,
            bucket: getDiagnostics().bucket,
            signedUrl: signedUrl
        });
        console.log("Signed URL generated", {
            studentId: auth.studentId,
            materialId: materialId,
            objectKey: objectKey,
            expiryTime: expiryTime
        });

        console.log("PDF retrieval step: final response", {
            success: true,
            materialId: materialId,
            expiresIn: expiresInSeconds,
            expiresAt: expiryTime,
            hasUrl: Boolean(signedUrl)
        });
        response.json({
            success: true,
            url: fallbackUrl,
            signedUrl: signedUrl,
            fallbackUrl: fallbackUrl,
            delivery: "proxy",
            expiresIn: expiresInSeconds,
            expiresAt: expiryTime,
            title: note.title,
            subject: note.subject
        });
    } catch (error) {
        console.error("PDF retrieval fetch error", {
            materialId: materialId,
            studentId: getStudentAuthFromRequest(request).studentId,
            error: serializeR2Error(error)
        });
        sendApiError(response, error.statusCode || 500, error.message || "Could not create a secure PDF link.", error, Object.assign({
            materialId: materialId,
            studentId: getStudentAuthFromRequest(request).studentId
        }, error.context || {}));
    }
});

function getMaterialAccessSecret() {
    return String(process.env.PDF_ACCESS_SECRET || process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || getSupabaseConfig().key || "");
}

function createMaterialAccessToken(payload) {
    const body = Buffer.from(JSON.stringify(payload || {}), "utf8").toString("base64url");
    const signature = crypto
        .createHmac("sha256", getMaterialAccessSecret())
        .update(body)
        .digest("base64url");
    return body + "." + signature;
}

function verifyMaterialAccessToken(token, materialId) {
    const parts = String(token || "").split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const expected = crypto
        .createHmac("sha256", getMaterialAccessSecret())
        .update(parts[0])
        .digest("base64url");
    const received = parts[1];
    if (expected.length !== received.length ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
        return null;
    }
    let payload = null;
    try {
        payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    } catch (error) {
        return null;
    }
    if (!payload || String(payload.materialId || "") !== String(materialId || "")) return null;
    if (!payload.objectKey || Number(payload.expiresAt || 0) <= Date.now()) return null;
    return payload;
}

async function sendPdfObject(response, objectKey, context) {
    const info = context || {};
    const pdf = await getPDFObject(objectKey);
    response.setHeader("Content-Type", pdf.contentType || "application/pdf");
    response.setHeader("Content-Disposition", "inline; filename=\"study-material.pdf\"");
    response.setHeader("Cache-Control", "private, no-store, max-age=0");
    response.setHeader("Accept-Ranges", "none");
    if (pdf.contentLength) {
        response.setHeader("Content-Length", String(pdf.contentLength));
    }
    console.log("PDF proxy stream started", {
        studentId: info.studentId || "",
        materialId: info.materialId || "",
        bucket: pdf.bucket || getDiagnostics().bucket,
        objectKey: pdf.objectKey || objectKey,
        contentLength: pdf.contentLength || "",
        contentType: pdf.contentType || "application/pdf"
    });

    const body = pdf.body;
    if (!body) {
        throw new Error("R2 returned an empty PDF body.");
    }
    if (typeof body.pipe === "function") {
        body.on("error", function (error) {
            console.error("PDF proxy stream body error", {
                studentId: info.studentId || "",
                materialId: info.materialId || "",
                objectKey: pdf.objectKey || objectKey,
                error: serializeR2Error(error)
            });
            if (!response.headersSent) {
                response.status(500).end("Could not stream PDF.");
            } else {
                response.destroy(error);
            }
        });
        body.pipe(response);
        return;
    }
    if (typeof body.transformToByteArray === "function") {
        const bytes = await body.transformToByteArray();
        response.end(Buffer.from(bytes));
        return;
    }
    if (body[Symbol.asyncIterator]) {
        Readable.from(body).pipe(response);
        return;
    }
    throw new Error("Unsupported R2 PDF body stream.");
}

app.get("/api/material/:id/content", async function (request, response) {
    const materialId = String(request.params.id || "").trim();
    try {
        const tokenPayload = verifyMaterialAccessToken(request.query.access_token, materialId);
        let studentId = "";
        let objectKey = "";
        if (tokenPayload) {
            studentId = String(tokenPayload.studentId || "");
            objectKey = String(tokenPayload.objectKey || "");
        } else {
            const authorized = await resolveAuthorizedMaterial(request, materialId);
            studentId = authorized.auth.studentId;
            objectKey = authorized.note.r2_key || authorized.note.file_path;
        }
        console.log("PDF content proxy requested", {
            studentId: studentId,
            materialId: materialId,
            bucket: getDiagnostics().bucket,
            objectKey: objectKey
        });
        await sendPdfObject(response, objectKey, {
            studentId: studentId,
            materialId: materialId
        });
    } catch (error) {
        console.error("PDF content proxy error", {
            materialId: materialId,
            studentId: getStudentAuthFromRequest(request).studentId,
            error: serializeR2Error(error)
        });
        sendApiError(response, error.statusCode || 500, error.message || "Could not stream PDF content.", error, Object.assign({
            materialId: materialId,
            studentId: getStudentAuthFromRequest(request).studentId
        }, error.context || {}));
    }
});

app.get("/api/attendance/batches", async function (request, response) {
    try {
        const courseId = String(request.query.course_id || "").trim();
        const client = getSupabaseClient();
        let query = client
            .from(DB.batches.table)
            .select(DB.batches.columns)
            .order(DB.batches.name, { ascending: true });
        if (courseId) query = query.eq(DB.batches.courseId, courseId);
        const result = await query;
        if (result.error) throw result.error;
        const batches = (result.data || []).map(function (batch) {
            return {
                id: batch[DB.batches.id],
                name: batch[DB.batches.name],
                course_id: batch[DB.batches.courseId],
                timing: batch[DB.batches.timing],
                status: batch[DB.batches.status]
            };
        });
        response.json({ success: true, batches: batches });
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load batches.", error);
    }
});

app.post("/api/attendance/start", async function (request, response) {
    try {
        const courseId = String(request.body.course_id || "").trim();
        const batchId = String(request.body.batch_id || request.body.batch || "").trim();
        const durationMinutes = Math.max(1, Math.floor(Number(request.body.duration_minutes || 5)));
        const createdBy = String(request.body.created_by || "admin").trim();
        if (!courseId || !batchId) {
            response.status(400).json({ success: false, message: "course_id and batch_id are required." });
            return;
        }
        const client = getSupabaseClient();
        await assertAttendanceBatchMatchesCourse(client, courseId, batchId);
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
        const sessionPayload = {
            id: crypto.randomUUID(),
            course_id: courseId,
            batch_id: batchId,
            subject: "Attendance",
            lecture_title: "Batch Attendance",
            duration_minutes: durationMinutes,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            status: "OPEN",
            created_by: createdBy
        };
        const sessionInsert = await client
            .from("attendance_sessions")
            .insert([sessionPayload])
            .select(ATTENDANCE_SESSION_COLUMNS)
            .single();
        if (sessionInsert.error) throw sessionInsert.error;
        console.log("Attendance session inserted row", {
            id: sessionInsert.data.id,
            course_id: sessionInsert.data.course_id,
            batch_id: sessionInsert.data.batch_id,
            status: sessionInsert.data.status,
            start_time: sessionInsert.data.start_time,
            end_time: sessionInsert.data.end_time
        });
        response.json(await buildAttendanceLivePayload(client, sessionInsert.data));
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not start attendance.", error);
    }
});

app.get("/api/attendance/live/:sessionId", async function (request, response) {
    try {
        const client = getSupabaseClient();
        const session = await getAttendanceSession(client, request.params.sessionId);
        if (!session) {
            response.status(404).json({ success: false, message: "Attendance session not found." });
            return;
        }
        response.json(await buildAttendanceLivePayload(client, session));
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load attendance.", error);
    }
});

app.post("/api/attendance/mark", async function (request, response) {
    try {
        const sessionId = String(request.body.session_id || "").trim();
        const studentId = String(request.body.student_id || "").trim();
        const status = normalizeAttendanceStatus(request.body.status);
        if (!sessionId || !studentId || !status) {
            response.status(400).json({ success: false, message: "session_id, student_id, and status are required." });
            return;
        }
        const client = getSupabaseClient();
        const session = await getAttendanceSession(client, sessionId);
        if (!session) {
            response.status(404).json({ success: false, message: "Attendance session not found." });
            return;
        }
        const row = await upsertAttendance(client, {
            session_id: sessionId,
            student_id: studentId,
            status: status,
            remarks: request.body.remarks || ""
        });
        response.json(Object.assign(await buildAttendanceLivePayload(client, session), { attendance: row }));
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not mark attendance.", error);
    }
});

app.get("/api/attendance/edit", async function (request, response) {
    try {
        const courseId = String(request.query.course_id || "").trim();
        const batchId = String(request.query.batch_id || "").trim();
        const date = String(request.query.date || "").trim();
        if (!courseId || !batchId || !date) {
            response.status(400).json({ success: false, message: "course_id, batch_id, and date are required." });
            return;
        }
        const client = getSupabaseClient();
        await assertAttendanceBatchMatchesCourse(client, courseId, batchId);
        const sessionResult = await client
            .from("attendance_sessions")
            .select(ATTENDANCE_SESSION_COLUMNS)
            .eq("course_id", courseId)
            .eq("batch_id", batchId)
            .gte("created_at", date + "T00:00:00")
            .lt("created_at", date + "T23:59:59.999")
            .order("created_at", { ascending: false })
            .limit(1);
        if (sessionResult.error) throw sessionResult.error;
        let session = sessionResult.data && sessionResult.data[0] ? sessionResult.data[0] : null;
        if (!session) {
            const insert = await client
                .from("attendance_sessions")
                .insert([{ id: crypto.randomUUID(), course_id: courseId, batch_id: batchId, subject: "Attendance", lecture_title: "Batch Attendance", duration_minutes: 5, start_time: date + "T00:00:00.000Z", end_time: date + "T00:05:00.000Z", status: "OPEN", created_at: date + "T00:00:00.000Z", created_by: "admin" }])
                .select(ATTENDANCE_SESSION_COLUMNS)
                .single();
            if (insert.error) throw insert.error;
            session = insert.data;
        }
        response.json(await buildAttendanceLivePayload(client, session));
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load attendance edit rows.", error);
    }
});

app.get("/api/attendance/history", async function (request, response) {
    try {
        const client = getSupabaseClient();
        let query = client
            .from("attendance_sessions")
            .select(ATTENDANCE_SESSION_COLUMNS)
            .order("created_at", { ascending: false });
        if (request.query.course_id) query = query.eq("course_id", String(request.query.course_id));
        if (request.query.batch_id) query = query.eq("batch_id", String(request.query.batch_id));
        if (request.query.date) {
            const date = String(request.query.date);
            query = query.gte("created_at", date + "T00:00:00").lt("created_at", date + "T23:59:59.999");
        }
        const result = await query;
        if (result.error) throw result.error;
        response.json({ success: true, sessions: result.data || [] });
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load attendance history.", error);
    }
});

app.get("/api/attendance/report", async function (request, response) {
    try {
        const client = getSupabaseClient();
        const pageSettings = getPageSettings(request, { limit: 50, max: 500 });
        const fromDate = String(request.query.from_date || request.query.from || "").trim();
        const toDate = String(request.query.to_date || request.query.to || "").trim();
        let sessionQuery = client
            .from("attendance_sessions")
            .select(ATTENDANCE_SESSION_COLUMNS)
            .order("created_at", { ascending: false });
        if (fromDate) sessionQuery = sessionQuery.gte("created_at", fromDate + "T00:00:00");
        if (toDate) sessionQuery = sessionQuery.lt("created_at", toDate + "T23:59:59.999");
        if (request.query.course_id) sessionQuery = sessionQuery.eq("course_id", String(request.query.course_id));
        if (request.query.batch_id) sessionQuery = sessionQuery.eq("batch_id", String(request.query.batch_id));
        const sessionResult = await sessionQuery;
        if (sessionResult.error) throw sessionResult.error;
        const sessions = sessionResult.data || [];
        const sessionIds = sessions.map(function (session) { return session.id; });
        let rows = [];
        let totalRows = 0;
        if (sessionIds.length) {
            let attendanceQuery = client
                .from(DB.attendanceResponses.table)
                .select(ATTENDANCE_RESPONSE_COLUMNS, { count: "exact" })
                .in("session_id", sessionIds);
            if (request.query.student_id) attendanceQuery = attendanceQuery.eq("student_id", String(request.query.student_id));
            if (request.query.status) attendanceQuery = attendanceQuery.eq("response", normalizeAttendanceStatus(request.query.status));
            const attendanceResult = await attendanceQuery.range(pageSettings.from, pageSettings.to);
            if (attendanceResult.error) throw attendanceResult.error;
            rows = attendanceResult.data || [];
            totalRows = attendanceResult.count || 0;
        }
        const sessionById = {};
        sessions.forEach(function (session) {
            sessionById[String(session.id)] = session;
        });
        const studentIds = Array.from(new Set(rows.map(function (row) { return row.student_id; }).filter(Boolean)));
        let students = [];
        if (studentIds.length) {
            const studentResult = await client
                .from("students")
                .select("id, name, course_id, course, batch_id, batch")
                .in("id", studentIds);
            if (studentResult.error) throw studentResult.error;
            students = studentResult.data || [];
        }
        const studentById = {};
        students.forEach(function (student) {
            studentById[String(student.id)] = student;
        });
        const batchIds = Array.from(new Set(sessions.map(function (session) { return session.batch_id; }).concat(students.map(function (student) { return student.batch_id; })).filter(Boolean)));
        let batches = [];
        if (batchIds.length) {
            const batchResult = await client
                .from("batches")
                .select("id, batch_name")
                .in("id", batchIds);
            if (batchResult.error) throw batchResult.error;
            batches = batchResult.data || [];
        }
        const batchById = {};
        batches.forEach(function (batch) {
            batchById[String(batch.id)] = batch;
        });
        const report = rows.map(function (row) {
            const session = sessionById[String(row.session_id)] || {};
            const student = studentById[String(row.student_id)] || {};
            const batch = batchById[String(session.batch_id || student.batch_id)] || {};
            return {
                student_name: getAttendanceStudentName(student) || row.student_id,
                student_id: row.student_id,
                batch_id: session.batch_id || student.batch_id || "",
                batch: batch.batch_name || student.batch || "",
                course_id: session.course_id || "",
                course: student.course || "",
                date: String(session.start_time || session.created_at || row.response_time || "").slice(0, 10),
                status: normalizeAttendanceStatus(row.response),
                response: normalizeAttendanceStatus(row.response),
                time: row.response_time,
                remarks: ""
            };
        });
        response.json({
            success: true,
            rows: report,
            summary: buildAttendanceSummary(report),
            page: pageSettings.page,
            limit: pageSettings.limit,
            total: totalRows || report.length,
            total_pages: Math.max(1, Math.ceil(Number(totalRows || report.length) / pageSettings.limit)),
            has_more: pageSettings.to + 1 < Number(totalRows || 0)
        });
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not generate attendance report.", error);
    }
});

app.get("/api/attendance/report/:sessionId", async function (request, response) {
    try {
        const client = getSupabaseClient();
        const session = await getAttendanceSession(client, request.params.sessionId);
        if (!session) {
            response.status(404).json({ success: false, message: "Attendance session not found." });
            return;
        }
        response.json(await buildAttendanceLivePayload(client, session));
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load attendance report.", error);
    }
});

app.get("/api/attendance/dashboard", async function (request, response) {
    try {
        const client = getSupabaseClient();
        const today = new Date().toISOString().slice(0, 10);
        const sessionResult = await client
            .from("attendance_sessions")
            .select(ATTENDANCE_SESSION_COLUMNS)
            .gte("created_at", today + "T00:00:00")
            .lt("created_at", today + "T23:59:59.999");
        if (sessionResult.error) throw sessionResult.error;
        const sessions = sessionResult.data || [];
        const sessionIds = sessions.map(function (session) { return session.id; });
        let rows = [];
        if (sessionIds.length) {
            const attendanceResult = await client
                .from(DB.attendanceResponses.table)
                .select(ATTENDANCE_RESPONSE_COLUMNS)
                .in("session_id", sessionIds);
            if (attendanceResult.error) throw attendanceResult.error;
            rows = attendanceResult.data || [];
        }
        const payload = { success: true, summary: buildAttendanceSummary(rows) };
        if (String(request.query.include_sessions || "").trim() === "1") {
            payload.sessions = sessions;
        }
        response.json(payload);
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load attendance dashboard.", error);
    }
});

app.get("/api/student/attendance/active", async function (request, response) {
    try {
        const resolved = await resolveStudentForAttendance(request);
        const payload = await getStudentActiveAttendance(resolved.client, resolved.student, { includeDebug: shouldIncludeDebug(request) });
        response.json(Object.assign({ success: true }, payload));
    } catch (error) {
        sendApiError(response, error.statusCode || 500, error.message || "Could not check active attendance.", error);
    }
});

app.post("/api/student/attendance/respond", async function (request, response) {
    try {
        const resolved = await resolveStudentForAttendance(request);
        const sessionId = String(request.body.session_id || "").trim();
        const requestedStatus = normalizeAttendanceStatus(request.body.response || request.body.status);
        const autoTimeout = Boolean(request.body.auto_timeout);
        if (!sessionId || !requestedStatus || !["Present", "Absent"].includes(requestedStatus)) {
            response.status(400).json({ success: false, message: "session_id and Present/Absent response are required." });
            return;
        }

        const session = await getAttendanceSession(resolved.client, sessionId);
        if (!session) {
            response.status(404).json({ success: false, message: "Attendance session not found." });
            return;
        }

        const studentCourseId = String(resolved.student.course_id || "").trim();
        const studentBatchId = String(resolved.student.batch_id || "").trim();
        const sessionCourseId = String(session.course_id || "").trim();
        const sessionBatchId = String(session.batch_id || "").trim();
        console.log("Student attendance response attempt", {
            student_id: resolved.student.id,
            student_course_id: studentCourseId,
            student_batch_id: studentBatchId,
            session_id: sessionId,
            session_course_id: sessionCourseId,
            session_batch_id: sessionBatchId,
            response: requestedStatus,
            auto_timeout: autoTimeout
        });

        if (!studentCourseId || !studentBatchId || studentCourseId !== sessionCourseId || studentBatchId !== sessionBatchId) {
            response.status(403).json({ success: false, message: "You are not allowed to respond to this attendance session." });
            return;
        }

        const nowMs = Date.now();
        const startMs = new Date(session.start_time).getTime();
        const endMs = new Date(session.end_time).getTime();
        const isOpen = String(session.status || "").toUpperCase() === "OPEN";
        const withinTime = Number.isFinite(startMs) && Number.isFinite(endMs) && startMs <= nowMs && nowMs <= endMs;
        const timeoutAbsent = autoTimeout && requestedStatus === "Absent" && Number.isFinite(endMs) && nowMs >= endMs;
        if (!isOpen || (!withinTime && !timeoutAbsent)) {
            response.status(409).json({ success: false, message: "Attendance session is closed." });
            return;
        }

        const existing = await getStudentAttendance(resolved.client, sessionId, resolved.student.id);
        if (existing) {
            response.json({
                success: true,
                message: "Attendance Submitted",
                already_submitted: true,
                attendance: existing
            });
            return;
        }

        const row = await upsertAttendance(resolved.client, {
            session_id: sessionId,
            student_id: resolved.student.id,
            status: requestedStatus,
            marked_at: timeoutAbsent ? session.end_time : new Date().toISOString()
        });
        console.log("Student attendance response saved", {
            student_id: resolved.student.id,
            session_id: sessionId,
            response: requestedStatus,
            response_id: row && row.id
        });
        response.json({
            success: true,
            message: "Attendance Submitted Successfully",
            attendance: row
        });
    } catch (error) {
        sendApiError(response, error.statusCode || 500, error.message || "Could not submit attendance.", error);
    }
});

app.get("/api/student/attendance/history", async function (request, response) {
    try {
        const resolved = await resolveStudentForAttendance(request);
        const pageSettings = getPageSettings(request, { limit: 30, max: 120 });
        const attendanceResult = await resolved.client
            .from(DB.attendanceResponses.table)
            .select(ATTENDANCE_RESPONSE_COLUMNS, { count: "exact" })
            .eq("student_id", resolved.auth.studentId)
            .order("response_time", { ascending: false })
            .range(pageSettings.from, pageSettings.to);
        if (attendanceResult.error) throw attendanceResult.error;
        const rows = attendanceResult.data || [];
        const sessionIds = Array.from(new Set(rows.map(function (row) { return row.session_id; }).filter(Boolean)));
        let sessions = [];
        if (sessionIds.length) {
            const sessionResult = await resolved.client
                .from("attendance_sessions")
                .select(ATTENDANCE_SESSION_COLUMNS)
                .in("id", sessionIds);
            if (sessionResult.error) throw sessionResult.error;
            sessions = sessionResult.data || [];
        }
        const sessionById = {};
        sessions.forEach(function (session) {
            sessionById[String(session.id)] = session;
        });
        const records = rows.map(function (row) {
            return Object.assign({}, row, {
                status: normalizeAttendanceStatus(row.response),
                marked_at: row.response_time || row.created_at,
                session: sessionById[String(row.session_id)] || null
            });
        });
        response.json({
            success: true,
            summary: summarizeStudentAttendance(records),
            records: records,
            page: pageSettings.page,
            limit: pageSettings.limit,
            total: attendanceResult.count || records.length,
            has_more: pageSettings.to + 1 < Number(attendanceResult.count || 0)
        });
    } catch (error) {
        sendApiError(response, error.statusCode || 500, error.message || "Could not load student attendance history.", error);
    }
});

app.get("/api/admin/students", async function (request, response) {
    try {
        const client = getSupabaseClient();
        const pageSettings = getPageSettings(request, { limit: 25, max: 100 });
        let query = client
            .from("students")
            .select(STUDENT_ADMIN_COLUMNS, { count: "exact" });
        query = applyIlikeOr(query, ["id", "name", "father_name", "course", "batch"], request.query.search);
        if (request.query.course_id) query = query.eq("course_id", String(request.query.course_id));
        if (request.query.course) query = query.eq("course", String(request.query.course));
        if (request.query.batch_id) query = query.eq("batch_id", String(request.query.batch_id));
        if (request.query.status) query = query.eq("account_status", String(request.query.status));
        const result = await query
            .order("id", { ascending: false })
            .range(pageSettings.from, pageSettings.to);
        if (result.error) throw result.error;
        sendPaged(response, result.data || [], result.count, pageSettings);
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load students.", error);
    }
});

app.get("/api/admin/fees", async function (request, response) {
    try {
        const client = getSupabaseClient();
        const pageSettings = getPageSettings(request, { limit: 50, max: 200 });
        let query = client.from("student_fees").select(STUDENT_FEE_COLUMNS, { count: "exact" });
        if (request.query.student_id) query = query.eq("student_id", String(request.query.student_id));
        if (request.query.status) query = query.eq("status", String(request.query.status));
        query = applyIlikeOr(query, ["student_id", "status"], request.query.search);
        const result = await query.order("id", { ascending: false }).range(pageSettings.from, pageSettings.to);
        if (result.error) throw result.error;
        sendPaged(response, result.data || [], result.count, pageSettings);
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load fees.", error);
    }
});

app.get("/api/admin/emis", async function (request, response) {
    try {
        const client = getSupabaseClient();
        const pageSettings = getPageSettings(request, { limit: 25, max: 200 });
        let query = client.from("emis").select(EMI_COLUMNS, { count: "exact" });
        if (request.query.student_id) query = query.eq("student_id", String(request.query.student_id));
        if (request.query.status) query = query.eq("status", String(request.query.status));
        query = applyIlikeOr(query, ["student_id", "status"], request.query.search);
        const result = await query.order("due_date", { ascending: true }).range(pageSettings.from, pageSettings.to);
        if (result.error) throw result.error;
        sendPaged(response, result.data || [], result.count, pageSettings);
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load EMIs.", error);
    }
});

app.get("/api/admin/payments", async function (request, response) {
    try {
        const client = getSupabaseClient();
        const pageSettings = getPageSettings(request, { limit: 25, max: 200 });
        let query = client.from("payments").select(PAYMENT_COLUMNS, { count: "exact" });
        if (request.query.student_id) query = query.eq("student_id", String(request.query.student_id));
        query = applyIlikeOr(query, ["student_id", "payment_mode", "transaction_id", "remark"], request.query.search);
        const result = await query.order("payment_date", { ascending: false }).range(pageSettings.from, pageSettings.to);
        if (result.error) throw result.error;
        sendPaged(response, result.data || [], result.count, pageSettings);
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load payments.", error);
    }
});

app.get("/api/admin/announcements", async function (request, response) {
    try {
        const client = getSupabaseClient();
        const pageSettings = getPageSettings(request, { limit: 25, max: 100 });
        let query = client.from("announcements").select(ANNOUNCEMENT_COLUMNS, { count: "exact" });
        query = applyIlikeOr(query, ["title", "message", "content", "target_courses"], request.query.search);
        const result = await query.order("created_at", { ascending: false }).range(pageSettings.from, pageSettings.to);
        if (result.error) throw result.error;
        sendPaged(response, result.data || [], result.count, pageSettings);
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load announcements.", error);
    }
});

app.get("/api/admin/student-report", async function (request, response) {
    try {
        const client = getSupabaseClient();
        const pageSettings = getPageSettings(request, { limit: 25, max: 100 });
        let studentQuery = client.from("students").select(STUDENT_ADMIN_COLUMNS, { count: "exact" });
        if (request.query.course_id) studentQuery = studentQuery.eq("course_id", String(request.query.course_id));
        if (request.query.batch_id) studentQuery = studentQuery.eq("batch_id", String(request.query.batch_id));
        studentQuery = applyIlikeOr(studentQuery, ["id", "name", "course", "batch"], request.query.search);
        const studentResult = await studentQuery.order("id", { ascending: false }).range(pageSettings.from, pageSettings.to);
        if (studentResult.error) throw studentResult.error;
        const students = studentResult.data || [];
        const studentIds = students.map(function (student) { return student.id; }).filter(Boolean);
        const feeResult = studentIds.length
            ? await client.from("student_fees").select(STUDENT_FEE_COLUMNS).in("student_id", studentIds)
            : { data: [], error: null };
        if (feeResult.error) throw feeResult.error;
        const feeByStudent = {};
        (feeResult.data || []).forEach(function (fee) {
            feeByStudent[String(fee.student_id)] = fee;
        });
        const rows = students.map(function (student) {
            return { student: student, fees: feeByStudent[String(student.id)] || {} };
        });
        sendPaged(response, rows, studentResult.count, pageSettings);
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load student report.", error);
    }
});

app.post("/api/r2/delete", require("./api/r2/delete"));
app.get("/api/r2/sign", require("./api/r2/sign"));
app.get("/api/r2/test", require("./api/r2/test"));
app.get("/api/r2/credentials", require("./api/r2/credentials"));
app.get("/api/r2/list", require("./api/r2/list"));

app.use(express.static(__dirname, {
    etag: true,
    maxAge: "7d",
    setHeaders: function (response, filePath) {
        if (/\.(html)$/i.test(filePath)) {
            response.setHeader("Cache-Control", "no-cache");
            return;
        }
        if (/\.(js|css|png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/i.test(filePath)) {
            response.setHeader("Cache-Control", "public, max-age=604800, immutable");
        }
    }
}));

app.use(function (request, response) {
    response.status(404).json({
        success: false,
        message: "Route not found."
    });
});

async function start() {
    console.log("Verifying Cloudflare R2 credentials...");
    const r2 = await testConnection();
    console.log("Cloudflare R2 verified", {
        bucket: r2.bucket,
        endpoint: r2.endpoint,
        totalFiles: r2.totalFiles,
        responseTimeMs: r2.responseTimeMs
    });

    const supabase = getSupabaseConfig();
    console.log("Supabase configured", {
        url: supabase.url,
        keyLoaded: Boolean(supabase.key)
    });

    app.listen(PORT, function () {
        console.log("Server started");
        console.log("Local URL: http://localhost:" + PORT);
    });
}

start().catch(function (error) {
    console.error("Server startup failed");
    sendStartupError(error);
    process.exit(1);
});

function sendStartupError(error) {
    const details = serializeR2Error(error);
    console.error({
        name: details.name,
        message: details.message,
        code: details.code,
        status: details.status,
        stack: details.stack,
        metadata: details.metadata
    });
}

