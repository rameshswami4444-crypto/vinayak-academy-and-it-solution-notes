(function () {
    const BUCKET = "study-material";

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
        const { data, error } = await getAuth().getClient()
            .from("courses")
            .select("*");
        if (error) throw error;
        const match = (data || []).find(function (item) {
            return normalizeCourse(getCourseName(item)) === normalized || normalizeCourse(item.code) === normalized;
        });
        return match && match.id ? String(match.id) : "";
    }

    async function fetchCourseNotes(course) {
        const courseId = await resolveCourseId(course);
        if (!courseId) {
            return [];
        }
        const client = getAuth().getClient();
        try {
            const linkResult = await client
                .from("material_courses")
                .select("note_id")
                .eq("course_id", courseId);
            if (linkResult.error) throw linkResult.error;
            const noteIds = Array.from(new Set((linkResult.data || []).map(function (row) {
                return row.note_id;
            }).filter(Boolean)));
            const mappedResult = noteIds.length
                ? await client.from("notes").select("id, course_id, subject, title, created_at, file_path").in("id", noteIds)
                : { data: [], error: null };
            if (mappedResult.error) throw mappedResult.error;
            const legacyResult = await client
                .from("notes")
                .select("id, course_id, subject, title, created_at, file_path")
                .eq("course_id", courseId);
            if (legacyResult.error) throw legacyResult.error;
            const byId = {};
            (mappedResult.data || []).concat(legacyResult.data || []).forEach(function (note) {
                byId[String(note.id)] = note;
            });
            return Object.keys(byId).map(function (id) {
                return byId[id];
            }).sort(function (a, b) {
                return String(b.created_at || "").localeCompare(String(a.created_at || ""));
            });
        } catch (error) {
            console.warn("material_courses lookup failed; using legacy notes.course_id", error);
            const legacy = await client
                .from("notes")
                .select("id, course_id, subject, title, created_at, file_path")
                .eq("course_id", courseId)
                .order("created_at", { ascending: false });
            if (legacy.error) throw legacy.error;
            return legacy.data || [];
        }
    }

    async function createSignedUrl(note) {
        if (!note || !note.file_path) {
            throw new Error("This PDF file is not available.");
        }
        const studentCourseId = await resolveCourseId(getStudentCourse());
        if (!studentCourseId) {
            throw new Error("You do not have access to this course material.");
        }
        let hasAccess = String(note.course_id || "") === studentCourseId;
        if (!hasAccess) {
            try {
                const { data, error } = await getAuth().getClient()
                    .from("material_courses")
                    .select("id")
                    .eq("note_id", note.id)
                    .eq("course_id", studentCourseId)
                    .limit(1);
                if (error) throw error;
                hasAccess = Boolean(data && data.length);
            } catch (error) {
                console.warn("material_courses permission check failed; using legacy course_id only", error);
            }
        }
        if (!hasAccess) {
            throw new Error("You do not have access to this course material.");
        }
        const { data, error } = await getAuth().getClient()
            .storage
            .from(BUCKET)
            .createSignedUrl(note.file_path, 300);
        if (error) throw error;
        if (!data || !data.signedUrl) {
            throw new Error("Could not create a secure PDF link.");
        }
        return data.signedUrl;
    }

    async function fetchNoteById(id) {
        const noteId = String(id || "").trim();
        if (!noteId) {
            throw new Error("PDF record was not found.");
        }
        const { data, error } = await getAuth().getClient()
            .from("notes")
            .select("id, course_id, subject, title, created_at, file_path")
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
        return "pdf-viewer.html?id=" + encodeURIComponent(String(id || ""));
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
                    '<button type="button" class="course-continue-btn" data-open-material-id="', escapeHtml(note.id), '">Open PDF</button>',
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
        window.location.href = getViewerUrl(note);
    }

    function initNotesPage(options) {
        const settings = options || {};
        const grid = document.getElementById(settings.gridId) || document.querySelector("[data-material-grid], .subjects-grid");
        if (!grid || grid.dataset.materialInitialized === "true") return;
        grid.dataset.materialInitialized = "true";

        const state = { subject: "all", query: "", notes: [] };
        renderMessage(grid, "Loading study material", "Fetching secure notes from Supabase Storage.");

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
        createSignedUrl: createSignedUrl,
        getViewerUrl: getViewerUrl,
        openMaterial: openMaterial
    };
}());
