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
            '<button type="button" class="student-menu-btn" data-student-sidebar-toggle aria-label="Open menu"><i class="fas fa-bars"></i></button>',
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

    function createSidebar() {
        const navItems = [
            ["Dashboard", "fa-gauge-high", ROOT_PREFIX + "index.html"],
            ["My Courses", "fa-layer-group", ROOT_PREFIX + "index.html#subjectsGrid"],
            ["Study Material", "fa-book-open", ROOT_PREFIX + "index.html#studentSubjectsGrid"],
            ["Video Lectures", "fa-circle-play", "#video-lectures"],
            ["Assignments", "fa-clipboard-list", "#assignments"],
            ["EMI & Payments", "fa-indian-rupee-sign", ROOT_PREFIX + "index.html#studentEmiCard"],
            ["Notices", "fa-bullhorn", ROOT_PREFIX + "index.html#announcementList"],
            ["Profile", "fa-user-graduate", "#profile"],
            ["Settings", "fa-gear", "#settings"]
        ];
        return [
            '<aside class="student-sidebar" aria-label="Student navigation">',
            '<div class="student-sidebar-brand"><img src="', ROOT_PREFIX, 'logo.png" alt=""><span>Student ERP</span></div>',
            '<nav class="student-sidebar-nav">',
            navItems.map(function (item) {
                return '<a href="' + item[2] + '"><i class="fas ' + item[1] + '"></i><span>' + item[0] + '</span></a>';
            }).join(""),
            '<button type="button" data-student-logout><i class="fas fa-right-from-bracket"></i><span>Logout</span></button>',
            '</nav>',
            '</aside>',
            '<button type="button" class="student-sidebar-scrim" data-student-sidebar-toggle aria-label="Close menu"></button>'
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
        document.querySelectorAll("#logoutBtn, [data-student-logout]").forEach(function (button) {
            if (!button || button.dataset.layoutBound) {
                return;
            }
            button.dataset.layoutBound = "true";
            button.addEventListener("click", function () {
                if (window.VinayakAuth && typeof window.VinayakAuth.logoutAndRedirect === "function") {
                    window.VinayakAuth.logoutAndRedirect();
                }
            });
        });
    }

    function bindSidebar() {
        document.querySelectorAll("[data-student-sidebar-toggle]").forEach(function (button) {
            if (button.dataset.sidebarBound) {
                return;
            }
            button.dataset.sidebarBound = "true";
            button.addEventListener("click", function () {
                document.body.classList.toggle("student-sidebar-open");
            });
        });
        document.querySelectorAll(".student-sidebar a").forEach(function (link) {
            if (link.dataset.sidebarBound) {
                return;
            }
            link.dataset.sidebarBound = "true";
            link.addEventListener("click", function () {
                document.body.classList.remove("student-sidebar-open");
            });
        });
    }

    function bindNotifications() {
        const button = document.querySelector(".student-icon-btn");
        if (!button || button.dataset.noticeBound) {
            return;
        }
        button.dataset.noticeBound = "true";
        button.addEventListener("click", function () {
            const target = document.getElementById("announcementList");
            if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    }

    function ensureDashboardProfile() {
        const topActions = document.querySelector(".student-top-actions");
        if (!topActions || topActions.querySelector(".student-profile-mini")) {
            return;
        }
        const session = getSession();
        const studentName = session.studentName || session.name || "Student";
        const studentId = session.studentId || window.localStorage.getItem("studentId") || "-";
        const profile = document.createElement("div");
        profile.className = "student-profile-mini";
        profile.innerHTML = '<i class="fas fa-user-graduate"></i><span data-layout-student-name>' + studentName + '</span><small data-layout-student-id>ID: ' + studentId + '</small>';
        const logout = document.getElementById("logoutBtn");
        topActions.insertBefore(profile, logout || null);
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
        ensureDashboardProfile();
        if (!document.querySelector(".student-sidebar")) {
            document.querySelector(".student-topbar").insertAdjacentHTML("afterend", createSidebar());
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
        bindSidebar();
        bindNotifications();
        hydrateStudent();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyLayout);
    } else {
        applyLayout();
    }
}());
