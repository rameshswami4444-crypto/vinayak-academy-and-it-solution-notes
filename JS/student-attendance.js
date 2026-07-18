(function () {
    if (window.__vinayakStudentAttendanceLoaded) return;
    window.__vinayakStudentAttendanceLoaded = true;

    const POLL_MS = 5000;
    const POPUP_POLL_MS = 5000;
    let activeSessionId = "";
    let popupOpen = false;
    let initialCheckDone = false;
    let pollTimer = null;
    let popupPollTimer = null;
    let countdownTimer = null;
    let activeEndTime = "";
    let watcherStarted = false;
    function apiUrl(path) {
        if (window.VinayakApi) return window.VinayakApi.url(path);
        return String(window.API_BASE_URL || window.VINAYAK_API_BASE || "").replace(/\/+$/, "") + path;
    }

    function getSession() {
        try {
            return JSON.parse(window.localStorage.getItem("student_session") || window.localStorage.getItem("vinayak_session") || "null") || {};
        } catch (error) {
            return {};
        }
    }

    function getStudentId() {
        const session = getSession();
        return session.studentId || (window.VinayakAuth && window.VinayakAuth.getStoredStudentId ? window.VinayakAuth.getStoredStudentId() : "") || window.localStorage.getItem("studentId") || "";
    }

    function getSessionToken() {
        const session = getSession();
        return session.session_token || session.sessionId || (window.VinayakAuth && window.VinayakAuth.getStoredStudentSessionId ? window.VinayakAuth.getStoredStudentSessionId() : "") || window.localStorage.getItem("session_token") || window.localStorage.getItem("sessionId") || "";
    }

    function getHeaders() {
        return {
            "Content-Type": "application/json",
            "X-Student-Id": getStudentId(),
            "X-Session-Token": getSessionToken()
        };
    }

    async function api(path, options) {
        const url = apiUrl(path);
        console.log("Student attendance API URL", url);
        const response = await window.fetch(url, Object.assign({
            headers: getHeaders()
        }, options || {}));
        const payload = await response.json().catch(function () { return {}; });
        if (!response.ok || payload.success === false) {
            const error = new Error(payload.message || payload.error || "Attendance request failed.");
            error.payload = payload;
            throw error;
        }
        return payload;
    }

    function logAttendanceDebug(label, payload) {
        const debug = payload && payload.debug ? payload.debug : {};
        console.group(label);
        console.log("Logged-in student ID:", getStudentId());
        console.log("Student course_id:", debug.student_course_id || "(not returned)");
        console.log("Attendance query:", debug.attendance_query || {
            table: "attendance_sessions",
            status: "OPEN",
            course_id: debug.student_course_id || "",
            start_time: "<= now",
            end_time: ">= now"
        });
        console.log("Number of sessions found:", debug.sessions_found == null ? 0 : debug.sessions_found);
        console.log("Supabase errors:", debug.supabase_error || null);
        console.groupEnd();
    }

    function formatClock(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;
        return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    }

    function getRemainingSeconds(endTime) {
        if (!endTime) return 0;
        return Math.max(0, Math.ceil((new Date(endTime).getTime() - Date.now()) / 1000));
    }

    function ensurePopup() {
        let modal = document.getElementById("studentAttendanceModal");
        if (modal) return modal;
        modal = document.createElement("section");
        modal.id = "studentAttendanceModal";
        modal.className = "student-attendance-modal";
        modal.hidden = true;
        modal.innerHTML = [
            '<article class="student-attendance-dialog">',
            '<div class="student-attendance-head"><div><p class="login-badge">Attendance Required</p><h2>Mark Your Attendance</h2></div><strong data-attendance-countdown>00:00</strong></div>',
            '<div class="student-attendance-details">',
            '<p><span>Subject</span><strong data-attendance-subject>-</strong></p>',
            '<p><span>Lecture Title</span><strong data-attendance-title>-</strong></p>',
            '<p><span>Teacher</span><strong data-attendance-teacher>-</strong></p>',
            '</div>',
            '<form data-attendance-form>',
            '<p class="student-attendance-question">Mark your attendance.</p>',
            '<label class="student-attendance-option"><input type="radio" name="attendanceResponse" value="PRESENT" required><span>Present</span></label>',
            '<label class="student-attendance-option"><input type="radio" name="attendanceResponse" value="ABSENT" required><span>Absent</span></label>',
            '<button type="submit" class="login-btn">Submit</button>',
            '</form>',
            '<p class="student-attendance-message" data-attendance-message hidden></p>',
            '</article>'
        ].join("");
        document.body.appendChild(modal);
        const title = modal.querySelector(".student-attendance-head h2");
        if (title) title.textContent = "\uD83D\uDCDA Mark Your Attendance";
        modal.querySelector("[data-attendance-form]").addEventListener("submit", submitAttendance);
        return modal;
    }

    function setModalText(selector, value) {
        const modal = ensurePopup();
        const node = modal.querySelector(selector);
        if (node) node.textContent = value == null || value === "" ? "-" : String(value);
    }

    function showMessage(message, type) {
        const modal = ensurePopup();
        const node = modal.querySelector("[data-attendance-message]");
        if (!node) return;
        node.hidden = false;
        node.textContent = message;
        node.className = "student-attendance-message " + (type || "success");
    }

    function showSuccessNotice(message) {
        let notice = document.getElementById("studentAttendanceSuccessNotice");
        if (!notice) {
            notice = document.createElement("div");
            notice.id = "studentAttendanceSuccessNotice";
            notice.className = "student-attendance-success";
            document.body.appendChild(notice);
        }
        notice.textContent = message || "Attendance Submitted Successfully";
        notice.hidden = false;
        window.setTimeout(function () {
            notice.hidden = true;
        }, 2400);
    }

    function startCountdown(endTime) {
        activeEndTime = endTime || "";
        if (countdownTimer) window.clearInterval(countdownTimer);
        function tick() {
            setModalText("[data-attendance-countdown]", formatClock(getRemainingSeconds(activeEndTime)));
        }
        tick();
        countdownTimer = window.setInterval(tick, 1000);
    }

    function stopCountdown() {
        if (countdownTimer) {
            window.clearInterval(countdownTimer);
            countdownTimer = null;
        }
        activeEndTime = "";
    }

    function showAttendancePopup(payload) {
        const session = payload.session || {};
        activeSessionId = session.id || "";
        popupOpen = true;
        const modal = ensurePopup();
        modal.hidden = false;
        document.body.classList.add("student-attendance-locked");
        const form = modal.querySelector("[data-attendance-form]");
        if (form) form.hidden = Boolean(payload.already_submitted);
        setModalText("[data-attendance-subject]", session.subject || "-");
        setModalText("[data-attendance-title]", session.lecture_title || "-");
        setModalText("[data-attendance-teacher]", session.created_by || "Teacher");
        showMessage("", "success");
        const message = modal.querySelector("[data-attendance-message]");
        if (message) message.hidden = true;
        if (payload.already_submitted) {
            showMessage("Attendance Submitted", "success");
        }
        console.log("showAttendancePopup called", {
            sessionId: activeSessionId,
            courseId: session.course_id,
            subject: session.subject,
            lectureTitle: session.lecture_title
        });
        startCountdown(session.end_time);
        startPopupPolling();
    }

    function hidePopup() {
        const modal = ensurePopup();
        modal.hidden = true;
        document.body.classList.remove("student-attendance-locked");
        popupOpen = false;
        activeSessionId = "";
        stopCountdown();
        stopPopupPolling();
    }

    async function checkActiveAttendance(forcePopup) {
        if (!getStudentId() || !getSessionToken()) return null;
        try {
            const payload = await api("/api/student/attendance/active");
            logAttendanceDebug("Student attendance active check", payload);
            if (!payload.active) {
                if (popupOpen) {
                    hidePopup();
                }
                activeSessionId = "";
                initialCheckDone = true;
                return payload;
            }
            if (payload.response && String(payload.response.response || "").toUpperCase() !== "WAITING") {
                if (popupOpen) {
                    showMessage("Attendance Submitted", "success");
                    window.setTimeout(hidePopup, 1200);
                } else if (forcePopup || !initialCheckDone) {
                    showAttendancePopup(Object.assign({}, payload, { already_submitted: true }));
                    window.setTimeout(hidePopup, 1400);
                }
                initialCheckDone = true;
                return payload;
            }
            if (!payload.can_respond) {
                initialCheckDone = true;
                return payload;
            }
            const incomingSessionId = payload.session && payload.session.id;
            if (forcePopup || !initialCheckDone) {
                showAttendancePopup(payload);
            } else if (incomingSessionId && incomingSessionId !== activeSessionId && !popupOpen) {
                showAttendancePopup(payload);
            }
            initialCheckDone = true;
            return payload;
        } catch (error) {
            logAttendanceDebug("Student attendance active check failed", {
                debug: {
                    student_course_id: "",
                    attendance_query: {
                        table: "attendance_sessions",
                        status: "OPEN",
                        start_time: "<= now",
                        end_time: ">= now"
                    },
                    sessions_found: 0,
                    supabase_error: error.payload || error.message || error
                }
            });
            console.warn("Student attendance active check failed", error);
            initialCheckDone = true;
            return null;
        }
    }

    async function submitAttendance(event) {
        event.preventDefault();
        const modal = ensurePopup();
        const selected = modal.querySelector('input[name="attendanceResponse"]:checked');
        if (!selected || !activeSessionId) {
            showMessage("Choose Present or Absent.", "error");
            return;
        }
        const button = modal.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        try {
            console.log("Attendance submitted", {
                studentId: getStudentId(),
                sessionId: activeSessionId,
                response: selected.value
            });
            const result = await api("/api/student/attendance/respond", {
                method: "POST",
                body: JSON.stringify({ session_id: activeSessionId, response: selected.value })
            });
            console.log("Supabase insert result", result);
            hidePopup();
            showSuccessNotice(result.message === "Attendance Submitted" ? "Attendance Submitted" : "Attendance Submitted Successfully");
        } catch (error) {
            showMessage(error.message || "Could not submit attendance.", "error");
        } finally {
            if (button) button.disabled = false;
        }
    }

    function startPopupPolling() {
        if (document.hidden) return;
        stopPopupPolling();
        popupPollTimer = window.setInterval(function () {
            checkActiveAttendance(false);
        }, POPUP_POLL_MS);
    }

    function stopPopupPolling() {
        if (popupPollTimer) {
            window.clearInterval(popupPollTimer);
            popupPollTimer = null;
        }
    }

    function initWatcher() {
        if (watcherStarted || document.body.classList.contains("admin-page")) return;
        watcherStarted = true;
        window.setTimeout(function () { checkActiveAttendance(false); }, 800);
        if (!document.hidden) {
            pollTimer = window.setInterval(function () { checkActiveAttendance(false); }, POLL_MS);
        }
    }

    function stopWatcherTimers() {
        if (pollTimer) {
            window.clearInterval(pollTimer);
            pollTimer = null;
        }
        stopPopupPolling();
    }

    function handleVisibilityChange() {
        if (!watcherStarted) return;
        if (document.hidden) {
            stopWatcherTimers();
            return;
        }
        checkActiveAttendance(false);
        if (!pollTimer) {
            pollTimer = window.setInterval(function () { checkActiveAttendance(false); }, POLL_MS);
        }
        if (popupOpen) startPopupPolling();
    }

    window.VinayakStudentAttendance = {
        initWatcher: initWatcher,
        showActivePopup: function () { return checkActiveAttendance(true); }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initWatcher);
    } else {
        initWatcher();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", stopWatcherTimers);
}());
