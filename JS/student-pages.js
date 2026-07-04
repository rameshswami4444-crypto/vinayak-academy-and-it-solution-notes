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
            return table.select("*").eq(window.VinayakAuth.getStudentIdentifierColumn(), studentId).limit(1);
        });
        return rows[0] || {};
    }

    function renderList(targetId, items, emptyMessage, renderItem) {
        const target = document.getElementById(targetId);
        if (!target) return;
        target.innerHTML = items.length ? items.map(renderItem).join("") : '<div class="student-empty">' + escapeHtml(emptyMessage) + '</div>';
    }

    async function loadNotices() {
        const notices = await safeFetch("announcements", function (table) {
            return table.select("*").order("created_at", { ascending: false });
        });
        renderList("noticesPageList", notices, "No announcements yet.", function (item) {
            return '<div class="student-list-item"><i class="fas fa-bullhorn"></i><span><strong>' + escapeHtml(item.title || item.heading || "Announcement") + '</strong><small>' + escapeHtml(item.message || item.description || item.created_at || "New notice") + '</small></span></div>';
        });
        document.querySelectorAll("[data-layout-notification-count]").forEach(function (node) {
            node.textContent = String(notices.length);
        });
    }

    async function loadProfile(session) {
        const studentId = getStudentId(session);
        const student = await getStudent(session);
        const fees = await safeFetch("student_fees", function (table) {
            return table.select("*").eq("student_id", studentId).limit(1);
        });
        const fee = fees[0] || {};
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
    }

    async function loadEmi(session) {
        const studentId = getStudentId(session);
        const fees = await safeFetch("student_fees", function (table) {
            return table.select("*").eq("student_id", studentId).limit(1);
        });
        const emis = await safeFetch("emis", function (table) {
            return table.select("*").eq("student_id", studentId).order("due_date", { ascending: true });
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
