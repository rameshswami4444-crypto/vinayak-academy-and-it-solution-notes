const notesData = [
    {
        id: 1,
        name: "ADFA",
        cardId: "adfa-card",
        courseKey: "ADFA",
        icon: "fas fa-calculator",
        description: "advanced deploma in finacial accounting ",
        topics: [
            {
                name: "basic accounting",
                link: "/HTML/basicnotes.html"
            },
            {
                name: "case studies",
                link: "/HTML/adfa.html"
            },
            {
                name: "NOTES",
                link: "/HTML/ADFANOTES.HTML"
            }
        ]
    },
    {
        id: 2,
        name: "DCFA",
        cardId: "dcfa-card",
        courseKey: "DCFA",
        icon: "fas fa-file-invoice-dollar",
        description: "deploma in computerized financial accounting",
        topics: [
            {
                name: "GST Basics and Overview",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_5/view?usp=sharing"
            },
            {
                name: "Registration and Compliance",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_6/view?usp=sharing"
            },
            {
                name: "GST Return Filing",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_7/view?usp=sharing"
            },
            {
                name: "Input Tax Credit",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_8/view?usp=sharing"
            }
        ]
    },
    {
        id: 3,
        name: "Excel",
        cardId: "excel-card",
        courseKey: "EXCEL",
        icon: "fas fa-table",
        description: "Microsoft Excel tutorials and tips",
        topics: [
            {
                name: "case study 1",
                link: "/adfa.html"
            }
        ]
    },
    {
        id: 4,
        name: "Rs-cit",
        cardId: "rscit-card",
        courseKey: "RS-CIT",
        icon: "fas fa-briefcase",
        description: "Rs-cit ",
        topics: [
            {
                name: "Introduction to Business",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_13/view?usp=sharing"
            },
            {
                name: "Business Organization",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_14/view?usp=sharing"
            },
            {
                name: "Marketing Strategies",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_15/view?usp=sharing"
            }
        ]
    },
    {
        id: 5,
        name: "CCC",
        cardId: "ccc-card",
        courseKey: "CCC",
        icon: "fas fa-chart-line",
        description: "CCC",
        topics: [
            {
                name: "Microeconomics",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_16/view?usp=sharing"
            },
            {
                name: "Macroeconomics",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_17/view?usp=sharing"
            },
            {
                name: "Supply and Demand",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_18/view?usp=sharing"
            }
        ]
    },
    {
        id: 6,
        name: "ECCE {IGNOU}",
        cardId: "ecce-card",
        courseKey: "ECCE",
        icon: "fa-solid fa-book",
        description: "Diploma in early childhood care and education",
        protected: true,
        topics: [
            {
                name: "open",
                link: "/HTML/DECE.HTML"
            }
        ]
    }
];

document.addEventListener("DOMContentLoaded", function () {
    window.VinayakNotesPage.initNotesPage({
        notesData: notesData,
        gridId: "subjectsGrid",
        modalId: "modal",
        modalTitleId: "modalTitle",
        topicsContainerId: "topicsContainer",
        comingSoonMessage: "we are cooking your syllabus"
    });
});

