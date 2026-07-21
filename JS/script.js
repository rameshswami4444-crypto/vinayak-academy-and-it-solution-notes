const courseData = [
    {
        id: 1,
        name: "ADFA",
        courseKey: "ADFA",
        icon: "fas fa-calculator"
    },
    {
        id: 2,
        name: "DCFA",
        courseKey: "DCFA",
        icon: "fas fa-file-invoice-dollar"
    },
    {
        id: 3,
        name: "Excel",
        courseKey: "EXCEL",
        icon: "fas fa-table"
    },
    {
        id: 4,
        name: "Rs-cit",
        courseKey: "RS-CIT",
        icon: "fas fa-briefcase"
    },
    {
        id: 5,
        name: "CCC",
        courseKey: "CCC",
        icon: "fas fa-chart-line"
    },
    {
        id: 6,
        name: "ECCE {IGNOU}",
        courseKey: "ECCE",
        icon: "fa-solid fa-book"
    }
];

(function () {
    if (window.__vinayakStudentDashboardLoaded) return;
    window.__vinayakStudentDashboardLoaded = true;

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value == null || value === "" ? "-" : String(value);
    }

    function money(value) {
        const number = Number(value || 0);
        return "Rs. " + (Number.isFinite(number) ? number : 0).toFixed(2);
    }

    function getCurrentCourseData(course) {
        return courseData.find(function (subject) {
            return window.VinayakAuth && window.VinayakAuth.normalizeSingleCourse(subject.courseKey) === course;
        }) || courseData[0];
    }

    function renderRecentMaterial(courseData, dbNotes) {
        const list = document.getElementById("recentMaterialList");
        if (!list) return;
        const items = (dbNotes || []).slice(0, 5);
        list.innerHTML = items.length ? items.map(function (item) {
            return '<button type="button" class="student-list-item student-list-button" data-dashboard-material-id="' + item.id + '"><i class="fas fa-file-pdf"></i><span><strong>' + (item.title || "Study Material") + '</strong><small>' + (item.subject || "PDF") + ' | ' + (item.created_at || "Recent") + '</small></span></button>';
        }).join("") : '<div class="student-empty">No recent material yet.</div>';
        list.querySelectorAll("[data-dashboard-material-id]").forEach(function (button) {
            button.addEventListener("click", function () {
                const note = items.find(function (item) { return String(item.id) === String(button.getAttribute("data-dashboard-material-id")); });
                if (window.VinayakNotesPage && note) {
                    window.VinayakNotesPage.openMaterial(note);
                }
            });
        });
    }

    function renderQuickAccess(courseData) {
        const grid = document.getElementById("studentQuickGrid");
        if (!grid || !courseData) return;
        const cards = [
            { icon: "fa-book-open", title: "Study Material", description: "Open your course PDFs.", href: "studymaterial.html" },
          
           { icon: "fa-wallet", title: "EMI & Payments", description: "See remaining amount and next due date.", href: "emi.html" },
           
        ];
        grid.innerHTML = cards.map(function (card) {
            return [
                '<article class="student-quick-card">',
                '<div class="student-quick-icon"><i class="fas ', card.icon, '"></i></div>',
                '<div class="student-quick-copy"><h3>', card.title, '</h3><p>', card.description, '</p></div>',
                '<a class="student-quick-link" href="', card.href, '">Continue</a>',
                '</article>'
            ].join("");
        }).join("");
    }

    function renderAnnouncements(items) {
        const list = document.getElementById("announcementList");
        if (!list) return;
        if (window.VinayakAnnouncements) {
            window.VinayakAnnouncements.renderPreview("announcementList", items || [], 5);
            const unread = window.VinayakAnnouncements.getUnreadCount(items || []);
            setText("notificationCount", unread);
            document.querySelectorAll("[data-layout-notification-count]").forEach(function (node) {
                node.textContent = String(unread);
                node.hidden = unread <= 0;
            });
            return;
        }
        list.innerHTML = items && items.length ? items.slice(0, 5).map(function (item) {
            return '<div class="student-list-item"><i class="fas fa-bullhorn"></i><span><strong>' + (item.title || item.heading || "Announcement") + '</strong><small>' + (item.message || item.description || item.created_at || "New notice") + '</small></span></div>';
        }).join("") : '<div class="student-empty">No announcements yet.</div>';
    }

    function renderEmi(fee, emis) {
        const panel = document.getElementById("student-payments-section");
        const card = document.getElementById("studentEmiCard");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const unpaid = (emis || []).filter(function (emi) {
            return String(emi.status || "pending").toLowerCase() !== "paid";
        }).sort(function (a, b) {
            return String(a.due_date || "").localeCompare(String(b.due_date || ""));
        });
        const overdue = unpaid.filter(function (emi) {
            if (!emi.due_date) return false;
            const dueDate = new Date(String(emi.due_date).slice(0, 10) + "T00:00:00");
            return !Number.isNaN(dueDate.getTime()) && dueDate < today;
        });
        const next = unpaid[0] || {};
        const remaining = fee && fee.remaining_fee != null ? fee.remaining_fee : unpaid.reduce(function (sum, emi) {
            return sum + Number(emi.amount || 0);
        }, 0);
        if (panel) {
            panel.hidden = !unpaid.length && Number(remaining || 0) <= 0;
        }
        if (card) {
            card.innerHTML = [
                '<strong>', money(remaining), '</strong>',
                '<span>Remaining Fee</span>',
                '<p><b>Next EMI</b> ', money(next.amount), '</p>',
                '<p><b>Due Date</b> ', (next.due_date || "-"), '</p>',
                '<p><b>Status</b> ', (next.status || "No pending EMI"), '</p>'
            ].join("");
        }
        return overdue.length > 0;
    }

    function renderHomeSummary(studentId, student, courseData) {
        const name = student.name || "Student";
        const course = courseData ? courseData.name : (student.course || "-");
        const memberSince = student.admission_date ? new Date(student.admission_date).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "-";
        document.querySelectorAll("[data-home-student-name]").forEach(function (node) { node.textContent = name; });
        document.querySelectorAll("[data-home-course]").forEach(function (node) { node.textContent = course; });
        document.querySelectorAll("[data-home-batch]").forEach(function (node) { node.textContent = student.batch || "-"; });
        document.querySelectorAll("[data-home-status]").forEach(function (node) { node.textContent = student.account_status || "active"; });
        document.querySelectorAll("[data-home-member-since]").forEach(function (node) { node.textContent = memberSince; });
        setText("studentIdText", studentId);
    }

    function renderAssignments(courseData) {
        const target = document.getElementById("studentAssignmentList");
        if (!target) return;
        target.innerHTML = [
            '<a class="student-assignment-row" href="assignments.html">',
            '<i class="fas fa-file-pen"></i><span><strong>Assignment Questions</strong><small>Open subject-wise assignment PDFs</small></span><em>Due date shown when uploaded</em>',
            '</a>',
            '<a class="student-assignment-row" href="assignments.html">',
            '<i class="fas fa-square-check"></i><span><strong>Solved Assignments</strong><small>Open solved or reference files</small></span><em>Upload coming later</em>',
            '</a>'
        ].join("");
    }

    function renderProfile(studentId, student, fee) {
        const target = document.getElementById("studentProfileSummary");
        if (!target) return;
        const rows = [
            ["Student ID", studentId],
            ["Name", student.name || "-"],
            ["Course", student.course || "-"],
            ["Batch", student.batch || "-"],
            ["Mobile", student.mobile || "-"],
            ["Email", student.email || "-"],
            ["Admission Date", student.admission_date || "-"],
            ["Course Duration", student.course_duration || "-"],
            ["Fee Status", (fee && fee.status) || student.fees_status || "-"]
        ];
        target.innerHTML = rows.map(function (row) {
            return '<div><small>' + row[0] + '</small><strong>' + row[1] + '</strong></div>';
        }).join("");
    }

    function bindProfileActions(studentId) {
        const copyButton = document.getElementById("copyStudentIdBtn");
        if (!copyButton || copyButton.dataset.bound) {
            return;
        }
        copyButton.dataset.bound = "true";
        copyButton.addEventListener("click", function () {
            const id = studentId || "";
            if (!id) {
                return;
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(id).catch(function () {});
            }
        });
    }

    async function safeFetch(table, queryBuilder) {
        try {
            const query = queryBuilder(window.VinayakAuth.getClient().from(table));
            const result = await query;
            if (result.error) throw result.error;
            return result.data || [];
        } catch (error) {
            console.warn("Student dashboard optional query failed", table, error);
            return [];
        }
    }

    async function loadDashboard(session) {
        const studentId = session.studentId || window.VinayakAuth.getStoredStudentId();
        const course = window.VinayakAuth.normalizeSingleCourse(session.course || window.VinayakAuth.getStoredCourse());
        const courseData = getCurrentCourseData(course);

        renderQuickAccess(courseData);

        const students = await safeFetch(window.VinayakAuth.getStudentsTableName(), function (table) {
            return table.select("*").eq(window.VinayakAuth.getStudentIdentifierColumn(), studentId).limit(1);
        });
        const student = students[0] || {};
        const fees = await safeFetch("student_fees", function (table) {
            return table.select("*").eq("student_id", studentId).limit(1);
        });
        const emis = await safeFetch("emis", function (table) {
            return table.select("*").eq("student_id", studentId).order("due_date", { ascending: true }).limit(24);
        });
        const notes = window.VinayakNotesPage && window.VinayakNotesPage.fetchCourseNotes
            ? (await window.VinayakNotesPage.fetchCourseNotes(course)).slice(0, 5)
            : [];
        const announcements = window.VinayakAnnouncements
            ? await window.VinayakAnnouncements.fetchVisibleAnnouncements(5)
            : await safeFetch("announcements", function (table) {
                return table.select("*").limit(5);
            });

        document.querySelectorAll("[data-layout-course]").forEach(function (node) {
            node.textContent = courseData ? courseData.name : course;
        });
        document.querySelectorAll("[data-layout-batch]").forEach(function (node) {
            node.textContent = student.batch || "-";
        });
        renderHomeSummary(studentId, student, courseData);
        const hasOverdueEmi = renderEmi(fees[0], emis);
        document.getElementById("studentBlockedBanner").hidden = !hasOverdueEmi;
        renderRecentMaterial(courseData, notes);
        renderAnnouncements(announcements);
        if (window.VinayakAnnouncements) {
            window.VinayakAnnouncements.updateBell();
        }
        renderAssignments(courseData);
        renderProfile(studentId, student, fees[0]);
        bindProfileActions(studentId);
    }

    window.VinayakStudentDashboard = { load: loadDashboard };
}());
