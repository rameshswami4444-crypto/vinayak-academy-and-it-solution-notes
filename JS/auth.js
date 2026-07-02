(function () {
    const LOGIN_PATH = "login.html";
    const BLOCKED_PATH = "blocked.html";
    const SESSION_KEY = "vinayak_session";
    const COURSES_KEY = "courses";
    const COURSE_KEY = "course";
    const LOCAL_SESSION_ID_KEY = "sessionId";
    const LOCAL_STUDENT_ID_KEY = "studentId";
    const LEGACY_KEYS = [
        "vinayak_is_admin",
        "vinayak_admin_id",
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

    function getStudentIdentifierColumn() {
        return getConfig().studentIdentifierColumn || "id";
    }

    function getStudentIdentifierValue(student) {
        if (!student || typeof student !== "object") {
            return "";
        }

        return String(
            student[getStudentIdentifierColumn()] ||
            student.id ||
            student.name ||
            ""
        ).trim();
    }

    function now() {
        return Date.now();
    }

    function getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
    }

    function normalizeDateValue(value) {
        if (!value) {
            return "";
        }

        if (typeof value === "string") {
            return value.slice(0, 10);
        }

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            const year = value.getFullYear();
            const month = String(value.getMonth() + 1).padStart(2, "0");
            const day = String(value.getDate()).padStart(2, "0");
            return year + "-" + month + "-" + day;
        }

        return String(value).slice(0, 10);
    }

    function normalizeFeesStatus(status) {
        if (!status) {
            return "due";
        }

        const normalizedStatus = String(status).trim().toLowerCase();

        if (normalizedStatus === "paid") {
            return "paid";
        }

        if (normalizedStatus === "due") {
            return "due";
        }

        return "due";
    }

    function normalizeAccountStatus(status) {
        const normalizedStatus = String(status || "active").trim().toLowerCase();
        if (normalizedStatus === "blocked" || normalizedStatus === "disabled") {
            return normalizedStatus;
        }
        return "active";
    }

    function normalizeEmiStatus(status) {
        const normalizedStatus = String(status || "pending").trim().toLowerCase();
        if (normalizedStatus === "paid" || normalizedStatus === "overdue") {
            return normalizedStatus;
        }
        return "pending";
    }

    function isStudentBlocked(student) {
        if (!student) {
            return false;
        }
        return normalizeAccountStatus(student.account_status || student.accountStatus) !== "active" ||
            normalizeFeesStatus(student.fees_status || student.feesStatus) === "due";
    }

    async function syncStudentEmiStatus(student, client) {
        if (!student || typeof student !== "object") {
            return student;
        }

        const identifier = getStudentIdentifierValue(student);
        if (!identifier) {
            return student;
        }

        const supabaseClient = client || getClient();
        const { data, error } = await supabaseClient
            .from("emis")
            .select("*")
            .eq("student_id", identifier);

        if (error) {
            console.error("EMI status check failed", error);
            return student;
        }

        const today = getTodayDateString();
        const emis = data || [];
        if (!emis.length) {
            return student;
        }

        const originalAccountStatus = normalizeAccountStatus(student.account_status || student.accountStatus);
        const originalFeesStatus = normalizeFeesStatus(student.fees_status || student.feesStatus);
        const overdueEmis = [];
        const updates = [];

        emis.forEach(function (emi) {
            const status = normalizeEmiStatus(emi.status);
            const dueDate = normalizeDateValue(emi.due_date);

            if (status !== "paid" && dueDate && dueDate < today) {
                overdueEmis.push(Object.assign({}, emi, { status: "overdue", due_date: dueDate }));
                if (status !== "overdue") {
                    let query = supabaseClient.from("emis").update({ status: "overdue" });
                    query = emi.id ? query.eq("id", emi.id) : query.eq("student_id", identifier).eq("emi_number", emi.emi_number);
                    updates.push(query);
                }
            }
        });

        if (updates.length) {
            const results = await Promise.all(updates);
            const updateError = results.find(function (result) {
                return result.error;
            });
            if (updateError && updateError.error) {
                console.error("EMI overdue update failed", updateError.error);
            }
        }

        const shouldBlock = originalAccountStatus === "disabled" || overdueEmis.length > 0;
        const nextStatus = shouldBlock ? (originalAccountStatus === "disabled" ? "disabled" : "blocked") : "active";
        const nextFeesStatus = shouldBlock ? "due" : "paid";
        const nextDueDate = overdueEmis.length ? normalizeDateValue(overdueEmis[0].due_date) : normalizeDateValue(student.due_date);
        const nextPaymentNote = overdueEmis.length ? "Overdue EMI pending" : (student.payment_note || "");

        student.account_status = nextStatus;
        student.fees_status = nextFeesStatus;
        student.due_date = nextDueDate;
        student.payment_note = nextPaymentNote;

        if (
            nextStatus !== originalAccountStatus ||
            nextFeesStatus !== originalFeesStatus
        ) {
            await supabaseClient
                .from(getStudentsTableName())
                .update({
                    account_status: nextStatus,
                    fees_status: nextFeesStatus,
                    due_date: nextDueDate || null,
                    payment_note: nextPaymentNote || null
                })
                .eq(getStudentIdentifierColumn(), identifier);
        }

        return student;
    }

    async function syncStudentFeesStatus(student, client) {
        if (!student || typeof student !== "object") {
            return student;
        }

        const currentStatus = normalizeFeesStatus(student.fees_status || student.feesStatus);
        const dueDate = normalizeDateValue(student.due_date || student.dueDate);

        student.fees_status = currentStatus;
        student.due_date = dueDate;
        student.payment_note = student.payment_note || student.paymentNote || "";

        if (currentStatus === "due" || !dueDate || getTodayDateString() <= dueDate) {
            return student;
        }

        const identifier = getStudentIdentifierValue(student);
        if (!identifier) {
            student.fees_status = "due";
            return student;
        }

        const supabaseClient = client || getClient();
        const { error } = await supabaseClient
            .from(getStudentsTableName())
            .update({ fees_status: "due" })
            .eq(getStudentIdentifierColumn(), identifier);

        if (error) {
            console.error("Auto due update failed", error);
            throw error;
        }

        student.fees_status = "due";
        return student;
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
        const raw = window.localStorage.getItem(SESSION_KEY);
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
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        clearLegacySessionFlags();
    }

    function clearSession() {
        window.localStorage.removeItem(SESSION_KEY);
        clearStoredCourses();
        clearStoredStudentSession();
        clearLegacySessionFlags();
        window.localStorage.removeItem("loggedIn");
        window.localStorage.removeItem("studentId");
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

    function buildStudentSession(student, password, sessionId, createdAt) {
        const session = createBaseSession("student");
        const course = normalizeSingleCourse(student.course);
        session.studentId = getStudentIdentifierValue(student);
        session.course = course;
        session.courses = course ? [course] : [];
        session.password = password;
        session.sessionId = String(sessionId || student.session_id || "");
        session.feesStatus = normalizeFeesStatus(student.fees_status);
        session.dueDate = normalizeDateValue(student.due_date);
        session.paymentNote = String(student.payment_note || "");
        session.accountStatus = normalizeAccountStatus(student.account_status);
        session.account_status = session.accountStatus;
        session.fees_status = session.feesStatus;
        session.due_date = session.dueDate;
        session.payment_note = session.paymentNote;
        if (createdAt) {
            session.createdAt = createdAt;
        }
        return session;
    }

    function startStudentSession(student, password, sessionId) {
        const session = buildStudentSession(student, password, sessionId);
        persistSession(session);
        persistCourses(session.course);
        persistStudentSession(session.sessionId, session.studentId);
        window.localStorage.setItem("loggedIn", "true");
        window.localStorage.setItem("studentId", session.studentId);
        window.localStorage.setItem("course", session.course);
        console.log("LOGIN SUCCESS", student);
        console.log("SESSION:", session.sessionId);
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

    function getBlockedRedirectUrl(nextPath) {
        const resolvedNextPath = nextPath || getCurrentPath();
        return toPageUrl(BLOCKED_PATH) + "?next=" + encodeURIComponent(resolvedNextPath);
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

    function setLoginButtonState(button, disabled, fallbackLabel) {
        if (!button) {
            return;
        }

        if (!button.dataset.defaultHtml) {
            button.dataset.defaultHtml = button.innerHTML;
        }

        button.disabled = Boolean(disabled);

        if (disabled) {
            button.innerHTML = button.dataset.loadingHtml || fallbackLabel || button.dataset.defaultHtml;
            return;
        }

        button.innerHTML = button.dataset.defaultHtml;
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
        window.location.href = toPageUrl(LOGIN_PATH);
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

        const expectedId = String(config.adminId || "Vinayak_admin");
        const expectedPassword = String(config.adminPassword || "Vinayak@8209");

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
        const isLoggedIn = window.localStorage.getItem("loggedIn");

        if (
            isLoggedIn !== "true" ||
            !session.studentId ||
            !session.password ||
            !session.sessionId ||
            !localSessionId ||
            !localStudentId
        ) {
            return null;
        }

        const { data, error } = await getClient()
            .from(getStudentsTableName())
            .select("*")
            .eq(getStudentIdentifierColumn(), session.studentId)
            .eq("password", session.password)
            .limit(1);

        if (error) {
            console.error("Session validation failed", error);
            return null;
        }

        if (!data || !data.length) {
            return null;
        }

        let student = await syncStudentFeesStatus(data[0], getClient());
        student = await syncStudentEmiStatus(student, getClient());
        const dbStudentId = getStudentIdentifierValue(student);

        if (
            String(student.session_id || "") !== String(localSessionId) ||
            String(session.sessionId || "") !== String(localSessionId) ||
            String(dbStudentId || "") !== String(localStudentId)
        ) {
            return { invalidSession: true };
        }

        if (isStudentBlocked(student)) {
            return {
                blocked: true,
                session: refreshSession(buildStudentSession(
                    student,
                    session.password,
                    student.session_id || localSessionId,
                    session.createdAt || now()
                ))
            };
        }

        return refreshSession(buildStudentSession(
            student,
            session.password,
            student.session_id || localSessionId,
            session.createdAt || now()
        ));
    }

    async function getValidatedSession() {
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
                await forceStudentLogout("Session expired. Logged in from another device.");
                return null;
            }
            if (validatedStudentSession && validatedStudentSession.blocked) {
                return validatedStudentSession;
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

        setLoginButtonState(submitButton, true, "Logging in...");

        try {
            const client = getClient();
            const sessionId = Date.now().toString();
            const { data, error } = await client
                .from(getStudentsTableName())
                .select("*")
                .eq(getStudentIdentifierColumn(), studentId)
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

            let student = await syncStudentFeesStatus(data[0], client);
            student = await syncStudentEmiStatus(student, client);

            const { error: sessionError } = await client
                .from(getStudentsTableName())
                .update({ session_id: sessionId })
                .eq(getStudentIdentifierColumn(), studentId);

            if (sessionError) {
                console.error("Session update failed", sessionError);
                showMessage("Database error. Could not start student session.", "error", "studentAuthMessage");
                return;
            }

            clearSession();
            startStudentSession(student, password, sessionId);

            if (isStudentBlocked(student)) {
                window.location.href = getBlockedRedirectUrl(getPostLoginRedirect());
                return;
            }

            window.location.href = toPageUrl(getPostLoginRedirect());
        } catch (error) {
            console.error("Student login failed", error);
            showMessage(error.message || "Login failed.", "error", "studentAuthMessage");
        } finally {
            setLoginButtonState(submitButton, false);
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

        setLoginButtonState(submitButton, true, "Checking...");

        try {
            const expectedId = String(config.adminId || "Vinayak_admin");
            const expectedPassword = String(config.adminPassword || "Vinayak@8209");

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
            setLoginButtonState(submitButton, false);
        }
    }

    async function initProtectedPage(options) {
        const settings = options || {};
        console.log("CONFIG:", getConfig());

        if (!isConfigured()) {
            renderConfigError();
            return null;
        }

        if (!settings.adminOnly && window.localStorage.getItem("loggedIn") !== "true") {
            clearSession();
            window.location.href = getLoginRedirectUrl();
            return null;
        }

        const session = await getValidatedSession();
        if (!session) {
            clearSession();
            window.location.href = getLoginRedirectUrl();
            return null;
        }

        if (session.blocked) {
            window.location.href = getBlockedRedirectUrl();
            return null;
        }

        if (settings.adminOnly && session.role !== "admin") {
            clearSession();
            window.location.href = getLoginRedirectUrl();
            return null;
        }

        if (settings.requiredCourse && !hasCourseAccess(settings.requiredCourse, session.courses || session.course)) {
            window.location.href = toPageUrl(getHomePath());
            return null;
        }

        clearFallbackMessage();
        ensureLogoutButton();
        showBody();
        return session;
    }

    async function initBlockedPage() {
        console.log("CONFIG:", getConfig());

        if (!isConfigured()) {
            renderConfigError();
            return null;
        }

        const session = await getValidatedSession();
        if (!session) {
            clearSession();
            window.location.href = getLoginRedirectUrl();
            return null;
        }

        if (session.blocked) {
            const blockedSession = session.session;
            const studentIdBox = document.getElementById("blockedStudentId");
            const dueDateBox = document.getElementById("blockedDueDate");
            const noteBox = document.getElementById("blockedPaymentNote");
            const statusBox = document.getElementById("blockedStatusMessage");
            const refreshButton = document.getElementById("refreshStatusBtn");

            if (studentIdBox) {
                studentIdBox.textContent = blockedSession.studentId || "-";
            }

            if (dueDateBox) {
                dueDateBox.textContent = blockedSession.dueDate || "-";
            }

            if (noteBox) {
                noteBox.textContent = blockedSession.paymentNote || "No additional payment note from the admin.";
            }

            if (refreshButton) {
                refreshButton.addEventListener("click", async function () {
                    if (statusBox) {
                        statusBox.hidden = false;
                        statusBox.textContent = "Checking payment status...";
                        statusBox.className = "auth-message";
                    }

                    refreshButton.disabled = true;

                    try {
                        const refreshedSession = await getValidatedSession();

                        if (!refreshedSession) {
                            clearSession();
                            window.location.href = getLoginRedirectUrl();
                            return;
                        }

                        if (!refreshedSession.blocked) {
                            window.location.href = toPageUrl(getHomePath());
                            return;
                        }

                        const refreshedBlockedSession = refreshedSession.session;

                        if (dueDateBox) {
                            dueDateBox.textContent = refreshedBlockedSession.dueDate || "-";
                        }

                        if (noteBox) {
                            noteBox.textContent = refreshedBlockedSession.paymentNote || "No additional payment note from the admin.";
                        }

                        if (statusBox) {
                            statusBox.hidden = false;
                            statusBox.textContent = "Fees are still pending. Please complete payment and try again.";
                            statusBox.className = "auth-message error";
                        }
                    } catch (error) {
                        console.error("Blocked status refresh failed", error);
                        if (statusBox) {
                            statusBox.hidden = false;
                            statusBox.textContent = error.message || "Could not refresh fee status.";
                            statusBox.className = "auth-message error";
                        }
                    } finally {
                        refreshButton.disabled = false;
                    }
                });
            }

            clearFallbackMessage();
            bindLogoutButton();
            showBody();
            return blockedSession;
        }

        if (session.role === "admin") {
            window.location.href = toPageUrl(getAdminPath());
            return session;
        }

        window.location.href = toPageUrl(getPostLoginRedirect());
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
            if (session.blocked) {
                window.location.href = getBlockedRedirectUrl();
                return;
            }

            if (session.role === "admin") {
                window.location.href = toPageUrl(getAdminPath());
                return;
            }

            window.location.href = toPageUrl(getPostLoginRedirect());
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

    window.VinayakAuth = window.VinayakAuth || {};
    Object.assign(window.VinayakAuth, {
        clearSession: clearSession,
        getClient: getClient,
        getStoredCourses: getStoredCourses,
        getStoredCourse: getStoredCourse,
        getStoredStudentId: getStoredStudentId,
        getStoredStudentSessionId: getStoredStudentSessionId,
        getStudentIdentifierColumn: getStudentIdentifierColumn,
        getStudentsTableName: getStudentsTableName,
        getValidatedSession: getValidatedSession,
        hasCourseAccess: hasCourseAccess,
        initBlockedPage: initBlockedPage,
        initLoginPage: initLoginPage,
        initProtectedPage: initProtectedPage,
        logoutAndRedirect: logoutAndRedirect,
        normalizeCourseValue: normalizeCourseValue,
        normalizeDateValue: normalizeDateValue,
        normalizeFeesStatus: normalizeFeesStatus,
        normalizeSingleCourse: normalizeSingleCourse,
        showMessage: showMessage
    });
}());