(function () {
    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value == null || value === "" ? "-" : String(value);
    }

    function money(value) {
        const number = Number(value || 0);
        return "Rs. " + (Number.isFinite(number) ? number : 0).toFixed(2);
    }

    function getCurrentCourseData(course) {
        return notesData.find(function (subject) {
            return window.VinayakAuth && window.VinayakAuth.normalizeSingleCourse(subject.courseKey) === course;
        }) || notesData[0];
    }

    function renderSubjects(courseData) {
        const grid = document.getElementById("subjectsGrid");
        if (!grid || !courseData) return;
        grid.innerHTML = [courseData].map(function (courseItem) {
            return [
                '<article class="subject-card student-page-card">',
                '<div class="subject-icon"><i class="', courseItem.icon || "fas fa-book-open", '"></i></div>',
                '<h2>Open Course</h2>',
                '<p>Continue into your subjects, notes, and PDF material without extra steps.</p>',
                '<span class="topic-count">', String((courseItem.topics || []).length), ' subjects</span>',
                '<button type="button" class="course-continue-btn" data-course-open>Continue</button>',
                '</article>'
            ].join("");
        }).join("");
        const button = grid.querySelector("[data-course-open]");
        if (button) {
            button.addEventListener("click", function () {
                if (courseData.protected && courseData.topics[0] && courseData.topics[0].link) {
                    window.location.href = courseData.topics[0].link;
                    return;
                }
                button.closest(".subject-card").click();
            });
        }
    }

    function renderRecentMaterial(courseData, dbNotes) {
        const list = document.getElementById("recentMaterialList");
        if (!list) return;
        const fallback = (courseData ? courseData.topics : []).map(function (topic) {
            return { title: topic.name, type: "PDF", upload_date: "Recent" };
        });
        const items = (dbNotes && dbNotes.length ? dbNotes : fallback).slice(0, 5);
        list.innerHTML = items.length ? items.map(function (item) {
            return '<div class="student-list-item"><i class="fas fa-file-pdf"></i><span><strong>' + (item.title || item.name || "Study Material") + '</strong><small>' + (item.type || "PDF") + ' | ' + (item.upload_date || item.created_at || "Recent") + '</small></span></div>';
        }).join("") : '<div class="student-empty">No recent material yet.</div>';
    }

    function renderQuickAccess(courseData) {
        const grid = document.getElementById("studentQuickGrid");
        if (!grid || !courseData) return;
        const protectedLink = courseData.protected && courseData.topics[0] ? courseData.topics[0].link : "";
        const secondLink = courseData.topics[1] ? courseData.topics[1].link : protectedLink;
        const cards = [
            { icon: "fa-book-open", title: "Study Material", description: "Open notes and subject-wise resources.", href: "#study-material-section" },
            { icon: "fa-clipboard-list", title: "Assignments", description: "Go straight to assignment material.", href: protectedLink || "#subjectsGrid" },
            { icon: "fa-square-check", title: "Solved Assignments", description: "Continue from solved or reviewed files.", href: secondLink || protectedLink || "#subjectsGrid" },
            { icon: "fa-circle-play", title: "Video Lectures", description: "Lecture area reserved for upcoming uploads.", href: "#subjectsGrid" },
            { icon: "fa-wallet", title: "EMI & Payments", description: "See remaining amount and next due date.", href: "#student-payments-section" },
            { icon: "fa-user", title: "Profile", description: "Open student ID and account tools.", href: "#profile" }
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
        list.innerHTML = items && items.length ? items.slice(0, 5).map(function (item) {
            return '<div class="student-list-item"><i class="fas fa-bullhorn"></i><span><strong>' + (item.title || item.heading || "Announcement") + '</strong><small>' + (item.message || item.description || item.created_at || "New notice") + '</small></span></div>';
        }).join("") : '<div class="student-empty">No announcements yet.</div>';
        setText("notificationCount", items ? items.length : 0);
        document.querySelectorAll("[data-layout-notification-count]").forEach(function (node) {
            node.textContent = String(items ? items.length : 0);
        });
    }

    function renderEmi(fee, emis) {
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

        setText("studentIdText", studentId);
        renderSubjects(courseData);
        renderQuickAccess(courseData);

        const students = await safeFetch(window.VinayakAuth.getStudentsTableName(), function (table) {
            return table.select("*").eq(window.VinayakAuth.getStudentIdentifierColumn(), studentId).limit(1);
        });
        const student = students[0] || {};
        const fees = await safeFetch("student_fees", function (table) {
            return table.select("*").eq("student_id", studentId).limit(1);
        });
        const emis = await safeFetch("emis", function (table) {
            return table.select("*").eq("student_id", studentId);
        });
        const notes = await safeFetch("notes", function (table) {
            return table.select("*").limit(5);
        });
        const announcements = await safeFetch("announcements", function (table) {
            return table.select("*").limit(5);
        });

        document.querySelectorAll("[data-layout-course]").forEach(function (node) {
            node.textContent = courseData ? courseData.name : course;
        });
        document.querySelectorAll("[data-layout-batch]").forEach(function (node) {
            node.textContent = student.batch || "-";
        });
        const hasOverdueEmi = renderEmi(fees[0], emis);
        document.getElementById("studentBlockedBanner").hidden = !hasOverdueEmi;
        renderRecentMaterial(courseData, notes);
        renderAnnouncements(announcements);
        bindProfileActions(studentId);
    }

    window.VinayakStudentDashboard = { load: loadDashboard };
}());
