(function () {
    const COURSE_CACHE_TTL_MS = 10 * 60 * 1000;
    const MATERIAL_CACHE_TTL_MS = 2 * 60 * 1000;
    let courseCache = { expiresAt: 0, rows: [] };
    const materialCache = {};

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getAuth() {
        if (!window.VinayakAuth) {
            throw new Error("Session service is not loaded.");
        }
        return window.VinayakAuth;
    }

    function normalizeCourse(value) {
        const auth = getAuth();
        return auth.normalizeSingleCourse ? auth.normalizeSingleCourse(value) : String(value || "").trim().toUpperCase();
    }

    function isUuid(value) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
    }

    function getCourseName(course) {
        return course.course_name || course.name || course.title || course.course || course.code || "";
    }

    function getStudentCourse() {
        const auth = getAuth();
        return normalizeCourse(auth.getStoredCourse ? auth.getStoredCourse() : sessionStorage.getItem("studentCourse"));
    }

    function getApiBase() {
        if (window.VINAYAK_API_BASE) {
            return String(window.VINAYAK_API_BASE).replace(/\/+$/, "");
        }
        const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
        const isStaticDev = ["5500", "5501", "5502"].includes(window.location.port);
        return isLocal && isStaticDev ? "http://localhost:3000" : "";
    }

    function apiUrl(path) {
        return getApiBase() + path;
    }

    function formatDate(value) {
        if (!value) return "Recent";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
        return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }

    async function resolveCourseId(courseValue) {
        const course = String(courseValue || "").trim();
        if (isUuid(course)) {
            return course;
        }
        const normalized = normalizeCourse(course);
        const rows = await fetchCourses();
        const match = rows.find(function (item) {
            return normalizeCourse(getCourseName(item)) === normalized || normalizeCourse(item.code) === normalized;
        });
        return match && match.id ? String(match.id) : "";
    }

    async function fetchCourses() {
        if (courseCache.expiresAt > Date.now()) return courseCache.rows;
        const { data, error } = await getAuth().getClient()
            .from("courses")
            .select("id, course_name")
            .order("course_name", { ascending: true });
        if (error) throw error;
        courseCache = { expiresAt: Date.now() + COURSE_CACHE_TTL_MS, rows: data || [] };
        return courseCache.rows;
    }

    async function fetchCourseNotes(course) {
        const cacheKey = normalizeCourse(course || getStudentCourse()) || "current";
        const cached = materialCache[cacheKey];
        if (cached && cached.expiresAt > Date.now()) {
            return cached.rows;
        }
        const response = await fetch(apiUrl("/api/materials"), {
            method: "GET",
            headers: getStudentAuthHeaders()
        });
        const result = await response.json().catch(function () { return {}; });
        if (!response.ok || !result.success) {
            throw new Error(result.message || result.error || "Could not load study material.");
        }
        const rows = result.materials || [];
        materialCache[cacheKey] = { expiresAt: Date.now() + MATERIAL_CACHE_TTL_MS, rows: rows };
        return rows;
    }

    function getStudentAuthHeaders() {
        const auth = getAuth();
        return {
            "X-Student-Id": auth.getStoredStudentId ? auth.getStoredStudentId() : window.localStorage.getItem("studentId") || "",
            "X-Session-Token": auth.getStoredStudentSessionId ? auth.getStoredStudentSessionId() : window.localStorage.getItem("session_token") || ""
        };
    }

    async function createR2PdfAccess(note) {
        if (!note || !note.id) {
            throw new Error("This PDF file is not available.");
        }
        const endpoint = apiUrl("/api/material/" + encodeURIComponent(note.id));
        console.log("PDF retrieval frontend: requesting material endpoint", {
            materialId: note.id,
            endpoint: endpoint
        });
        const response = await fetch(endpoint, {
            method: "GET",
            headers: getStudentAuthHeaders()
        });
        const result = await response.json().catch(function () { return {}; });
        console.log("PDF retrieval frontend: material endpoint response", {
            materialId: note.id,
            status: response.status,
            success: Boolean(result.success),
            hasUrl: Boolean(result.url || result.signedUrl),
            message: result.message || result.error || ""
        });
        const signedUrl = result.url || result.signedUrl;
        if (!response.ok || !result.success || !signedUrl) {
            const debugDetails = result.details ? " Details: " + JSON.stringify(result.details) : "";
            throw new Error((result.message || result.error || "Could not create a secure PDF link.") + debugDetails);
        }
        return {
            url: signedUrl,
            signedUrl: signedUrl,
            fallbackUrl: result.fallbackUrl ? apiUrl(result.fallbackUrl) : "",
            expiresIn: result.expiresIn,
            expiresAt: result.expiresAt
        };
    }

    async function createR2SignedUrl(note) {
        const access = await createR2PdfAccess(note);
        return access.url;
    }

    async function fetchNoteById(id) {
        const noteId = String(id || "").trim();
        if (!noteId) {
            throw new Error("PDF record was not found.");
        }
        const { data, error } = await getAuth().getClient()
            .from("notes")
            .select("id, course_id, subject, title, created_at")
            .eq("id", noteId)
            .limit(1);
        if (error) throw error;
        if (!data || !data[0]) {
            throw new Error("This PDF is no longer available.");
        }
        return data[0];
    }

    function getViewerUrl(noteOrId) {
        const id = typeof noteOrId === "object" && noteOrId ? noteOrId.id : noteOrId;
        return "#material-" + encodeURIComponent(String(id || ""));
    }

    function renderMessage(target, title, message) {
        target.innerHTML = [
            '<section class="resource-placeholder">',
            '<h2>', escapeHtml(title), '</h2>',
            '<p>', escapeHtml(message), '</p>',
            '</section>'
        ].join("");
    }

    function getSubjects(notes) {
        return Array.from(new Set(notes.map(function (note) {
            return String(note.subject || "General").trim() || "General";
        }))).sort();
    }

    function renderLayout(grid, notes, state) {
        const subjects = getSubjects(notes);
        const query = state.query.toLowerCase();
        const filtered = notes.filter(function (note) {
            const subject = String(note.subject || "General");
            const matchesSubject = state.subject === "all" || subject === state.subject;
            const matchesQuery = !query || [note.title, note.subject, note.created_at].join(" ").toLowerCase().includes(query);
            return matchesSubject && matchesQuery;
        });

        if (!notes.length) {
            renderMessage(grid, "No study material uploaded", "Your course notes will appear here after the admin uploads PDFs.");
            return;
        }

        grid.innerHTML = [
            '<section class="student-material-shell">',
            '<aside class="student-material-subjects">',
            '<button type="button" class="student-material-subject', state.subject === "all" ? " active" : "", '" data-material-subject="all">All Subjects <span>', notes.length, '</span></button>',
            subjects.map(function (subject) {
                const count = notes.filter(function (note) { return String(note.subject || "General") === subject; }).length;
                return '<button type="button" class="student-material-subject' + (state.subject === subject ? " active" : "") + '" data-material-subject="' + escapeHtml(subject) + '">' + escapeHtml(subject) + '<span>' + count + '</span></button>';
            }).join(""),
            '</aside>',
            '<section class="student-material-content">',
            '<div class="student-notes-toolbar">',
            '<div class="student-notes-search"><i class="fas fa-magnifying-glass"></i><input type="search" data-material-search placeholder="Search title or subject" value="', escapeHtml(state.query), '"></div>',
            '<div class="student-notes-filter"><label for="studentMaterialSubjectFilter">Subject</label><select id="studentMaterialSubjectFilter" data-material-filter><option value="all">All Subjects</option>',
            subjects.map(function (subject) {
                return '<option value="' + escapeHtml(subject) + '"' + (state.subject === subject ? " selected" : "") + '>' + escapeHtml(subject) + '</option>';
            }).join(""),
            '</select></div></div>',
            '<div class="student-material-grid">',
            filtered.length ? filtered.map(function (note) {
                return [
                    '<article class="student-material-card" role="button" tabindex="0" data-open-material-id="', escapeHtml(note.id), '">',
                    '<div class="student-material-icon"><i class="fas fa-file-pdf"></i></div>',
                    '<div class="student-material-copy"><span>', escapeHtml(note.subject || "General"), '</span>',
                    '<h3>', escapeHtml(note.title || "Study Material"), '</h3>',
                    '<p>Uploaded ', escapeHtml(formatDate(note.created_at)), '</p></div>',
                   
                    '</article>'
                ].join("");
            }).join("") : '<div class="student-empty">No notes match your search.</div>',
            '</div></section></section>'
        ].join("");
    }

    function openMaterial(note) {
        if (!note || !note.id) {
            window.alert("Could not open this PDF securely.");
            return;
        }
        if (window.VinayakPdfModal && typeof window.VinayakPdfModal.openNote === "function") {
            window.VinayakPdfModal.openNote(note);
            return;
        }
        window.alert("PDF viewer is still loading. Please try again.");
    }

    function initNotesPage(options) {
        const settings = options || {};
        const grid = document.getElementById(settings.gridId) || document.querySelector("[data-material-grid], .subjects-grid");
        if (!grid || grid.dataset.materialInitialized === "true") return;
        grid.dataset.materialInitialized = "true";

        const state = { subject: "all", query: "", notes: [] };
        renderMessage(grid, "Loading study material", "Fetching secure notes from Cloudflare R2.");

        fetchCourseNotes(getStudentCourse()).then(function (notes) {
            state.notes = notes;
            renderLayout(grid, state.notes, state);
        }).catch(function (error) {
            console.error("Study material load failed", error);
            renderMessage(grid, "Could not load study material", error.message || "Please try again after a moment.");
        });

        grid.addEventListener("input", function (event) {
            if (!event.target.matches("[data-material-search]")) return;
            state.query = event.target.value || "";
            renderLayout(grid, state.notes, state);
            const input = grid.querySelector("[data-material-search]");
            if (input) {
                input.focus();
                input.setSelectionRange(state.query.length, state.query.length);
            }
        });
        grid.addEventListener("change", function (event) {
            if (!event.target.matches("[data-material-filter]")) return;
            state.subject = event.target.value || "all";
            renderLayout(grid, state.notes, state);
        });
        grid.addEventListener("click", function (event) {
            const subjectButton = event.target.closest("[data-material-subject]");
            if (subjectButton) {
                state.subject = subjectButton.getAttribute("data-material-subject") || "all";
                renderLayout(grid, state.notes, state);
                return;
            }
            const openButton = event.target.closest("[data-open-material-id]");
            if (!openButton) return;
            if (event.target.closest("button")) {
                event.stopPropagation();
            }
            const note = state.notes.find(function (item) {
                return String(item.id) === String(openButton.getAttribute("data-open-material-id"));
            });
            openMaterial(note);
        });
        grid.addEventListener("keydown", function (event) {
            if (event.key !== "Enter" && event.key !== " ") return;
            const card = event.target.closest(".student-material-card[data-open-material-id]");
            if (!card) return;
            event.preventDefault();
            const note = state.notes.find(function (item) {
                return String(item.id) === String(card.getAttribute("data-open-material-id"));
            });
            openMaterial(note);
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll("[data-material-grid]").forEach(function (grid) {
            initNotesPage({ gridId: grid.id });
        });
    });

    window.VinayakNotesPage = {
        initNotesPage: initNotesPage,
        fetchCourseNotes: fetchCourseNotes,
        resolveCourseId: resolveCourseId,
        fetchNoteById: fetchNoteById,
        getStudentAuthHeaders: getStudentAuthHeaders,
        createR2PdfAccess: createR2PdfAccess,
        createR2SignedUrl: createR2SignedUrl,
        fetchCourses: fetchCourses,
        getViewerUrl: getViewerUrl,
        openMaterial: openMaterial
    };
}());
