(function () {
    const config = window.VINAYAK_SUPABASE_CONFIG || {};
    const LOGIN_PATH = "login.html";
    const HOME_PATH = config.loginRedirect || "index.html";
    const ADMIN_PATH = config.adminRedirect || "admin.html";
    const SESSION_KEY = "vinayak_session";
    const LEGACY_KEYS = [
        "vinayak_is_admin",
        "vinayak_admin_id",
        "loggedIn",
        "studentId",
        "studentCourse"
    ];
    const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;
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

    function now() {
        return Date.now();
    }

    function clearLegacySessionFlags() {
        LEGACY_KEYS.forEach(function (key) {
            window.localStorage.removeItem(key);
            window.sessionStorage.removeItem(key);
        });
    }

    function getStoredSession() {
        const raw = window.sessionStorage.getItem(SESSION_KEY);
        if (!raw) {
            return null;
        }

        try {
            const session = JSON.parse(raw);
            if (!session || typeof session !== "object") {
                return null;
            }

            return session;
        } catch (error) {
            console.error("Invalid session payload", error);
            return null;
        }
    }

    function persistSession(session) {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        clearLegacySessionFlags();
    }

    function clearSession() {
        window.sessionStorage.removeItem(SESSION_KEY);
        clearLegacySessionFlags();
    }

    function isSessionExpired(session) {
        return !session || !session.expiresAt || Number(session.expiresAt) <= now();
    }

    function createBaseSession(role) {
        const createdAt = now();
        return {
            role: role,
            createdAt: createdAt,
            expiresAt: createdAt + SESSION_DURATION_MS
        };
    }

    function startAdminSession(adminId, password) {
        persistSession({
            role: "admin",
            adminId: adminId,
            password: password,
            createdAt: now(),
            expiresAt: now() + SESSION_DURATION_MS
        });
    }

    function startStudentSession(student, password) {
        const session = createBaseSession("student");
        session.studentId = student.id || "";
        session.course = student.course || "";
        session.password = password;
        persistSession(session);
    }

    function refreshSession(session) {
        const updatedSession = Object.assign({}, session, {
            expiresAt: now() + SESSION_DURATION_MS
        });

        persistSession(updatedSession);
        return updatedSession;
    }

    function getCurrentPath() {
        const path = window.location.pathname || "";
        const normalizedPath = path.charAt(0) === "/" ? path.slice(1) : path;
        return normalizedPath + window.location.search + window.location.hash;
    }

    function normalizePagePath(path) {
        return String(path || "").replace(/^\/+/, "");
    }

    function getProjectRootPrefix() {
        return window.location.pathname.toLowerCase().includes("/html/") ? "../" : "";
    }

    function toPageUrl(path) {
        return getProjectRootPrefix() + normalizePagePath(path);
    }

    function getLoginRedirectUrl() {
        return toPageUrl(LOGIN_PATH) + "?next=" + encodeURIComponent(getCurrentPath());
    }

    function getPostLoginRedirect() {
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");
        return next && !next.startsWith("http") ? normalizePagePath(next) : normalizePagePath(HOME_PATH);
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
        clearSession();
        window.location.replace(toPageUrl(LOGIN_PATH));
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

    async function validateAdminSession(session) {
        if (!session || session.role !== "admin" || isSessionExpired(session)) {
            return null;
        }

        const expectedId = String(config.adminId || "admin");
        const expectedPassword = String(config.adminPassword || "admin123");

        if (session.adminId !== expectedId || session.password !== expectedPassword) {
            return null;
        }

        return refreshSession(session);
    }

    async function validateStudentSession(session) {
        if (!session || session.role !== "student" || isSessionExpired(session)) {
            return null;
        }

        if (!session.studentId || !session.password) {
            return null;
        }

        const { data, error } = await getClient()
            .from(getStudentsTableName())
            .select("id, course")
            .eq("id", session.studentId)
            .eq("password", session.password)
            .maybeSingle();

        if (error || !data) {
            return null;
        }

        return refreshSession({
            role: "student",
            studentId: data.id,
            course: data.course || "",
            password: session.password,
            createdAt: session.createdAt || now()
        });
    }

    async function getValidatedSession() {
        clearLegacySessionFlags();

        const session = getStoredSession();
        if (!session) {
            return null;
        }

        if (session.role === "admin") {
            return validateAdminSession(session);
        }

        if (session.role === "student") {
            return validateStudentSession(session);
        }

        return null;
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
            const { data, error } = await getClient()
                .from(getStudentsTableName())
                .select("id, course, password")
                .eq("id", studentId)
                .eq("password", password)
                .single();

            if (error || !data) {
                throw new Error("Invalid ID or Password");
            }

            clearSession();
            startStudentSession(data, password);
            window.location.replace(toPageUrl(getPostLoginRedirect()));
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

            clearSession();
            startAdminSession(adminId, password);
            window.location.replace(toPageUrl(ADMIN_PATH));
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
            return null;
        }

        const session = await getValidatedSession();
        if (!session) {
            clearSession();
            window.location.replace(getLoginRedirectUrl());
            return null;
        }

        if (settings.adminOnly && session.role !== "admin") {
            clearSession();
            window.location.replace(getLoginRedirectUrl());
            return null;
        }

        ensureLogoutButton();
        showBody();
        return session;
    }

    async function initLoginPage() {
        if (!isConfigured()) {
            renderConfigError();
            return;
        }

        bindLoginTabs();

        const session = await getValidatedSession();
        if (session) {
            if (session.role === "admin") {
                window.location.replace(toPageUrl(ADMIN_PATH));
                return;
            }

            window.location.replace(toPageUrl(getPostLoginRedirect()));
            return;
        }

        clearSession();

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
        clearSession: clearSession,
        getClient: getClient,
        getStudentsTableName: getStudentsTableName,
        getValidatedSession: getValidatedSession,
        initLoginPage: initLoginPage,
        initProtectedPage: initProtectedPage,
        logoutAndRedirect: logoutAndRedirect,
        showMessage: showMessage
    };
}());
