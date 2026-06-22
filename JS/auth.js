(function () {
    const config = window.VINAYAK_SUPABASE_CONFIG || {};
    const LOGIN_PATH = "/login.html";
    const HOME_PATH = config.loginRedirect || "/index.html";
    const ADMIN_PATH = config.adminRedirect || "/admin.html";
    const ADMIN_FLAG_KEY = "vinayak_is_admin";
    const ADMIN_ID_KEY = "vinayak_admin_id";
    const STUDENT_FLAG_KEY = "loggedIn";
    const STUDENT_ID_KEY = "studentId";
    const STUDENT_COURSE_KEY = "studentCourse";
    let logoutBound = false;

    function isConfigured() {
        return Boolean(
            config.url &&
            config.publishableKey &&
            !config.url.includes("YOUR_PROJECT_ID") &&
            !config.publishableKey.includes("YOUR_SUPABASE_PUBLISHABLE_KEY")
        );
    }

    function getClient() {
        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            throw new Error("Supabase library failed to load.");
        }

        if (!window.__vinayakSupabaseClient) {
            window.__vinayakSupabaseClient = window.supabase.createClient(
                config.url,
                config.publishableKey
            );
        }

        return window.__vinayakSupabaseClient;
    }

    function getStudentsTableName() {
        return config.studentsTable || "students";
    }

    function isAdminSessionActive() {
        return window.localStorage.getItem(ADMIN_FLAG_KEY) === "true";
    }

    function isStudentSessionActive() {
        return window.localStorage.getItem(STUDENT_FLAG_KEY) === "true";
    }

    function startAdminSession(adminId) {
        window.localStorage.setItem(ADMIN_FLAG_KEY, "true");
        window.localStorage.setItem(ADMIN_ID_KEY, adminId || "admin");
    }

    function clearAdminSession() {
        window.localStorage.removeItem(ADMIN_FLAG_KEY);
        window.localStorage.removeItem(ADMIN_ID_KEY);
    }

    function startStudentSession(student) {
        window.localStorage.setItem(STUDENT_FLAG_KEY, "true");
        window.localStorage.setItem(STUDENT_ID_KEY, student.id || "");
        window.localStorage.setItem(STUDENT_COURSE_KEY, student.course || "");
    }

    function clearStudentSession() {
        window.localStorage.removeItem(STUDENT_FLAG_KEY);
        window.localStorage.removeItem(STUDENT_ID_KEY);
        window.localStorage.removeItem(STUDENT_COURSE_KEY);
    }

    function getCurrentPath() {
        return window.location.pathname + window.location.search + window.location.hash;
    }

    function getLoginRedirectUrl() {
        return LOGIN_PATH + "?next=" + encodeURIComponent(getCurrentPath());
    }

    function getPostLoginRedirect() {
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");
        return next && next.startsWith("/") ? next : HOME_PATH;
    }

    function showBody() {
        if (document.body) {
            document.body.classList.remove("auth-pending");
        }
    }

    function showMessage(message, type, targetId) {
        const box = document.getElementById(targetId || "authMessage");
        if (!box) {
            const fallbackHost = document.querySelector("main") || document.body;
            if (!fallbackHost) {
                return;
            }

            let fallback = document.getElementById("authFallbackMessage");
            if (!fallback) {
                fallback = document.createElement("div");
                fallback.id = "authFallbackMessage";
                fallback.className = "resource-placeholder";
                fallbackHost.prepend(fallback);
            }

            fallback.innerHTML = "<h2>Authentication Setup Required</h2><p>" + message + "</p>";
            return;
        }

        box.textContent = message;
        box.className = "auth-message " + (type || "error");
        box.hidden = false;
    }

    function clearMessage(targetId) {
        const box = document.getElementById(targetId || "authMessage");
        if (!box) {
            return;
        }

        box.hidden = true;
        box.textContent = "";
        box.className = "auth-message";
    }

    function renderConfigError() {
        showBody();
        showMessage(
            "Supabase config missing. Update JS/supabase-config.js with your project URL and publishable key.",
            "error"
        );
    }

    async function logoutAndRedirect() {
        clearAdminSession();
        clearStudentSession();
        window.location.replace(LOGIN_PATH);
    }

    function bindLogoutButton() {
        const button = document.getElementById("logoutBtn");
        if (!button || logoutBound) {
            return;
        }

        logoutBound = true;
        button.addEventListener("click", async function () {
            button.disabled = true;
            await logoutAndRedirect();
        });
    }

    function ensureLogoutButton() {
        if (document.getElementById("logoutBtn")) {
            bindLogoutButton();
            return;
        }

        const headerContainer = document.querySelector(".header .container");
        if (!headerContainer) {
            return;
        }

        const actions = document.createElement("div");
        actions.className = "top-actions";
        actions.innerHTML = [
            '<button type="button" class="logout-btn" id="logoutBtn">',
            '<i class="fas fa-right-from-bracket"></i> Logout',
            "</button>"
        ].join("");

        headerContainer.appendChild(actions);
        bindLogoutButton();
    }

    function setLoginTab(tabName) {
        const tabs = document.querySelectorAll("[data-auth-tab]");
        const panels = document.querySelectorAll("[data-auth-panel]");

        tabs.forEach(function (tab) {
            const isActive = tab.getAttribute("data-auth-tab") === tabName;
            tab.classList.toggle("active", isActive);
            tab.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        panels.forEach(function (panel) {
            const isActive = panel.getAttribute("data-auth-panel") === tabName;
            panel.hidden = !isActive;
        });
    }

    function bindLoginTabs() {
        const tabs = document.querySelectorAll("[data-auth-tab]");
        if (!tabs.length) {
            return;
        }

        tabs.forEach(function (tab) {
            tab.addEventListener("click", function () {
                setLoginTab(tab.getAttribute("data-auth-tab"));
            });
        });
    }

    async function handleStudentLogin(event) {
        event.preventDefault();
        clearMessage("studentAuthMessage");
        clearMessage("adminAuthMessage");

        const identifierField = document.getElementById("studentIdentifier");
        const passwordField = document.getElementById("studentPassword");
        const submitButton = document.getElementById("studentLoginButton");
        const studentId = identifierField ? identifierField.value.trim() : "";
        const password = passwordField ? passwordField.value.trim() : "";

        if (!studentId || !password) {
            showMessage("Please enter student ID and password.", "error", "studentAuthMessage");
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Logging in...";
        }

        try {
            clearAdminSession();
            const { data, error } = await getClient()
                .from(getStudentsTableName())
                .select("*")
                .eq("id", studentId)
                .eq("password", password)
                .single();

            if (error || !data) {
                throw new Error("Invalid ID or Password");
            }

            startStudentSession(data);
            window.location.replace(getPostLoginRedirect());
        } catch (error) {
            console.error("Student login failed", error);
            showMessage("Invalid ID or Password", "error", "studentAuthMessage");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-right-to-bracket"></i> Login as Student';
            }
        }
    }

    async function handleAdminLogin(event) {
        event.preventDefault();
        clearMessage("studentAuthMessage");
        clearMessage("adminAuthMessage");

        const adminIdField = document.getElementById("adminId");
        const passwordField = document.getElementById("adminPassword");
        const submitButton = document.getElementById("adminLoginButton");
        const adminId = adminIdField ? adminIdField.value.trim() : "";
        const password = passwordField ? passwordField.value : "";

        if (!adminId || !password) {
            showMessage("Please enter admin ID and password.", "error", "adminAuthMessage");
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Checking...";
        }

        try {
            const expectedId = String(config.adminId || "admin");
            const expectedPassword = String(config.adminPassword || "admin123");

            if (adminId !== expectedId || password !== expectedPassword) {
                throw new Error("Invalid admin credentials.");
            }

            clearStudentSession();
            startAdminSession(adminId);
            window.location.replace(ADMIN_PATH);
        } catch (error) {
            console.error("Admin login failed", error);
            showMessage(error.message || "Admin login failed.", "error", "adminAuthMessage");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-shield-halved"></i> Login as Admin';
            }
        }
    }

    async function initProtectedPage(options) {
        const settings = options || {};

        if (!isConfigured()) {
            renderConfigError();
            return;
        }

        const adminActive = isAdminSessionActive();
        const studentActive = isStudentSessionActive();

        if (settings.adminOnly) {
            if (!adminActive) {
                window.location.replace(LOGIN_PATH);
                return;
            }
        } else if (!adminActive && !studentActive) {
            window.location.replace(getLoginRedirectUrl());
            return;
        }

        ensureLogoutButton();
        showBody();
    }

    async function initLoginPage() {
        if (!isConfigured()) {
            renderConfigError();
            return;
        }

        bindLoginTabs();

        if (isAdminSessionActive()) {
            window.location.replace(ADMIN_PATH);
            return;
        }

        if (isStudentSessionActive()) {
            window.location.replace(getPostLoginRedirect());
            return;
        }

        const studentForm = document.getElementById("studentLoginForm");
        const adminForm = document.getElementById("adminLoginForm");

        if (studentForm) {
            studentForm.addEventListener("submit", handleStudentLogin);
        }

        if (adminForm) {
            adminForm.addEventListener("submit", handleAdminLogin);
        }

        setLoginTab("student");
        showBody();
    }

    window.VinayakAuth = {
        ADMIN_FLAG_KEY: ADMIN_FLAG_KEY,
        STUDENT_FLAG_KEY: STUDENT_FLAG_KEY,
        clearAdminSession: clearAdminSession,
        clearStudentSession: clearStudentSession,
        getClient: getClient,
        getStudentsTableName: getStudentsTableName,
        initLoginPage: initLoginPage,
        initProtectedPage: initProtectedPage,
        isAdminSessionActive: isAdminSessionActive,
        isStudentSessionActive: isStudentSessionActive,
        logoutAndRedirect: logoutAndRedirect,
        showMessage: showMessage
    };
}());
