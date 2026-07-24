(function () {
    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function money(value) {
        const number = Number(value || 0);
        return "Rs. " + (Number.isFinite(number) ? number : 0).toFixed(2);
    }

    function getStudentId(session) {
        return (session && session.studentId) || window.VinayakAuth.getStoredStudentId();
    }

    async function safeFetch(table, queryBuilder) {
        try {
            const result = await queryBuilder(window.VinayakAuth.getClient().from(table));
            if (result.error) throw result.error;
            return result.data || [];
        } catch (error) {
            console.warn("Student page query failed", table, error);
            return [];
        }
    }

    async function getStudent(session) {
        const studentId = getStudentId(session);
        const rows = await safeFetch(window.VinayakAuth.getStudentsTableName(), function (table) {
            return table.select("id, name, father_name, course, course_id, batch_id, batch, mobile, email, address, admission_date, course_duration, account_status, fees_status").eq(window.VinayakAuth.getStudentIdentifierColumn(), studentId).limit(1);
        });
        return rows[0] || {};
    }

    function apiUrl(path) {
        if (window.VinayakApi) return window.VinayakApi.url(path);
        const configured = String(window.API_BASE_URL || window.VINAYAK_API_BASE || "").replace(/\/+$/, "");
        return (configured || (window.location && window.location.origin) || "") + path;
    }

    function apiFetch(path, options) {
        return window.VinayakApi ? window.VinayakApi.fetch(path, options) : fetch(apiUrl(path), options);
    }

    function getStudentAuthHeaders() {
        return {
            "Accept": "application/json",
            "X-Student-Id": window.VinayakAuth.getStoredStudentId ? window.VinayakAuth.getStoredStudentId() : window.localStorage.getItem("studentId") || "",
            "X-Session-Token": window.VinayakAuth.getStoredStudentSessionId ? window.VinayakAuth.getStoredStudentSessionId() : window.localStorage.getItem("session_token") || ""
        };
    }

    async function fetchStudentProfilePayload() {
        const response = await apiFetch("/api/student/profile", {
            method: "GET",
            headers: getStudentAuthHeaders()
        });
        const payload = await response.json().catch(function () { return {}; });
        if (!response.ok || payload.success === false) {
            throw new Error(payload.message || payload.error || "Could not load student profile.");
        }
        return payload;
    }

    async function fetchStudentAttendanceHistory() {
        const studentId = window.VinayakAuth.getStoredStudentId();
        const token = window.VinayakAuth.getStoredStudentSessionId();
        const response = await apiFetch("/api/student/attendance/history", {
            headers: {
                "Accept": "application/json",
                "x-student-id": studentId,
                "x-session-token": token
            }
        });
        const payload = await response.json().catch(function () { return {}; });
        if (!response.ok || payload.success === false) {
            throw new Error(payload.message || "Could not load attendance history.");
        }
        return payload;
    }

    function attendanceClass(status) {
        const normalized = String(status || "").toLowerCase();
        if (normalized === "present") return "present";
        if (normalized === "absent") return "absent";
        if (normalized === "late") return "late";
        if (normalized === "leave") return "leave";
        return "waiting";
    }

    function attendanceLabel(status) {
        const normalized = String(status || "").trim().toLowerCase();
        if (!normalized) return "Not Marked";
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    function renderAttendanceProfile(payload) {
        const summary = payload.summary || {};
        const records = payload.records || [];
        const summaryBox = document.getElementById("profileAttendanceSummary");
        if (summaryBox) {
            summaryBox.innerHTML = [
                ["Attendance %", (summary.percentage || 0) + "%"],
                ["Present", summary.present || 0],
                ["Absent", summary.absent || 0],
                ["Late", summary.late || 0],
                ["Leave", summary.leave || 0],
                ["Total Records", summary.total || 0]
            ].map(function (row) {
                return '<div><small>' + escapeHtml(row[0]) + '</small><strong>' + escapeHtml(row[1]) + '</strong></div>';
            }).join("");
        }
        const calendar = document.getElementById("profileAttendanceCalendar");
        if (calendar) {
            calendar.innerHTML = records.length ? records.slice(0, 42).map(function (record) {
                const session = record.session || {};
                const date = String(session.created_at || record.marked_at || "").slice(0, 10) || "-";
                return '<span class="attendance-day ' + attendanceClass(record.status) + '" title="' + escapeHtml(date + " - " + attendanceLabel(record.status)) + '">' + escapeHtml(date.slice(8, 10) || "-") + '</span>';
            }).join("") : '<div class="student-empty">No attendance calendar records yet.</div>';
        }
        renderList("profileAttendanceTimeline", records, "No attendance history found.", function (record) {
            const session = record.session || {};
            return '<div class="student-list-item"><i class="fas fa-calendar-check"></i><span><strong>Attendance</strong><small>' + escapeHtml([session.batch_id, attendanceLabel(record.status), record.marked_at ? new Date(record.marked_at).toLocaleString() : ""].filter(Boolean).join(" | ")) + '</small></span></div>';
        });
    }

    function renderList(targetId, items, emptyMessage, renderItem) {
        const target = document.getElementById(targetId);
        if (!target) return;
        target.innerHTML = items.length ? items.map(renderItem).join("") : '<div class="student-empty">' + escapeHtml(emptyMessage) + '</div>';
    }

    async function loadNotices() {
        const notices = window.VinayakAnnouncements
            ? await window.VinayakAnnouncements.fetchVisibleAnnouncements()
            : await safeFetch("announcements", function (table) {
                return table.select("id, title, message, target_course, created_at, all_courses, content, expires_at, is_pinned, target_courses").limit(100);
            });
        if (window.VinayakAnnouncements) {
            window.VinayakAnnouncements.renderPage("noticesPageList", notices);
            window.VinayakAnnouncements.updateBell();
            return;
        }
        renderList("noticesPageList", notices, "No announcements yet.", function (item) {
            return '<div class="student-list-item"><i class="fas fa-bullhorn"></i><span><strong>' + escapeHtml(item.title || item.heading || "Announcement") + '</strong><small>' + escapeHtml(item.message || item.description || item.created_at || "New notice") + '</small></span></div>';
        });
    }

    async function loadProfile(session) {
        const studentId = getStudentId(session);
        let student = {};
        let fee = {};
        try {
            const profile = await fetchStudentProfilePayload();
            student = profile.student || {};
            fee = profile.fee || {};
        } catch (error) {
            console.warn("Student profile API failed; falling back to direct Supabase queries.", error);
            student = await getStudent(session);
            const fees = await safeFetch("student_fees", function (table) {
                return table.select("id, student_id, total_fee, admission_fee, remaining_fee, total_emis, status, paid_amount").eq("student_id", studentId).limit(1);
            });
            fee = fees[0] || {};
        }
        const rows = [
            ["Student ID", studentId],
            ["Name", student.name || "-"],
            ["Father Name", student.father_name || "-"],
            ["Course", student.course || "-"],
            ["Batch", student.batch || "-"],
            ["Mobile", student.mobile || "-"],
            ["Email", student.email || "-"],
            ["Address", student.address || "-"],
            ["Admission Date", student.admission_date || "-"],
            ["Course Duration", student.course_duration || "-"],
            ["Account Status", student.account_status || "-"],
            ["Fee Status", fee.status || student.fees_status || "-"]
        ];
        const target = document.getElementById("profilePageSummary");
        if (target) {
            target.innerHTML = rows.map(function (row) {
                return '<div><small>' + escapeHtml(row[0]) + '</small><strong>' + escapeHtml(row[1]) + '</strong></div>';
            }).join("");
        }
        try {
            renderAttendanceProfile(await fetchStudentAttendanceHistory());
        } catch (error) {
            console.warn("Profile attendance history failed", error);
            renderList("profileAttendanceTimeline", [], "Could not load attendance history right now.", function () { return ""; });
        }
    }

    async function loadEmi(session) {
        const studentId = getStudentId(session);
        const fees = await safeFetch("student_fees", function (table) {
            return table.select("id, student_id, total_fee, admission_fee, remaining_fee, total_emis, status, paid_amount").eq("student_id", studentId).limit(1);
        });
        const emis = await safeFetch("emis", function (table) {
            return table.select("id, student_id, emi_number, amount, due_date, paid_date, status").eq("student_id", studentId).order("due_date", { ascending: true }).limit(60);
        });
        const fee = fees[0] || {};
        const unpaid = emis.filter(function (emi) {
            return String(emi.status || "pending").toLowerCase() !== "paid";
        });
        const next = unpaid[0] || {};
        const summary = document.getElementById("emiPageSummary");
        if (summary) {
            summary.innerHTML = [
                '<strong>', money(fee.remaining_fee || unpaid.reduce(function (sum, emi) { return sum + Number(emi.amount || 0); }, 0)), '</strong>',
                '<span>Remaining Fee</span>',
                '<p><b>Next Due</b> ', escapeHtml(next.due_date || "-"), '</p>',
                '<p><b>Next Amount</b> ', money(next.amount || 0), '</p>',
                '<a class="student-quick-link" href="images/payment-qr.png">QR Payment</a>'
            ].join("");
        }
        renderList("emiHistoryList", emis, "No EMI records found.", function (emi) {
            return '<div class="student-list-item"><i class="fas fa-wallet"></i><span><strong>EMI ' + escapeHtml(emi.emi_number || "-") + ' - ' + money(emi.amount) + '</strong><small>Due: ' + escapeHtml(emi.due_date || "-") + ' | Status: ' + escapeHtml(emi.status || "pending") + '</small></span></div>';
        });
    }

    async function loadAssignments(session) {
        const student = await getStudent(session);
        const target = document.getElementById("assignmentPageList");
        if (target) {
            target.innerHTML = '<div class="student-skeleton"></div>';
        }
        try {
            const notes = window.VinayakNotesPage && window.VinayakNotesPage.fetchCourseNotes
                ? await window.VinayakNotesPage.fetchCourseNotes(student.course || window.VinayakAuth.getStoredCourse())
                : [];
            const assignmentNotes = notes.filter(function (note) {
                const text = [note.title, note.subject].join(" ").toLowerCase();
                return text.includes("assignment") || text.includes("solved");
            });
            if (!target) return;
            target.innerHTML = assignmentNotes.length ? assignmentNotes.map(function (note) {
                return '<button type="button" class="student-assignment-row" data-open-assignment-id="' + escapeHtml(note.id) + '"><i class="fas fa-file-pen"></i><span><strong>' + escapeHtml(note.title || "Assignment PDF") + '</strong><small>' + escapeHtml(note.subject || student.course || "Assignment") + '</small></span><em>Open PDF</em></button>';
            }).join("") : '<div class="student-empty">No assignment PDFs uploaded yet.</div>';
            target.querySelectorAll("[data-open-assignment-id]").forEach(function (button) {
                button.addEventListener("click", function () {
                    const note = assignmentNotes.find(function (item) {
                        return String(item.id) === String(button.getAttribute("data-open-assignment-id"));
                    });
                    if (window.VinayakNotesPage && note) {
                        window.VinayakNotesPage.openMaterial(note);
                    }
                });
            });
        } catch (error) {
            console.warn("Assignment PDFs load failed", error);
            if (target) {
                target.innerHTML = '<div class="student-empty">Could not load assignments right now.</div>';
            }
        }
    }

    function loadVideos() {
        const target = document.getElementById("videoLectureList");
        if (target) {
            target.innerHTML = '<div class="student-empty">No video lectures uploaded yet.</div>';
        }
    }

    window.VinayakStudentPages = {
        loadAssignments: loadAssignments,
        loadVideos: loadVideos,
        loadEmi: loadEmi,
        loadNotices: loadNotices,
        loadProfile: loadProfile
    };
}());
