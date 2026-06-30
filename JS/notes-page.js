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

        if (!subjectsGrid || !modal || !modalTitle || !topicsContainer || !closeBtn) {
            return;
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
            subjectsGrid.innerHTML = "";

            notesData.forEach(function (subject) {
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

            applyCourseVisibility(notesData, subjectsGrid);
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

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && modal.classList.contains("show")) {
                closeModal();
            }
        });

        renderSubjects();
    }

    window.VinayakNotesPage = {
        initNotesPage: initNotesPage
    };
}());
