(function () {
    const READ_PREFIX = "vinayak_announcement_reads_";

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getSession() {
        try {
            return JSON.parse(window.localStorage.getItem("student_session") || "null") || {};
        } catch (error) {
            return {};
        }
    }

    function getStudentId() {
        const session = getSession();
        return session.studentId || (window.VinayakAuth && window.VinayakAuth.getStoredStudentId ? window.VinayakAuth.getStoredStudentId() : "") || "student";
    }

    function readKey() {
        return READ_PREFIX + getStudentId();
    }

    function getReadIds() {
        try {
            return JSON.parse(window.localStorage.getItem(readKey()) || "[]").map(String);
        } catch (error) {
            return [];
        }
    }

    function saveReadIds(ids) {
        window.localStorage.setItem(readKey(), JSON.stringify(Array.from(new Set(ids.map(String)))));
    }

    function getTitle(item) {
        return String((item && (item.title || item.heading)) || "Announcement");
    }

    function getContent(item) {
        return String((item && (item.content || item.message || item.description)) || "");
    }

    function stripHtml(value) {
        const div = document.createElement("div");
        div.innerHTML = String(value || "");
        return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
    }

    function getCourseTargets(item) {
        const raw = item && (item.target_courses || item.course_ids || item.courses || item.course_id);
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
        if (typeof raw === "string") {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
            } catch (error) {}
            return raw.split(",").map(function (entry) { return entry.trim(); }).filter(Boolean);
        }
        return [String(raw)];
    }

    function isAllCourses(item) {
        return Boolean(item && (item.all_courses === true || item.all_courses === "true" || item.target === "all" || item.audience === "all"));
    }

    function isExpired(item) {
        if (!item || !item.expires_at) return false;
        const expiry = new Date(String(item.expires_at).slice(0, 10) + "T23:59:59").getTime();
        return Number.isFinite(expiry) && expiry < Date.now();
    }

    async function resolveStudentCourseKeys() {
        const session = getSession();
        const courseName = window.VinayakAuth && window.VinayakAuth.normalizeSingleCourse
            ? window.VinayakAuth.normalizeSingleCourse(session.course || window.VinayakAuth.getStoredCourse())
            : String(session.course || window.localStorage.getItem("course") || "").trim().toUpperCase();
        const keys = [courseName].filter(Boolean);
        if (!courseName || !window.VinayakAuth) return keys;
        try {
            const { data, error } = await window.VinayakAuth.getClient()
                .from("courses")
                .select("id, course_name")
                .limit(500);
            if (error) throw error;
            const course = (data || []).find(function (row) {
                return String(row.id || "").trim().toUpperCase() === courseName ||
                    String(row.course_name || "").trim().toUpperCase() === courseName;
            });
            if (course) {
                if (course.id) keys.push(String(course.id));
                if (course.course_name) keys.push(String(course.course_name).trim().toUpperCase());
            }
        } catch (error) {
            console.warn("Announcement course lookup failed", error);
        }
        return Array.from(new Set(keys.map(String).filter(Boolean)));
    }

    function matchesStudentCourse(item, courseKeys) {
        if (isAllCourses(item)) return true;
        const keys = courseKeys.map(function (key) { return String(key).trim().toUpperCase(); });
        return getCourseTargets(item).some(function (target) {
            const normalized = String(target).trim().toUpperCase();
            return keys.includes(normalized);
        });
    }

    async function fetchVisibleAnnouncements(limit) {
        if (!window.VinayakAuth) return [];
        try {
            const courseKeys = await resolveStudentCourseKeys();
            const { data, error } = await window.VinayakAuth.getClient()
                .from("announcements")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            const rows = (data || []).filter(function (item) {
                return !isExpired(item) && matchesStudentCourse(item, courseKeys);
            }).sort(function (a, b) {
                const pinnedDiff = Number(Boolean(b.is_pinned || b.pinned)) - Number(Boolean(a.is_pinned || a.pinned));
                if (pinnedDiff) return pinnedDiff;
                return String(b.created_at || "").localeCompare(String(a.created_at || ""));
            });
            return limit ? rows.slice(0, limit) : rows;
        } catch (error) {
            console.warn("Announcement fetch failed", error);
            return [];
        }
    }

    function getUnreadCount(items) {
        const read = getReadIds();
        return (items || []).filter(function (item) {
            return item && item.id != null && !read.includes(String(item.id));
        }).length;
    }

    function setBadges(count) {
        document.querySelectorAll("[data-layout-notification-count], #notificationCount").forEach(function (node) {
            node.textContent = String(count);
            node.hidden = count <= 0;
        });
    }

    function markRead(item) {
        if (!item || item.id == null) return;
        const ids = getReadIds();
        if (!ids.includes(String(item.id))) {
            ids.push(String(item.id));
            saveReadIds(ids);
        }
    }

    function openDetail(item) {
        markRead(item);
        updateBell();
        let modal = document.getElementById("announcementDetailModal");
        if (!modal) {
            modal = document.createElement("section");
            modal.id = "announcementDetailModal";
            modal.className = "announcement-detail-modal";
            modal.innerHTML = '<article><button type="button" data-close-announcement-detail>&times;</button><h2></h2><small></small><div></div></article>';
            document.body.appendChild(modal);
            modal.addEventListener("click", function (event) {
                if (event.target === modal || event.target.closest("[data-close-announcement-detail]")) {
                    modal.hidden = true;
                }
            });
        }
        modal.querySelector("h2").textContent = getTitle(item);
        modal.querySelector("small").textContent = item.created_at ? new Date(item.created_at).toLocaleString("en-IN") : "Announcement";
        modal.querySelector("div").innerHTML = getContent(item);
        modal.hidden = false;
    }

    function renderPreview(targetId, items, limit) {
        const target = document.getElementById(targetId);
        if (!target) return;
        const rows = (items || []).slice(0, limit || 5);
        target.innerHTML = rows.length ? rows.map(function (item) {
            return '<button type="button" class="student-list-item student-list-button announcement-card' + ((item.is_pinned || item.pinned) ? " is-pinned" : "") + '" data-announcement-id="' + escapeHtml(item.id) + '"><i class="fas fa-bullhorn"></i><span><strong>' + escapeHtml(getTitle(item)) + '</strong><small>' + escapeHtml(stripHtml(getContent(item)).slice(0, 120) || "New announcement") + '</small></span></button>';
        }).join("") : '<div class="student-empty">No announcements yet.</div>';
        bindAnnouncementCards(target, rows);
    }

    function renderPage(targetId, items) {
        renderPreview(targetId, items, items.length || 999);
    }

    function bindAnnouncementCards(root, items) {
        root.querySelectorAll("[data-announcement-id]").forEach(function (button) {
            button.addEventListener("click", function () {
                const id = button.getAttribute("data-announcement-id");
                const item = items.find(function (row) { return String(row.id) === String(id); });
                if (item) openDetail(item);
            });
        });
    }

    function ensureDropdown(button) {
        let dropdown = document.getElementById("studentNotificationDropdown");
        if (dropdown) return dropdown;
        dropdown = document.createElement("div");
        dropdown.id = "studentNotificationDropdown";
        dropdown.className = "student-notification-dropdown";
        dropdown.hidden = true;
        dropdown.innerHTML = '<div class="student-notification-head"><strong>Announcements</strong><a href="notices.html">View All</a></div><div data-notification-preview></div>';
        button.parentElement.appendChild(dropdown);
        return dropdown;
    }

    async function updateBell() {
        const items = await fetchVisibleAnnouncements();
        setBadges(getUnreadCount(items));
        const dropdown = document.getElementById("studentNotificationDropdown");
        if (dropdown) {
            renderPreviewList(dropdown.querySelector("[data-notification-preview]"), items.slice(0, 5));
        }
        return items;
    }

    function renderPreviewList(target, items) {
        if (!target) return;
        target.innerHTML = items.length ? items.map(function (item) {
            return '<button type="button" data-announcement-id="' + escapeHtml(item.id) + '"><strong>' + escapeHtml(getTitle(item)) + '</strong><small>' + escapeHtml(stripHtml(getContent(item)).slice(0, 80)) + '</small></button>';
        }).join("") : '<p>No announcements yet.</p>';
        bindAnnouncementCards(target, items);
    }

    function initBell() {
        const button = document.querySelector(".student-icon-btn");
        if (!button || button.dataset.announcementBellBound) return;
        button.dataset.announcementBellBound = "true";
        const dropdown = ensureDropdown(button);
        button.addEventListener("click", async function (event) {
            event.stopPropagation();
            const items = await fetchVisibleAnnouncements();
            renderPreviewList(dropdown.querySelector("[data-notification-preview]"), items.slice(0, 5));
            dropdown.hidden = !dropdown.hidden;
        });
        document.addEventListener("click", function (event) {
            if (!event.target.closest(".student-top-actions")) dropdown.hidden = true;
        });
        updateBell();
    }

    window.VinayakAnnouncements = {
        fetchVisibleAnnouncements: fetchVisibleAnnouncements,
        getUnreadCount: getUnreadCount,
        initBell: initBell,
        markRead: markRead,
        openDetail: openDetail,
        renderPage: renderPage,
        renderPreview: renderPreview,
        updateBell: updateBell
    };
}());
