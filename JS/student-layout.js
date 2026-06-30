(function () {
    const ROOT_PREFIX = window.location.pathname.toLowerCase().includes("/html/") ? "../" : "";
    const INSTITUTE_NAME = "Vinayak Academy And IT Solutions";
    const VERSION = "Version 2.0";

    function getSession() {
        try {
            return JSON.parse(window.localStorage.getItem("vinayak_session") || "null") || {};
        } catch (error) {
            return {};
        }
    }

    function createHeader() {
        const session = getSession();
        const studentName = session.studentName || session.name || "Student";
        const studentId = session.studentId || window.localStorage.getItem("studentId") || "-";
        return [
            '<header class="student-topbar student-common-header">',
            '<div class="student-brand">',
            '<img src="', ROOT_PREFIX, 'logo.png" alt="Vinayak Academy logo" class="student-logo">',
            '<div><strong>', INSTITUTE_NAME, '</strong><span>Student LMS</span></div>',
            '</div>',
            '<div class="student-top-actions">',
            '<button type="button" class="student-icon-btn" aria-label="Notifications"><i class="fas fa-bell"></i><span data-layout-notification-count>0</span></button>',
            '<div class="student-profile-mini"><i class="fas fa-user-graduate"></i><span data-layout-student-name>', studentName, '</span><small data-layout-student-id>', studentId, '</small></div>',
            '<button type="button" class="logout-btn" id="logoutBtn"><i class="fas fa-right-from-bracket"></i> Logout</button>',
            '</div>',
            '</header>'
        ].join("");
    }

    function createFooter() {
        return [
            '<footer class="student-footer student-common-footer">',
            '<strong>', INSTITUTE_NAME, '</strong>',
            '<span>Copyright 2026 | Contact: vinayak_it_solutions_ | ', VERSION, '</span>',
            '</footer>'
        ].join("");
    }

    async function hydrateStudent() {
        if (!window.VinayakAuth || typeof window.VinayakAuth.getClient !== "function") {
            return;
        }
        const session = getSession();
        const studentId = session.studentId || window.localStorage.getItem("studentId");
        if (!studentId) {
            return;
        }
        try {
            const result = await window.VinayakAuth.getClient()
                .from(window.VinayakAuth.getStudentsTableName())
                .select("id, name")
                .eq(window.VinayakAuth.getStudentIdentifierColumn(), studentId)
                .limit(1);
            const student = result.data && result.data[0];
            if (!student) {
                return;
            }
            document.querySelectorAll("[data-layout-student-name]").forEach(function (node) {
                node.textContent = student.name || "Student";
            });
            document.querySelectorAll("[data-layout-student-id]").forEach(function (node) {
                node.textContent = "ID: " + (student.id || studentId);
            });
        } catch (error) {
            console.warn("Student layout profile fetch failed", error);
        }
    }

    function bindLogout() {
        const button = document.getElementById("logoutBtn");
        if (!button || button.dataset.layoutBound) {
            return;
        }
        button.dataset.layoutBound = "true";
        button.addEventListener("click", function () {
            if (window.VinayakAuth && typeof window.VinayakAuth.logoutAndRedirect === "function") {
                window.VinayakAuth.logoutAndRedirect();
            }
        });
    }

    function applyLayout() {
        document.body.classList.add("student-lms-page");
        if (!document.querySelector(".student-topbar")) {
            const oldHeader = document.querySelector(".header");
            if (oldHeader) {
                oldHeader.outerHTML = createHeader();
            } else {
                document.body.insertAdjacentHTML("afterbegin", createHeader());
            }
        }
        if (!document.querySelector(".student-footer")) {
            const oldFooter = document.querySelector(".footer");
            if (oldFooter) {
                oldFooter.outerHTML = createFooter();
            } else {
                document.body.insertAdjacentHTML("beforeend", createFooter());
            }
        }
        bindLogout();
        hydrateStudent();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyLayout);
    } else {
        applyLayout();
    }
}());
