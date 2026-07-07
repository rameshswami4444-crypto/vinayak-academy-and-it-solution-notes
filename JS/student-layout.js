(function () {
    const ROOT_PREFIX = window.location.pathname.toLowerCase().includes("/html/") ? "../" : "";
    const INSTITUTE_NAME = "Vinayak Academy And IT Solutions";
    const VERSION = "Version 2.0";
    const SIDEBAR_STATE_KEY = "vinayak_student_sidebar_collapsed";

    function getSession() {
        try {
            return JSON.parse(window.localStorage.getItem("student_session") || window.localStorage.getItem("vinayak_session") || "null") || {};
        } catch (error) {
            return {};
        }
    }

    function createHeader() {
        const session = getSession();
        const studentName = session.studentName || session.name || "Student";
        const course = session.course || window.localStorage.getItem("course") || "-";
        const batch = session.batch || window.localStorage.getItem("batch") || "-";
        return [
            '<header class="student-topbar student-common-header">',
            '<div class="student-brand student-brand-shell">',
            '<button type="button" class="student-menu-btn" data-student-sidebar-toggle aria-label="Toggle student menu"><i data-lucide="panel-left-close"></i></button>',
            '<img src="', ROOT_PREFIX, 'logo.png" alt="Vinayak Academy logo" class="student-logo">',
            '<div class="student-brand-copy"><small>Student Portal</small><strong data-layout-student-name>', studentName, '</strong><span><b data-layout-course>', course, '</b></span></div>',
            '</div>',
            '<form class="student-top-search" data-student-search-form><i class="fas fa-magnifying-glass"></i><input type="search" data-student-search-input placeholder="Search notes, assignments, notices" aria-label="Search student dashboard"></form>',
            '<div class="student-top-actions">',
            '<button type="button" class="student-icon-btn" aria-label="Notifications"><i data-lucide="bell-ring"></i><span data-layout-notification-count>0</span></button>',
            '<button type="button" class="logout-btn" id="logoutBtn"><i class="fas fa-right-from-bracket"></i> Logout</button>',
            '</div>',
            '</header>'
        ].join("");
    }

    function createSidebar() {
        const navItems = [
            ["Dashboard", "layout-dashboard", ROOT_PREFIX + "dashboard.html"],
            ["Study Material", "book-open", ROOT_PREFIX + "studymaterial.html"],
            ["Assignments", "clipboard-check", ROOT_PREFIX + "assignments.html"],
            ["Video Lectures", "circle-play", ROOT_PREFIX + "videolecures.html"],
            ["EMI & Payments", "wallet-cards", ROOT_PREFIX + "emi.html"],
            ["Notices", "megaphone", ROOT_PREFIX + "notices.html"],
            ["Profile", "badge-check", ROOT_PREFIX + "profile.html"],
            ["Logout", "log-out", ROOT_PREFIX + "login.html"]
        ];
        return [
            '<aside class="student-sidebar" aria-label="Student navigation">',
            '<div class="student-sidebar-brand"><img src="', ROOT_PREFIX, 'logo.png" alt=""><div><strong>Student ERP</strong><span>Learning Workspace</span></div></div>',
            '<nav class="student-sidebar-nav">',
            navItems.map(function (item) {
                return item[0] === "Logout"
                    ? '<button type="button" data-student-logout><i data-lucide="' + item[1] + '"></i><span>' + item[0] + '</span></button>'
                    : '<a href="' + item[2] + '"><i data-lucide="' + item[1] + '"></i><span>' + item[0] + '</span></a>';
            }).join(""),
            '</nav>',
            '<div class="student-sidebar-footer"><p>Premium student workspace</p><strong>' + VERSION + '</strong></div>',
            '</aside>',
            '<button type="button" class="student-sidebar-scrim" data-student-sidebar-toggle aria-label="Close menu"></button>'
        ].join("");
    }

    function createFooter() {
        return [
            '<footer class="student-footer student-common-footer">',
            '<strong>', INSTITUTE_NAME, '</strong>',
            '<span>Copyright 2026 | Contact: Support | ', VERSION, '</span>',
            '</footer>'
        ].join("");
    }

    function createInfoStrip() {
        const text = "📢 Welcome to Vinayak Academy | Do not share study material outside the portal | EMI due students will lose access automatically | Contact Admin for support.";
        return [
            '<div class="student-marquee student-news-ticker" aria-label="Important student updates">',
            '<div class="student-news-track">',
            '<span>', text, '</span>',
            '<span aria-hidden="true">', text, '</span>',
            '</div>',
            '</div>'
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
                .select("id, name, course, batch")
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
            document.querySelectorAll("[data-layout-course]").forEach(function (node) {
                node.textContent = student.course || window.localStorage.getItem("course") || "-";
            });
            document.querySelectorAll("[data-layout-batch]").forEach(function (node) {
                node.textContent = student.batch || "-";
            });
            const inlineId = document.getElementById("studentIdInlineText");
            if (inlineId) {
                inlineId.textContent = student.id || studentId;
            }
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
                if (window.innerWidth <= 1024) {
                    document.body.classList.toggle("student-sidebar-open");
                    return;
                }
                const collapsed = !document.body.classList.contains("student-sidebar-collapsed");
                document.body.classList.toggle("student-sidebar-collapsed", collapsed);
                window.localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? "1" : "0");
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
            window.location.href = ROOT_PREFIX + "notices.html";
        });
    }

    function createFragment(markup) {
        const template = document.createElement("template");
        template.innerHTML = markup.trim();
        return template.content.firstChild;
    }

    function ensureSearchBar() {
        const topbar = document.querySelector(".student-topbar");
        if (!topbar || topbar.querySelector("[data-student-search-form]")) {
            return;
        }
        const actions = topbar.querySelector(".student-top-actions");
        topbar.insertBefore(createFragment('<form class="student-top-search" data-student-search-form><i class="fas fa-magnifying-glass"></i><input type="search" data-student-search-input placeholder="Search notes, assignments, notices" aria-label="Search student dashboard"></form>'), actions || null);
    }

    function highlightActiveNav() {
        const currentPath = window.location.pathname.toLowerCase();
        document.querySelectorAll(".student-sidebar a").forEach(function (link) {
            const href = String(link.getAttribute("href") || "").toLowerCase();
            const pathOnly = href.split("#")[0].replace("../", "").replace("./", "");
            const active = Boolean(pathOnly && currentPath.endsWith("/" + pathOnly));
            link.classList.toggle("active", active);
        });
    }

    function bindSearch() {
        document.querySelectorAll("[data-student-search-form]").forEach(function (form) {
            if (form.dataset.searchBound) {
                return;
            }
            form.dataset.searchBound = "true";
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                const input = form.querySelector("[data-student-search-input]");
                const query = String(input && input.value || "").trim().toLowerCase();
                if (!query) {
                    return;
                }
                const candidates = Array.from(document.querySelectorAll(".student-panel, .student-list-item, .student-quick-card, .student-page-card, .student-material-card, .student-assignment-row"));
                const match = candidates.find(function (node) {
                    return String(node.textContent || "").toLowerCase().includes(query);
                });
                if (!match) {
                    return;
                }
                document.querySelectorAll(".student-search-hit").forEach(function (node) {
                    node.classList.remove("student-search-hit");
                });
                match.classList.add("student-search-hit");
                match.scrollIntoView({ behavior: "smooth", block: "center" });
            });
        });
    }

    function ensureMenuButton() {
        const brand = document.querySelector(".student-brand");
        if (!brand || brand.querySelector("[data-student-sidebar-toggle]")) {
            return;
        }
        brand.insertAdjacentHTML("afterbegin", '<button type="button" class="student-menu-btn" data-student-sidebar-toggle aria-label="Toggle student menu"><i data-lucide="panel-left-close"></i></button>');
    }

    function inferPageMeta() {
        const body = document.body;
        const heading = document.querySelector(".ecce-title h2, .resource-placeholder h2, main h2, .student-section-head h2");
        const subheading = document.querySelector(".ecce-title p, .resource-placeholder p, main p");
        const pageTitle = body.dataset.pageTitle || (heading ? heading.textContent.trim() : document.title.replace(/\s*-\s*Vinayak Academy.*/i, "").trim()) || "Learning Workspace";
        const pageSubtitle = body.dataset.pageSubtitle || (subheading ? subheading.textContent.trim() : "Access your enrolled course resources, notes, and guided learning tools in one place.");
        const pageBadge = body.dataset.pageBadge || "Student Workspace";
        return { title: pageTitle, subtitle: pageSubtitle, badge: pageBadge };
    }

    function enhanceLegacyPages() {
        const main = document.querySelector("main");
        if (!main || main.dataset.layoutEnhanced) {
            return;
        }
        main.dataset.layoutEnhanced = "true";
        main.classList.add("student-page-main");

        const meta = inferPageMeta();
        const hasDashboard = document.querySelector(".student-home-summary");
        const inlineHero = main.querySelector(".ecce-header-row");
        const hasMaterialGrid = Boolean(main.querySelector("[data-material-grid]"));
        if (!hasDashboard && !inlineHero && !hasMaterialGrid) {
            main.insertAdjacentHTML("afterbegin", [
                '<section class="student-page-head">',
                '<div class="student-page-head-copy">',
                '<p class="login-badge">', meta.badge, '</p>',
                '<h1>', meta.title, '</h1>',
                '<p>', meta.subtitle, '</p>',
                '</div>',
                '</section>'
            ].join(""));
        }
        if (inlineHero) {
            inlineHero.classList.add("student-inline-hero");
        }

        const subjectsGrid = main.querySelector(".subjects-grid");
        const viewerLayout = main.querySelector(".viewer-layout");
        const placeholder = main.querySelector(".resource-placeholder");

        if (subjectsGrid && !subjectsGrid.closest(".student-page-board")) {
            subjectsGrid.classList.add("student-catalog-grid");
            subjectsGrid.insertAdjacentHTML("beforebegin", [
                '<section class="student-page-board simple-board">',
                '<div class="student-board-main">'
            ].join(""));
            subjectsGrid.insertAdjacentHTML("afterend", [
                '</div>',
                '</section>'
            ].join(""));
        }

        if (viewerLayout && !viewerLayout.closest(".student-page-board")) {
            viewerLayout.insertAdjacentHTML("beforebegin", '<section class="student-page-board student-page-board-viewer simple-board"><div class="student-board-main">');
            viewerLayout.insertAdjacentHTML("afterend", [
                '</div></section>'
            ].join(""));
        }

        if (placeholder) {
            placeholder.classList.add("student-resource-placeholder");
            if (!placeholder.querySelector(".student-placeholder-actions")) {
                placeholder.insertAdjacentHTML("beforeend", [
                    '<div class="student-placeholder-actions">',
                    '<a class="login-btn student-link-btn" href="' + ROOT_PREFIX + 'dashboard.html">Go to Dashboard</a>',
                    '<a class="logout-btn student-link-btn secondary" href="' + ROOT_PREFIX + 'studymaterial.html">Open Study Material</a>',
                    '</div>'
                ].join(""));
            }
        }
    }

    function ensureInfoStrip() {
        const oldMarquees = document.querySelectorAll(".student-marquee:not(.student-news-ticker)");
        oldMarquees.forEach(function (marquee) {
            marquee.remove();
        });
        if (!document.querySelector(".student-news-ticker")) {
            const footer = document.querySelector(".student-footer");
            if (footer) {
                footer.insertAdjacentHTML("beforebegin", createInfoStrip());
            } else {
                document.body.insertAdjacentHTML("beforeend", createInfoStrip());
            }
        }
    }

    function ensureLucide() {
        function renderIcons() {
            if (window.lucide && typeof window.lucide.createIcons === "function") {
                window.lucide.createIcons();
            }
        }
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            renderIcons();
            return;
        }
        if (document.querySelector('script[data-lucide-loader="student"]')) {
            return;
        }
        const script = document.createElement("script");
        script.src = "https://unpkg.com/lucide@latest";
        script.async = true;
        script.dataset.lucideLoader = "student";
        script.onload = renderIcons;
        document.head.appendChild(script);
    }

    function restoreSidebarPreference() {
        if (window.innerWidth <= 1024) {
            document.body.classList.remove("student-sidebar-collapsed");
            return;
        }
        document.body.classList.toggle("student-sidebar-collapsed", window.localStorage.getItem(SIDEBAR_STATE_KEY) === "1");
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
        ensureMenuButton();
        ensureSearchBar();
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
        bindSearch();
        highlightActiveNav();
        enhanceLegacyPages();
        ensureInfoStrip();
        restoreSidebarPreference();
        ensureLucide();
        hydrateStudent();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyLayout);
    } else {
        applyLayout();
    }
}());
