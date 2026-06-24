(function () {
    const LOGIN_PATH = "login.html";
    const SESSION_KEY = "vinayak_session";
    const COURSES_KEY = "courses";
    const COURSE_KEY = "course";
    const LOCAL_SESSION_ID_KEY = "sessionId";
    const LOCAL_STUDENT_ID_KEY = "studentId";
    const LEGACY_KEYS = [
        "vinayak_is_admin",
        "vinayak_admin_id",
        "loggedIn",
        "studentId",
        "studentCourse"
    ];
    const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;
    let logoutBound = false;

    function getConfig() {
        return window.VINAYAK_SUPABASE_CONFIG || {};
    }

    function getHomePath() {
        return getConfig().loginRedirect || "index.html";
    }

    function getAdminPath() {
        return getConfig().adminRedirect || "admin.html";
    }

    function isConfigured() {
        const config = getConfig();
        return Boolean(
            config.url &&
            config.publishableKey &&
            !config.url.includes("YOUR_PROJECT_ID") &&
            !config.publishableKey.includes("YOUR_SUPABASE_PUBLISHABLE_KEY")
        );
    }

    function getClient() {
        const config = getConfig();

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
        return getConfig().studentsTable || "students";
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

    function getStoredStudentSessionId() {
        return window.localStorage.getItem(LOCAL_SESSION_ID_KEY) || "";
    }

    function getStoredStudentId() {
        return window.localStorage.getItem(LOCAL_STUDENT_ID_KEY) || "";
    }

    function normalizeCourseName(value) {
        return String(value || "").trim().toUpperCase();
    }

    function normalizeSingleCourse(value) {
        const normalizedCourses = normalizeCourseValue(value);
        return normalizedCourses.length ? normalizedCourses[0] : "";
    }

    function normalizeCourseValue(value) {
        let list = [];

        if (Array.isArray(value)) {
            list = value;
        } else if (typeof value === "string") {
            const raw = value.trim();

            if (!raw) {
                list = [];
            } else if (raw.charAt(0) === "[") {
                try {
                    const parsed = JSON.parse(raw);
                    list = Array.isArray(parsed) ? parsed : [raw];
                } catch (error) {
                    list = raw.split(/\s*[,/|]\s*/);
                }
            } else {
                list = raw.split(/\s*[,/|]\s*/);
            }
        } else if (value) {
            list = [value];
        }

        return list
            .map(normalizeCourseName)
            .filter(Boolean)
            .filter(function (course, index, courses) {
                return courses.indexOf(course) === index;
            });
    }

    function persistCourses(courses) {
        const normalizedCourses = normalizeCourseValue(courses);
        const normalizedCourse = normalizedCourses.length ? normalizedCourses[0] : "";
        window.localStorage.setItem(COURSES_KEY, JSON.stringify(normalizedCourses));
        if (normalizedCourse) {
            window.localStorage.setItem(COURSE_KEY, normalizedCourse);
        } else {
            window.localStorage.removeItem(COURSE_KEY);
        }
    }

    function persistStudentSession(sessionId, studentId) {
        window.localStorage.setItem(LOCAL_SESSION_ID_KEY, String(sessionId || ""));
        window.localStorage.setItem(LOCAL_STUDENT_ID_KEY, String(studentId || ""));
    }

    function clearStoredCourses() {
        window.localStorage.removeItem(COURSES_KEY);
        window.localStorage.removeItem(COURSE_KEY);
    }

    function clearStoredStudentSession() {
        window.localStorage.removeItem(LOCAL_SESSION_ID_KEY);
        window.localStorage.removeItem(LOCAL_STUDENT_ID_KEY);
    }

    function getStoredCourses() {
        const localCourse = window.localStorage.getItem(COURSE_KEY);
        if (localCourse) {
            return normalizeCourseValue(localCourse);
        }

        const localCourses = window.localStorage.getItem(COURSES_KEY);

        if (localCourses) {
            try {
                return normalizeCourseValue(JSON.parse(localCourses));
            } catch (error) {
                return normalizeCourseValue(localCourses);
            }
        }

        const session = getStoredSession();
        if (!session) {
            return [];
        }

        return normalizeCourseValue(session.courses || session.course);
    }

    function getStoredCourse() {
        return normalizeSingleCourse(getStoredCourses());
    }

    function hasCourseAccess(courseKey, courseList) {
        const normalizedCourseKey = normalizeCourseName(courseKey);
        const normalizedCourseList = normalizeCourseValue(courseList || getStoredCourses());
        return normalizedCourseList.includes(normalizedCourseKey);
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
        clearStoredCourses();
        clearStoredStudentSession();
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

    function startStudentSession(student, password, sessionId) {
        const session = createBaseSession("student");
        const course = normalizeSingleCourse(student.course);
        session.studentId = student.id || "";
        session.course = course;
        session.courses = course ? [course] : [];
        session.password = password;
        session.sessionId = String(sessionId || student.session_id || "");
        persistSession(session);
        persistCourses(course);
        persistStudentSession(session.sessionId, session.studentId);
        window.localStorage.setItem("loggedIn", "true");
        window.localStorage.setItem("studentId", session.studentId);
        window.localStorage.setItem("course", course);
    }

    function refreshSession(session) {
        const updatedSession = Object.assign({}, session, {
            expiresAt: now() + SESSION_DURATION_MS
        });

        persistSession(updatedSession);
        if (updatedSession.role === "student") {
            persistCourses(updatedSession.course || updatedSession.courses);
            persistStudentSession(updatedSession.sessionId, updatedSession.studentId);
            window.localStorage.setItem("loggedIn", "true");
            window.localStorage.setItem("studentId", updatedSession.studentId || "");
            window.localStorage.setItem("course", normalizeSingleCourse(updatedSession.course || updatedSession.courses));
        }
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
        return next && !next.startsWith("http") ? normalizePagePath(next) : normalizePagePath(getHomePath());
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

    function clearFallbackMessage() {
        const fallback = document.getElementById("authFallbackMessage");
        if (fallback) {
            fallback.remove();
        }
    }

    async function logoutAndRedirect() {
        clearSession();
        window.location.replace(toPageUrl(LOGIN_PATH));
    }

    async function forceStudentLogout(message) {
        clearSession();
        if (message) {
            window.alert(message);
        }
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
        const config = getConfig();

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

        const localSessionId = getStoredStudentSessionId();
        const localStudentId = getStoredStudentId();

        if (!session.studentId || !session.password || !session.sessionId || !localSessionId || !localStudentId) {
            return null;
        }

        const { data, error } = await getClient()
            .from(getStudentsTableName())
            .select("id, course, session_id")
            .eq("id", session.studentId)
            .eq("password", session.password)
            .limit(1);

        if (error || !data || !data.length) {
            return null;
        }

        const student = data[0];

        if (
            String(student.session_id || "") !== String(localSessionId) ||
            String(session.sessionId || "") !== String(localSessionId) ||
            String(student.id || "") !== String(localStudentId)
        ) {
            return { invalidSession: true };
        }

        return refreshSession({
            role: "student",
            studentId: student.id,
            course: normalizeSingleCourse(student.course),
            courses: normalizeCourseValue(student.course),
            password: session.password,
            sessionId: student.session_id || localSessionId,
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
            const validatedStudentSession = await validateStudentSession(session);
            if (validatedStudentSession && validatedStudentSession.invalidSession) {
                await forceStudentLogout("You have been logged out. Another device logged in.");
                return null;
            }
            return validatedStudentSession;
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
            const client = getClient();
            const sessionId = Date.now().toString();
            const { data, error } = await client
                .from(getStudentsTableName())
                .select("*")
                .eq("id", studentId)
                .eq("password", password)
                .limit(1);

            if (error) {
                console.error("Student login query failed", error);
                showMessage("Database error. Check Supabase table access or RLS policy.", "error", "studentAuthMessage");
                return;
            }

            if (!data || !data.length) {
                showMessage("Invalid ID or Password", "error", "studentAuthMessage");
                return;
            }

            const student = data[0];

            const { error: sessionError } = await client
                .from(getStudentsTableName())
                .update({ session_id: sessionId })
                .eq("id", studentId);

            if (sessionError) {
                console.error("Session update failed", sessionError);
                showMessage("Database error. Could not start student session.", "error", "studentAuthMessage");
                return;
            }

            clearSession();
            startStudentSession(student, password, sessionId);
            window.location.replace(toPageUrl(getPostLoginRedirect()));
        } catch (error) {
            console.error("Student login failed", error);
            showMessage(error.message || "Login failed.", "error", "studentAuthMessage");
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
        const config = getConfig();

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
            window.location.replace(toPageUrl(getAdminPath()));
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
        console.log("CONFIG:", getConfig());

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

        if (settings.requiredCourse && !hasCourseAccess(settings.requiredCourse, session.courses || session.course)) {
            window.location.replace(toPageUrl(getHomePath()));
            return null;
        }

        clearFallbackMessage();
        ensureLogoutButton();
        showBody();
        return session;
    }

    async function initLoginPage() {
        console.log("CONFIG:", getConfig());

        if (!isConfigured()) {
            renderConfigError();
            return;
        }

        bindLoginTabs();

        const session = await getValidatedSession();
        if (session) {
            if (session.role === "admin") {
                window.location.replace(toPageUrl(getAdminPath()));
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
        clearFallbackMessage();
        showBody();
    }

    window.VinayakAuth = {
        clearSession: clearSession,
        getClient: getClient,
        getStoredCourses: getStoredCourses,
        getStoredCourse: getStoredCourse,
        getStoredStudentId: getStoredStudentId,
        getStoredStudentSessionId: getStoredStudentSessionId,
        getStudentsTableName: getStudentsTableName,
        getValidatedSession: getValidatedSession,
        hasCourseAccess: hasCourseAccess,
        initLoginPage: initLoginPage,
        initProtectedPage: initProtectedPage,
        logoutAndRedirect: logoutAndRedirect,
        normalizeCourseValue: normalizeCourseValue,
        normalizeSingleCourse: normalizeSingleCourse,
        showMessage: showMessage
    };
}());
