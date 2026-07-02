(function () {
    function escapeAttribute(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function openExternalLink(link) {
        window.open(link, "_blank", "noopener,noreferrer");
    }

    function showComingSoon(message) {
        window.alert(message);
    }

    function flattenTopics(notesData) {
        return notesData.reduce(function (all, subject) {
            return all.concat((subject.topics || []).map(function (topic, index) {
                return {
                    subject: subject.name,
                    subjectKey: subject.courseKey || subject.name,
                    title: topic.name,
                    link: topic.link,
                    pinned: index === 0,
                    type: /assignment/i.test(topic.name) ? "Assignment" : "Notes"
                };
            }));
        }, []);
    }

    function applyCourseVisibility(notesData, subjectsGrid) {
        if (!window.VinayakAuth || typeof window.VinayakAuth.getStoredCourses !== "function") {
            return;
        }

        const allowedCourse = window.VinayakAuth.getStoredCourse();

        notesData.forEach(function (subject) {
            if (!subject.cardId || !subject.courseKey) {
                return;
            }

            const card = document.getElementById(subject.cardId);
            if (!card) {
                return;
            }

            if (window.VinayakAuth.normalizeSingleCourse(subject.courseKey) !== allowedCourse) {
                card.style.display = "none";
            }
        });

        const visibleCards = subjectsGrid.querySelectorAll('.subject-card:not([style*="display: none"])');
        if (!visibleCards.length) {
            subjectsGrid.innerHTML = [
                '<section class="resource-placeholder">',
                "<h2>No courses assigned</h2>",
                "<p>Your account does not have any course access yet. Please contact the admin.</p>",
                "</section>"
            ].join("");
        }
    }

    function initNotesPage(options) {
        const settings = options || {};
        const notesData = Array.isArray(settings.notesData) ? settings.notesData : [];
        const subjectsGrid = document.getElementById(settings.gridId);
        const modal = document.getElementById(settings.modalId);
        const modalTitle = document.getElementById(settings.modalTitleId);
        const topicsContainer = document.getElementById(settings.topicsContainerId);
        const closeBtn = modal ? modal.querySelector(".close") : null;
        const comingSoonMessage = settings.comingSoonMessage || "Content will be available soon";
        const flatTopics = flattenTopics(notesData);
        let currentFilter = "all";
        let currentQuery = "";

        if (!subjectsGrid || !modal || !modalTitle || !topicsContainer || !closeBtn) {
            return;
        }

        function ensureToolbar() {
            if (document.querySelector(".student-notes-toolbar")) {
                return;
            }
            const toolbar = document.createElement("section");
            toolbar.className = "student-notes-toolbar";
            toolbar.innerHTML = [
                '<div class="student-notes-search"><i class="fas fa-magnifying-glass"></i><input type="search" id="notesSearchInput" placeholder="Search notes, subjects, assignments"></div>',
                '<div class="student-notes-filter"><label for="notesSubjectFilter">Subject</label><select id="notesSubjectFilter"><option value="all">All Subjects</option>',
                notesData.map(function (subject) {
                    return '<option value="' + escapeAttribute(subject.name) + '">' + escapeAttribute(subject.name) + '</option>';
                }).join(""),
                '</select></div>'
            ].join("");
            subjectsGrid.parentNode.insertBefore(toolbar, subjectsGrid);
        }

        function ensureBoards() {
            if (document.querySelector(".student-notes-boards")) {
                return;
            }
            const boards = document.createElement("section");
            boards.className = "student-notes-boards";
            boards.innerHTML = [
                '<article class="student-panel"><div class="student-section-head slim"><div><h2>Recent Notes</h2><span>Fresh study items for quick access.</span></div></div><div class="student-notes-list" id="recentNotesBoard"></div></article>',
                '<article class="student-panel"><div class="student-section-head slim"><div><h2>Pinned Notes</h2><span>Most useful material kept on top.</span></div></div><div class="student-notes-list" id="pinnedNotesBoard"></div></article>',
                '<article class="student-panel"><div class="student-section-head slim"><div><h2>Latest Uploads</h2><span>Newest material arranged by topic.</span></div></div><div class="student-notes-list" id="latestNotesBoard"></div></article>',
                '<article class="student-panel"><div class="student-section-head slim"><div><h2>Continue Reading</h2><span>Jump back into your current material.</span></div></div><div class="student-notes-list" id="continueNotesBoard"></div></article>'
            ].join("");
            subjectsGrid.insertAdjacentElement("afterend", boards);
        }

        function renderNoteBoard(targetId, items, emptyMessage) {
            const target = document.getElementById(targetId);
            if (!target) {
                return;
            }
            target.innerHTML = items.length ? items.map(function (item) {
                return [
                    '<button type="button" class="student-note-chip" data-note-link="', escapeAttribute(item.link), '">',
                    '<span class="student-note-chip-top">', escapeAttribute(item.subject), '</span>',
                    '<strong>', escapeAttribute(item.title), '</strong>',
                    '<small>', escapeAttribute(item.type), '</small>',
                    '</button>'
                ].join("");
            }).join("") : '<div class="student-empty">' + escapeAttribute(emptyMessage) + '</div>';
        }

        function getFilteredSubjects() {
            return notesData.filter(function (subject) {
                if (currentFilter !== "all" && subject.name !== currentFilter) {
                    return false;
                }
                if (!currentQuery) {
                    return true;
                }
                const haystack = [subject.name, subject.description].concat((subject.topics || []).map(function (topic) { return topic.name; })).join(" ").toLowerCase();
                return haystack.includes(currentQuery);
            });
        }

        function syncBoards() {
            const filteredTopics = flatTopics.filter(function (item) {
                const matchesFilter = currentFilter === "all" || item.subject === currentFilter;
                const matchesSearch = !currentQuery || [item.subject, item.title, item.type].join(" ").toLowerCase().includes(currentQuery);
                return matchesFilter && matchesSearch;
            });
            renderNoteBoard("recentNotesBoard", filteredTopics.slice(0, 4), "No recent notes found.");
            renderNoteBoard("pinnedNotesBoard", filteredTopics.filter(function (item) { return item.pinned; }).slice(0, 4), "No pinned notes yet.");
            renderNoteBoard("latestNotesBoard", filteredTopics.slice().reverse().slice(0, 4), "No latest uploads yet.");
            renderNoteBoard("continueNotesBoard", filteredTopics.slice(0, 4), "No reading history yet.");
        }

        function closeModal() {
            modal.classList.remove("show");
            document.body.style.overflow = "";
        }

        function openPDF(link) {
            if (!link || link.includes("YOUR_FILE_ID")) {
                showComingSoon(comingSoonMessage);
                return;
            }

            openExternalLink(link);
        }

        function openModal(subject) {
            modalTitle.textContent = subject.name;
            topicsContainer.innerHTML = "";

            subject.topics.forEach(function (topic) {
                const topicItem = document.createElement("div");
                const topicButtonMarkup = subject.linkLabel || "View PDF";
                topicItem.className = "topic-item";
                topicItem.innerHTML = [
                    '<span class="topic-name">',
                    escapeAttribute(topic.name),
                    "</span>",
                    '<button class="pdf-btn" type="button" data-topic-link="',
                    escapeAttribute(topic.link),
                    '"><i class="fas fa-file-pdf"></i> ',
                    escapeAttribute(topicButtonMarkup),
                    "</button>"
                ].join("");
                topicsContainer.appendChild(topicItem);
            });

            modal.classList.add("show");
            document.body.style.overflow = "hidden";
        }

        function renderSubjects() {
            const visibleSubjects = getFilteredSubjects();
            subjectsGrid.innerHTML = "";
            if (!visibleSubjects.length) {
                subjectsGrid.innerHTML = '<section class="resource-placeholder"><h2>No matching notes found</h2><p>Try a different keyword or subject filter.</p></section>';
                syncBoards();
                return;
            }

            visibleSubjects.forEach(function (subject) {
                const subjectCard = document.createElement("div");
                subjectCard.className = "subject-card";
                if (subject.cardId) {
                    subjectCard.id = subject.cardId;
                }

                if (subject.courseKey) {
                    subjectCard.setAttribute("data-course-key", subject.courseKey);
                }

                subjectCard.innerHTML = [
                    '<div class="subject-icon"><i class="',
                    escapeAttribute(subject.icon),
                    '"></i></div><h2>',
                    escapeAttribute(subject.name),
                    "</h2><p>",
                    escapeAttribute(subject.description),
                    '</p><span class="topic-count">',
                    String(subject.topics.length),
                    ' topics</span><button type="button" class="course-continue-btn">Continue</button>'
                ].join("");

                subjectCard.addEventListener("click", function () {
                    if (subject.protected && subject.topics[0] && subject.topics[0].link) {
                        window.location.href = subject.topics[0].link;
                        return;
                    }

                    openModal(subject);
                });

                subjectsGrid.appendChild(subjectCard);
            });

            applyCourseVisibility(visibleSubjects, subjectsGrid);
            syncBoards();
        }

        closeBtn.addEventListener("click", closeModal);
        modal.addEventListener("click", function (event) {
            if (event.target === modal) {
                closeModal();
            }
        });

        topicsContainer.addEventListener("click", function (event) {
            const button = event.target.closest("[data-topic-link]");
            if (!button) {
                return;
            }

            openPDF(button.getAttribute("data-topic-link"));
        });

        document.addEventListener("click", function (event) {
            const button = event.target.closest("[data-note-link]");
            if (!button) {
                return;
            }
            openPDF(button.getAttribute("data-note-link"));
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && modal.classList.contains("show")) {
                closeModal();
            }
        });

        ensureToolbar();
        ensureBoards();
        renderSubjects();

        const searchInput = document.getElementById("notesSearchInput");
        const subjectFilter = document.getElementById("notesSubjectFilter");
        if (searchInput) {
            searchInput.addEventListener("input", function () {
                currentQuery = String(searchInput.value || "").trim().toLowerCase();
                renderSubjects();
            });
        }
        if (subjectFilter) {
            subjectFilter.addEventListener("change", function () {
                currentFilter = subjectFilter.value || "all";
                renderSubjects();
            });
        }
    }

    window.VinayakNotesPage = {
        initNotesPage: initNotesPage
    };
}());
