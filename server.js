"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
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
const ATTENDANCE_SESSION_COLUMNS = "id, course_id, subject, lecture_title, duration_minutes, start_time, end_time, status, created_by, created_at";
const ATTENDANCE_RESPONSE_COLUMNS = "session_id, student_id, response, response_time, created_at";
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PDF_SIZE }
});

function readFrontendSupabaseConfig() {
    const configPath = path.join(__dirname, "JS", "supabase-config.js");
    if (!fs.existsSync(configPath)) return {};
    const source = fs.readFileSync(configPath, "utf8");
    const urlMatch = source.match(/url:\s*["']([^"']+)["']/);
    const keyMatch = source.match(/publishableKey:\s*["']([^"']+)["']/);
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

async function filterExistingR2Materials(notes) {
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
    const filtered = [];
    const concurrency = 8;
    let cursor = 0;
    async function worker() {
        while (cursor < candidates.length) {
            const item = candidates[cursor];
            cursor += 1;
            try {
                if (await fileExists(item.r2_key)) {
                    filtered.push(item);
                } else {
                    console.warn("Ignoring study material row because R2 object is missing", {
                        noteId: item.id,
                        r2_key: item.r2_key
                    });
                }
            } catch (error) {
                console.warn("Ignoring study material row because R2 verification failed", {
                    noteId: item.id,
                    r2_key: item.r2_key,
                    error: serializeR2Error(error)
                });
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, worker));
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
        .select("*")
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
    const exists = await fileExists(note.r2_key || note.file_path);
    if (!exists) {
        const error = new Error("This PDF file is missing from Cloudflare R2. Please contact admin.");
        error.statusCode = 404;
        error.context = { materialId: materialId, objectKey: note.r2_key || note.file_path };
        throw error;
    }

    return {
        auth: auth,
        note: note
    };
}

function normalizeAttendanceStatus(value) {
    const status = String(value || "WAITING").trim().toUpperCase().replace(/\s+/g, "_");
    return ["PRESENT", "ABSENT", "WAITING", "AUTO_ABSENT"].includes(status) ? status : "WAITING";
}

function getAttendanceStudentName(student) {
    return String((student && (student.name || student.student_name || student.full_name)) || "").trim();
}

function buildAttendanceSummary(rows) {
    const summary = {
        total_students: rows.length,
        present: 0,
        absent: 0,
        auto_absent: 0,
        waiting: 0
    };
    rows.forEach(function (row) {
        const status = normalizeAttendanceStatus(row.response);
        if (status === "PRESENT") summary.present += 1;
        if (status === "ABSENT") summary.absent += 1;
        if (status === "AUTO_ABSENT") {
            summary.auto_absent += 1;
            summary.absent += 1;
        }
        if (status === "WAITING") summary.waiting += 1;
    });
    summary.live_responses = summary.present + summary.absent;
    summary.attendance_percentage = summary.total_students ? Math.round((summary.present / summary.total_students) * 100) : 0;
    return summary;
}

function getRemainingSeconds(session) {
    if (!session || !session.end_time || session.status !== "OPEN") return 0;
    return Math.max(0, Math.ceil((new Date(session.end_time).getTime() - Date.now()) / 1000));
}

async function getAttendanceRows(client, session) {
    const sessionId = String(session && session.id || "");
    const courseId = String(session && session.course_id || "");
    if (!sessionId || !courseId) return [];

    const students = await client
        .from("students")
        .select("id, name, course_id")
        .eq("course_id", courseId)
        .order("name", { ascending: true });
    if (students.error) throw students.error;

    const result = await client
        .from("attendance_responses")
        .select("session_id, student_id, response, response_time, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
    if (result.error) throw result.error;

    const responseByStudentId = {};
    (result.data || []).forEach(function (row) {
        responseByStudentId[String(row.student_id)] = row;
    });

    return (students.data || []).map(function (student) {
        const responseRow = responseByStudentId[String(student.id)] || {};
        return {
            session_id: sessionId,
            student_id: String(student.id || ""),
            student_name: getAttendanceStudentName(student) || String(student.id || ""),
            response: responseRow.response || null,
            response_time: responseRow.response_time || null,
            created_at: responseRow.created_at || null
        };
    });
}

async function verifyAttendanceSessionInserted(client, sessionId) {
    const verifyResult = await client
        .from("attendance_sessions")
        .select("id, course_id, status, start_time, end_time")
        .eq("id", sessionId)
        .limit(1);
    if (verifyResult.error) throw verifyResult.error;
    console.log("Attendance session insert verification", {
        table: "attendance_sessions",
        sessionId: sessionId,
        recordsFound: verifyResult.data ? verifyResult.data.length : 0,
        row: verifyResult.data && verifyResult.data[0] ? verifyResult.data[0] : null
    });
    return verifyResult.data && verifyResult.data[0] ? verifyResult.data[0] : null;
}

async function getStudentByIdForAttendance(client, studentId) {
    const studentResult = await client
        .from("students")
        .select("*")
        .eq("id", studentId)
        .limit(1);
    if (studentResult.error) {
        console.error("Student attendance student lookup Supabase error", {
            table: "students",
            studentId: studentId,
            error: studentResult.error
        });
        throw studentResult.error;
    }
    return studentResult.data && studentResult.data[0] ? studentResult.data[0] : null;
}

async function ensureStudentCourseIdForAttendance(client, student) {
    const existingCourseId = String(student && student.course_id || "").trim();
    if (existingCourseId) {
        const existingCourseResult = await client
            .from("courses")
            .select("id")
            .eq("id", existingCourseId)
            .limit(1);
        if (existingCourseResult.error) {
            console.error("Attendance student course_id validation failed", {
                table: "courses",
                studentId: student && student.id,
                courseId: existingCourseId,
                error: existingCourseResult.error
            });
            throw existingCourseResult.error;
        }
        if (existingCourseResult.data && existingCourseResult.data.length) {
            return student;
        }
        console.warn("Attendance student course_id is stale and will be repaired", {
            studentId: student && student.id,
            staleCourseId: existingCourseId,
            courseName: student && (student.course || student.course_name)
        });
    }

    const courseName = String(student && (student.course || student.course_name) || "").trim();
    console.log("Attendance student course_id missing", {
        studentId: student && student.id,
        courseName: courseName
    });
    if (!courseName) {
        return student;
    }

    const courseResult = await client
        .from("courses")
        .select("id, course_name")
        .eq("course_name", courseName)
        .limit(1);
    if (courseResult.error) {
        console.error("Attendance course_id repair Supabase error", {
            table: "courses",
            studentId: student && student.id,
            courseName: courseName,
            error: courseResult.error
        });
        throw courseResult.error;
    }

    const course = courseResult.data && courseResult.data[0];
    if (!course || !course.id) {
        console.warn("Attendance course_id repair found no matching course", {
            studentId: student && student.id,
            courseName: courseName
        });
        return student;
    }

    const updateResult = await client
        .from("students")
        .update({ course_id: course.id })
        .eq("id", student.id)
        .select("id, course_id, subject, lecture_title, duration_minutes, start_time, end_time, status, created_by, created_at")
        .single();
    if (updateResult.error) {
        console.error("Attendance student course_id repair update failed", {
            table: "students",
            studentId: student && student.id,
            courseId: course.id,
            error: updateResult.error
        });
        throw updateResult.error;
    }

    console.log("Attendance student course_id repaired", {
        studentId: student && student.id,
        courseId: course.id,
        courseName: courseName
    });
    return updateResult.data || Object.assign({}, student, { course_id: course.id });
}

async function repairCourseStudentsForAttendance(client, courseId, courseName) {
    const name = String(courseName || "").trim();
    if (!courseId || !name) return;
    const lookup = await client
        .from("students")
        .select("id, course_id")
        .eq("course", name)
        .limit(1000);
    if (lookup.error) {
        console.error("Attendance course students repair failed", {
            table: "students",
            courseId: courseId,
            courseName: name,
            error: lookup.error
        });
        throw lookup.error;
    }
    const needsRepair = (lookup.data || []).filter(function (student) {
        return String(student.course_id || "").trim() !== String(courseId);
    });
    for (const student of needsRepair) {
        const update = await client
            .from("students")
            .update({ course_id: courseId })
            .eq("id", student.id);
        if (update.error) throw update.error;
    }
    console.log("Attendance course students repair", {
        table: "students",
        courseId: courseId,
        courseName: name,
        matchedStudents: lookup.data ? lookup.data.length : 0,
        repairedStudents: needsRepair.length
    });
}

async function getAttendanceSession(client, sessionId) {
    const result = await client
        .from("attendance_sessions")
        .select("id, course_id, subject, lecture_title, duration_minutes, start_time, end_time, status, created_by, created_at")
        .eq("id", sessionId)
        .limit(1);
    if (result.error) throw result.error;
    return result.data && result.data[0] ? result.data[0] : null;
}

async function closeAttendanceSession(client, sessionId) {
    const nowIso = new Date().toISOString();
    const sessionUpdate = await client
        .from("attendance_sessions")
        .update({ status: "CLOSED", end_time: nowIso })
        .eq("id", sessionId)
        .select(ATTENDANCE_SESSION_COLUMNS)
        .single();
    if (sessionUpdate.error) throw sessionUpdate.error;
    return sessionUpdate.data;
}

async function closeAttendanceIfExpired(client, session) {
    if (!session || session.status !== "OPEN") return session;
    if (new Date(session.end_time).getTime() > Date.now()) return session;
    return closeAttendanceSession(client, session.id);
}

async function buildAttendanceLivePayload(client, session) {
    const rows = await getAttendanceRows(client, session);
    return {
        success: true,
        session: session,
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

async function getStudentActiveAttendance(client, student) {
    const courseIds = await getStudentAttendanceCourseIds(client, student);
    if (!courseIds.length) {
        return { session: null, debug: { courseId: "", query: null, sessionsFound: 0 } };
    }
    const nowIso = new Date().toISOString();
    const courseId = courseIds[0];
    const debug = {
        table: "attendance_sessions",
        status: "OPEN",
        course_id: courseId,
        start_time_lte: nowIso,
        end_time_gte: nowIso
    };
    console.log("Student attendance active query", debug);
    const sessionResult = await client
        .from("attendance_sessions")
        .select(ATTENDANCE_SESSION_COLUMNS)
        .eq("status", "OPEN")
        .eq("course_id", courseId)
        .lte("start_time", nowIso)
        .gte("end_time", nowIso)
        .order("start_time", { ascending: false })
        .limit(1);
    if (sessionResult.error) {
        console.error("Student attendance active Supabase error", {
            query: debug,
            error: sessionResult.error
        });
        throw sessionResult.error;
    }
    console.log("Student attendance active sessions found", {
        studentId: student && student.id,
        courseId: courseId,
        sessionsFound: sessionResult.data ? sessionResult.data.length : 0
    });

    for (const candidate of sessionResult.data || []) {
        const session = await closeAttendanceIfExpired(client, candidate);
        if (session && session.status === "OPEN") {
            return {
                session: session,
                debug: Object.assign({}, debug, {
                    sessionsFound: sessionResult.data ? sessionResult.data.length : 0
                })
            };
        }
    }
    return {
        session: null,
        debug: Object.assign({}, debug, {
            sessionsFound: sessionResult.data ? sessionResult.data.length : 0
        })
    };
}

async function getStudentAttendanceResponse(client, sessionId, studentId) {
    const result = await client
        .from("attendance_responses")
        .select(ATTENDANCE_RESPONSE_COLUMNS)
        .eq("session_id", sessionId)
        .eq("student_id", studentId)
        .limit(1);
    if (result.error) throw result.error;
    return result.data && result.data[0] ? result.data[0] : null;
}

function summarizeStudentAttendance(rows) {
    const summary = {
        total: rows.length,
        present: 0,
        absent: 0,
        auto_absent: 0,
        percentage: 0
    };
    rows.forEach(function (row) {
        const status = normalizeAttendanceStatus(row.response);
        if (status === "PRESENT") summary.present += 1;
        if (status === "ABSENT") summary.absent += 1;
        if (status === "AUTO_ABSENT") {
            summary.auto_absent += 1;
            summary.absent += 1;
        }
    });
    summary.percentage = summary.total ? Math.round((summary.present / summary.total) * 100) : 0;
    return summary;
}

const app = express();
app.use(cors());
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
            .select("*")
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
        const materials = await filterExistingR2Materials(linkedNotes.concat(legacyNotes));

        console.log("Material list returned", {
            studentId: auth.studentId,
            total: materials.length
        });

        response.json({
            success: true,
            materials: materials
        });
    } catch (error) {
        console.error("Material list fetch error", serializeR2Error(error));
        sendError(response, error, 500);
    }
});

app.get("/api/admin/materials", async function (request, response) {
    try {
        const client = getSupabaseClient();
        const notes = await selectNotes(client, function (query) {
            return query.order("created_at", { ascending: false });
        });
        const materials = await filterExistingR2Materials(notes);
        const noteIds = materials.map(function (note) { return note.id; }).filter(Boolean);
        const links = noteIds.length
            ? await client.from("material_courses").select("*").in("note_id", noteIds)
            : { data: [], error: null };
        if (links.error) throw links.error;
        response.json({
            success: true,
            materials: materials,
            material_courses: links.data || []
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
        console.log("PDF retrieval step: generated signed URL", {
            materialId: materialId,
            objectKey: objectKey,
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
            url: signedUrl,
            signedUrl: signedUrl,
            fallbackUrl: "/api/material/" + encodeURIComponent(materialId) + "/content",
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

app.get("/api/material/:id/content", async function (request, response) {
    const materialId = String(request.params.id || "").trim();
    try {
        const authorized = await resolveAuthorizedMaterial(request, materialId);
        const note = authorized.note;
        const objectKey = note.r2_key || note.file_path;
        console.log("PDF content stream requested", {
            studentId: authorized.auth.studentId,
            materialId: materialId,
            objectKey: objectKey
        });
        const object = await getPDFObject(objectKey);
        response.setHeader("Content-Type", object.contentType || "application/pdf");
        response.setHeader("Content-Disposition", "inline; filename=\"material-" + materialId + ".pdf\"");
        response.setHeader("Cache-Control", "private, no-store, max-age=0");
        if (object.contentLength) {
            response.setHeader("Content-Length", String(object.contentLength));
        }
        object.body.pipe(response);
    } catch (error) {
        console.error("PDF content stream error", {
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

app.post("/api/attendance/start", async function (request, response) {
    try {
        const courseId = String(request.body.course_id || "").trim();
        const courseName = String(request.body.course_name || "").trim();
        const subject = String(request.body.subject || "").trim();
        const lectureTitle = String(request.body.lecture_title || "").trim();
        const durationMinutes = Math.max(1, Math.floor(Number(request.body.duration_minutes || 5)));
        const createdBy = String(request.body.created_by || "admin").trim();

        if (!courseId || !subject || !lectureTitle) {
            response.status(400).json({ success: false, message: "course_id, subject, and lecture_title are required." });
            return;
        }

        const client = getSupabaseClient();
        await repairCourseStudentsForAttendance(client, courseId, courseName);
        const studentResult = await client
            .from("students")
            .select("id, name, course_id")
            .eq("course_id", courseId);
        if (studentResult.error) throw studentResult.error;

        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
        const sessionId = crypto.randomUUID();
        const sessionPayload = {
            id: sessionId,
            course_id: courseId,
            subject: subject,
            lecture_title: lectureTitle,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            duration_minutes: durationMinutes,
            status: "OPEN",
            created_by: createdBy
        };

        const sessionInsert = await client
            .from("attendance_sessions")
            .insert([sessionPayload])
            .select("id, course_id, subject, lecture_title, duration_minutes, start_time, end_time, status, created_by, created_at")
            .single();
        if (sessionInsert.error) throw sessionInsert.error;
        await verifyAttendanceSessionInserted(client, sessionId);

        const students = studentResult.data || [];
        console.log("Attendance start course student lookup", {
            table: "students",
            courseId: courseId,
            studentsFound: students.length
        });

        const payload = await buildAttendanceLivePayload(client, sessionInsert.data);
        response.json(payload);
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
        const currentSession = await closeAttendanceIfExpired(client, session);
        response.json(await buildAttendanceLivePayload(client, currentSession));
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load live attendance.", error);
    }
});

app.post("/api/attendance/close", async function (request, response) {
    try {
        const sessionId = String(request.body.session_id || request.body.sessionId || "").trim();
        if (!sessionId) {
            response.status(400).json({ success: false, message: "session_id is required." });
            return;
        }
        const client = getSupabaseClient();
        const session = await getAttendanceSession(client, sessionId);
        if (!session) {
            response.status(404).json({ success: false, message: "Attendance session not found." });
            return;
        }
        const currentSession = session.status === "OPEN" ? await closeAttendanceSession(client, sessionId) : session;
        response.json(await buildAttendanceLivePayload(client, currentSession));
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not close attendance.", error);
    }
});

app.get("/api/attendance/history", async function (request, response) {
    try {
        const client = getSupabaseClient();
        let query = client
            .from("attendance_sessions")
            .select(ATTENDANCE_SESSION_COLUMNS)
            .order("start_time", { ascending: false });
        if (request.query.course_id) query = query.eq("course_id", String(request.query.course_id));
        if (request.query.date) {
            const date = String(request.query.date);
            query = query.gte("start_time", date + "T00:00:00").lt("start_time", date + "T23:59:59.999");
        }
        const result = await query;
        if (result.error) throw result.error;
        response.json({ success: true, sessions: result.data || [] });
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load attendance history.", error);
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
        const currentSession = await closeAttendanceIfExpired(client, session);
        const rows = await getAttendanceRows(client, currentSession);
        response.json({
            success: true,
            session: currentSession,
            summary: buildAttendanceSummary(rows),
            students: rows
        });
    } catch (error) {
        sendApiError(response, 500, error.message || "Could not load attendance report.", error);
    }
});

app.get("/api/student/attendance/active", async function (request, response) {
    try {
        const resolved = await resolveStudentForAttendance(request);
        console.log("Student attendance active request", {
            studentId: resolved.auth.studentId,
            studentCourseId: resolved.student && resolved.student.course_id
        });
        const active = await getStudentActiveAttendance(resolved.client, resolved.student);
        const session = active.session;
        if (!session) {
            response.json({
                success: true,
                active: false,
                debug: {
                    student_id: resolved.auth.studentId,
                    student_course_id: resolved.student && resolved.student.course_id || "",
                    attendance_query: active.debug,
                    sessions_found: active.debug && active.debug.sessionsFound || 0
                }
            });
            return;
        }
        const row = await getStudentAttendanceResponse(resolved.client, session.id, resolved.auth.studentId);
        response.json({
            success: true,
            active: true,
            session: session,
            response: row ? {
                student_id: row.student_id,
                session_id: row.session_id,
                response: row.response,
                response_time: row.response_time
            } : null,
            can_respond: !row,
            already_submitted: Boolean(row),
            remaining_seconds: getRemainingSeconds(session),
            debug: {
                student_id: resolved.auth.studentId,
                student_course_id: resolved.student && resolved.student.course_id || "",
                attendance_query: active.debug,
                sessions_found: active.debug && active.debug.sessionsFound || 0,
                response_found: Boolean(row)
            }
        });
    } catch (error) {
        sendApiError(response, error.statusCode || 500, error.message || "Could not load active attendance.", error);
    }
});

app.post("/api/student/attendance/respond", async function (request, response) {
    try {
        const resolved = await resolveStudentForAttendance(request);
        const sessionId = String(request.body.session_id || request.body.sessionId || "").trim();
        const requestedResponse = normalizeAttendanceStatus(request.body.response);
        if (!sessionId) {
            response.status(400).json({ success: false, message: "session_id is required." });
            return;
        }
        if (!["PRESENT", "ABSENT"].includes(requestedResponse)) {
            response.status(400).json({ success: false, message: "Response must be PRESENT or ABSENT." });
            return;
        }

        const session = await getAttendanceSession(resolved.client, sessionId);
        if (!session) {
            response.status(404).json({ success: false, message: "Attendance session not found." });
            return;
        }
        const currentSession = await closeAttendanceIfExpired(resolved.client, session);
        if (currentSession.status !== "OPEN") {
            response.status(409).json({ success: false, message: "Attendance is closed." });
            return;
        }

        const courseIds = await getStudentAttendanceCourseIds(resolved.client, resolved.student);
        if (!courseIds.includes(String(currentSession.course_id))) {
            response.status(403).json({ success: false, message: "You are not allowed to respond to this attendance session." });
            return;
        }

        const row = await getStudentAttendanceResponse(resolved.client, sessionId, resolved.auth.studentId);
        if (row) {
            response.json({ success: true, message: "Attendance Submitted", already_submitted: true, response: row });
            return;
        }

        const responseTime = new Date().toISOString();
        const insertResult = await resolved.client
            .from("attendance_responses")
            .insert([{
                session_id: sessionId,
                student_id: resolved.auth.studentId,
                response: requestedResponse,
                response_time: responseTime
            }])
            .select("session_id, student_id, response, response_time, created_at")
            .single();
        if (insertResult.error) {
            if (insertResult.error.code === "23505") {
                const existing = await getStudentAttendanceResponse(resolved.client, sessionId, resolved.auth.studentId);
                response.json({ success: true, message: "Attendance Submitted", already_submitted: true, response: existing });
                return;
            }
            console.error("Student attendance response insert Supabase error", {
                table: "attendance_responses",
                studentId: resolved.auth.studentId,
                sessionId: sessionId,
                error: insertResult.error
            });
            throw insertResult.error;
        }

        response.json({
            success: true,
            message: "Attendance Submitted Successfully",
            response: insertResult.data
        });
    } catch (error) {
        sendApiError(response, error.statusCode || 500, error.message || "Could not submit attendance.", error);
    }
});

app.get("/api/student/attendance/history", async function (request, response) {
    try {
        const resolved = await resolveStudentForAttendance(request);
        const responseResult = await resolved.client
            .from("attendance_responses")
            .select(ATTENDANCE_RESPONSE_COLUMNS)
            .eq("student_id", resolved.auth.studentId)
            .order("created_at", { ascending: false });
        if (responseResult.error) throw responseResult.error;
        const rows = responseResult.data || [];
        const sessionIds = Array.from(new Set(rows.map(function (row) { return row.session_id; }).filter(Boolean)));
        let sessions = [];
        if (sessionIds.length) {
            const sessionResult = await resolved.client
                .from("attendance_sessions")
                .select("id, course_id, subject, lecture_title, duration_minutes, start_time, end_time, status, created_by, created_at")
                .in("id", sessionIds);
            if (sessionResult.error) throw sessionResult.error;
            sessions = sessionResult.data || [];
        }
        const sessionById = {};
        sessions.forEach(function (session) {
            sessionById[String(session.id)] = session;
        });
        const records = rows.map(function (row) {
            return Object.assign({}, row, { session: sessionById[String(row.session_id)] || null });
        }).sort(function (a, b) {
            const aTime = a.session && a.session.start_time || a.created_at || "";
            const bTime = b.session && b.session.start_time || b.created_at || "";
            return String(bTime).localeCompare(String(aTime));
        });
        response.json({
            success: true,
            summary: summarizeStudentAttendance(records),
            records: records
        });
    } catch (error) {
        sendApiError(response, error.statusCode || 500, error.message || "Could not load student attendance history.", error);
    }
});

app.post("/api/r2/upload", require("./api/r2/upload"));
app.post("/api/r2/delete", require("./api/r2/delete"));
app.get("/api/r2/sign", require("./api/r2/sign"));
app.get("/api/r2/test", require("./api/r2/test"));
app.get("/api/r2/credentials", require("./api/r2/credentials"));
app.get("/api/r2/list", require("./api/r2/list"));
app.post("/api/r2/upload-test", require("./api/r2/upload-test"));

app.use(express.static(__dirname));

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
