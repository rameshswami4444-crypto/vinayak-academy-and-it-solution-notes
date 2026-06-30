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
        const grid = document.getElementById("studentSubjectsGrid");
        if (!grid || !courseData) return;
        grid.innerHTML = courseData.topics.map(function (topic, index) {
            return [
                '<article class="student-subject-card"><i class="fas fa-file-lines"></i><div><h3>',
                topic.name,
                '</h3><p><span>1 Notes</span><span>',
                index % 2,
                ' Assignments</span><span>0 Projects</span></p></div></article>'
            ].join("");
        }).join("");
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

    function renderAnnouncements(items) {
        const list = document.getElementById("announcementList");
        if (!list) return;
        list.innerHTML = items && items.length ? items.slice(0, 5).map(function (item) {
            return '<div class="student-list-item"><i class="fas fa-bullhorn"></i><span><strong>' + (item.title || item.heading || "Announcement") + '</strong><small>' + (item.message || item.description || item.created_at || "New notice") + '</small></span></div>';
        }).join("") : '<div class="student-empty">No announcements yet.</div>';
        setText("notificationCount", items ? items.length : 0);
    }

    function renderEmi(fee, emis) {
        const card = document.getElementById("studentEmiCard");
        const unpaid = (emis || []).filter(function (emi) {
            return String(emi.status || "pending").toLowerCase() !== "paid";
        }).sort(function (a, b) {
            return String(a.due_date || "").localeCompare(String(b.due_date || ""));
        });
        const next = unpaid[0] || {};
        const remaining = fee && fee.remaining_fee != null ? fee.remaining_fee : unpaid.reduce(function (sum, emi) {
            return sum + Number(emi.amount || 0);
        }, 0);
        setText("statRemainingEmi", money(remaining));
        setText("statNextEmiDate", next.due_date || "-");
        if (card) {
            card.innerHTML = '<strong>' + money(remaining) + '</strong><span>Remaining Fee</span><p>Next EMI: ' + money(next.amount) + ' | Due: ' + (next.due_date || "-") + '</p><p>Status: ' + (next.status || "No pending EMI") + '</p>';
        }
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
        setText("studentIdInlineText", studentId);
        setText("studentCourseText", course);
        setText("statCourseName", courseData ? courseData.name : course);
        setText("statSubjectCount", courseData ? courseData.topics.length : 0);
        renderSubjects(courseData);

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

        const accountStatus = student.account_status || session.accountStatus || session.feesStatus || "active";
        setText("studentWelcomeName", student.name || "Student");
        setText("studentBatchText", student.batch || "-");
        setText("statBatchName", student.batch || "-");
        setText("studentStatusText", accountStatus);
        setText("statAccountStatus", accountStatus);
        document.getElementById("studentBlockedBanner").hidden = String(accountStatus).toLowerCase() === "active";
        renderEmi(fees[0], emis);
        renderRecentMaterial(courseData, notes);
        renderAnnouncements(announcements);
    }

    window.VinayakStudentDashboard = { load: loadDashboard };
}());

