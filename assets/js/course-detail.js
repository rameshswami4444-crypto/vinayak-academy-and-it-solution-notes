(function () {
    "use strict";

    var fallbackImage = "/assets/images/banners/academy-computer-lab-1.png";

    function $(selector, root) {
        return (root || document).querySelector(selector);
    }

    function $all(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function slugFromLocation() {
        var parts = window.location.pathname.split("/").filter(Boolean);
        var index = parts.indexOf("courses");
        return index >= 0 ? String(parts[index + 1] || "").toLowerCase() : "";
    }

    function money(value) {
        if (value === null || value === undefined || value === "" || Number(value) <= 0) return "Contact for Fee";
        try {
            return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));
        } catch (error) {
            return "Rs. " + Number(value).toFixed(0);
        }
    }

    function stars(rating, count) {
        var score = Number(rating || 0);
        if (!score) return count ? escapeHtml(count + " reviews") : "Not rated";
        var rounded = Math.max(0, Math.min(5, Math.round(score)));
        return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
    }

    function asParagraphs(text) {
        var clean = String(text || "").trim();
        if (!clean) return '<p>Course details will be updated soon by Vinayak Academy &amp; IT Solution.</p>';
        return clean.split(/\n{2,}/).map(function (part) {
            return "<p>" + escapeHtml(part) + "</p>";
        }).join("");
    }

    function listBlock(title, items) {
        if (!items || !items.length) return "";
        return [
            '<hr class="course-divider">',
            '<h3>' + escapeHtml(title) + '</h3>',
            '<ul class="course-list">',
            items.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join(""),
            '</ul>'
        ].join("");
    }

    function accordion(items, emptyText) {
        if (!items || !items.length) {
            return '<div class="course-empty-card">' + escapeHtml(emptyText) + '</div>';
        }
        return items.map(function (item, index) {
            var title = typeof item === "object" ? (item.title || item.heading || item.question || "Module " + (index + 1)) : "Module " + (index + 1);
            var body = typeof item === "object" ? (item.description || item.content || item.answer || item.lessons || "") : item;
            if (Array.isArray(body)) {
                body = "<ul>" + body.map(function (lesson) { return "<li>" + escapeHtml(lesson.title || lesson) + "</li>"; }).join("") + "</ul>";
            } else {
                body = escapeHtml(body);
            }
            return [
                '<details' + (index === 0 ? " open" : "") + '>',
                '<summary><span>' + escapeHtml(title) + '</span><i data-lucide="chevron-down"></i></summary>',
                '<div class="course-accordion-content">' + body + '</div>',
                '</details>'
            ].join("");
        }).join("");
    }

    function renderReviews(course) {
        var count = Number(course.reviewCount || 0);
        if (!count) {
            return '<div class="course-empty-card">Reviews will appear here after enrolled students share feedback.</div>';
        }
        return [
            '<div class="course-review-card">',
            '<div class="course-avatar">V</div>',
            '<div><h3>Student Feedback</h3><p>' + escapeHtml(count + " review" + (count === 1 ? "" : "s")) + ' recorded for this course.</p></div>',
            '</div>'
        ].join("");
    }

    function renderCategories(categories) {
        if (!categories || !categories.length) return '<div class="course-empty-card">Categories will appear after courses are published.</div>';
        return categories.map(function (category) {
            var slug = String(category.slug || "").replace(/^basic-skill-programs$/, "basic").replace(/^diploma-programs$/, "diploma").replace(/^advanced-diploma-programs$/, "advanced-diploma");
            var prefix = /exams$/.test(String(category.name || "").toLowerCase()) ? "/competition-courses/" : "/skill-courses/";
            if (category.name === "Central Government Exams") slug = "central-government-exams";
            if (category.name === "Rajasthan Government Exams") slug = "rajasthan-government-exams";
            if (category.name === "Teaching Exams") slug = "teaching-exams";
            return '<a href="' + prefix + encodeURIComponent(slug) + '"><span>' + escapeHtml(category.name) + '</span><span>(' + escapeHtml(category.count) + ')</span></a>';
        }).join("");
    }

    function renderRelated(courses) {
        if (!courses || !courses.length) return '<div class="course-empty-card">More courses will appear here soon.</div>';
        return courses.map(function (course) {
            return [
                '<a class="course-related-card" href="/courses/' + encodeURIComponent(course.slug) + '">',
                '<img src="' + escapeHtml(course.imageUrl || fallbackImage) + '" alt="">',
                '<span><strong>' + escapeHtml(course.title) + '</strong><span>' + escapeHtml(money(course.price)) + '</span></span>',
                '</a>'
            ].join("");
        }).join("");
    }

    async function getSession() {
        if (!window.VinayakAuth || typeof window.VinayakAuth.getValidatedSession !== "function") return null;
        try {
            var student = await window.VinayakAuth.getValidatedSession("student");
            if (student && student.role === "student") return student;
        } catch (error) {
            if (window.VinayakLogger) window.VinayakLogger.warn("Student session check skipped.", error);
        }
        try {
            var admin = await window.VinayakAuth.getValidatedSession("admin");
            if (admin && admin.role === "admin") return admin;
        } catch (error) {
            if (window.VinayakLogger) window.VinayakLogger.warn("Admin session check skipped.", error);
        }
        return null;
    }

    function bindTabs() {
        $all("[data-tab-target]").forEach(function (button) {
            button.addEventListener("click", function () {
                var target = button.getAttribute("data-tab-target");
                $all("[data-tab-target]").forEach(function (tab) { tab.classList.toggle("is-active", tab === button); });
                $all("[data-tab-panel]").forEach(function (panel) {
                    panel.classList.toggle("is-active", panel.getAttribute("data-tab-panel") === target);
                });
            });
        });
    }

    function bindCourseAction(course) {
        var button = $("[data-course-action]");
        if (!button) return;
        button.addEventListener("click", async function () {
            button.disabled = true;
            var session = await getSession();
            if (session && session.role === "admin") {
                window.location.href = "/admin.html";
                return;
            }
            if (session && session.role === "student") {
                window.location.href = "/dashboard.html";
                return;
            }
            var next = encodeURIComponent("/courses/" + course.slug);
            window.location.href = "/login.html?role=student&next=" + next;
        });
    }

    function bindSearch() {
        var form = $("[data-course-search]");
        if (!form) return;
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var term = String($("input", form).value || "").trim();
            window.location.href = term ? "/index.html#courses" : "/index.html";
        });
    }

    function render(payload) {
        var course = payload.course || {};
        document.title = course.title + " | Vinayak Academy & IT Solution";
        var breadcrumb = $("[data-breadcrumb-current]");
        if (breadcrumb) breadcrumb.textContent = "/ " + course.title;

        $("[data-course-title]").textContent = course.title;
        $("[data-course-summary]").textContent = course.shortDescription || course.overview || "";
        $("[data-course-instructor]").textContent = course.instructor || "Admin";
        $("[data-course-instructor-name]").textContent = course.instructor || "Admin";
        $("[data-course-category]").textContent = course.category || "Course";
        $("[data-course-rating]").textContent = stars(course.rating, course.reviewCount);
        $("[data-course-duration]").textContent = course.duration || "Contact Academy";
        $("[data-course-level]").textContent = course.level || "All Levels";
        $("[data-course-lessons]").textContent = (Number(course.lessons || 0)) + " Lessons";
        $("[data-course-quizzes]").textContent = (Number(course.quizzes || 0)) + " Quizzes";
        $("[data-course-students]").textContent = (Number(course.students || 0)) + " Students";
        $("[data-course-price]").textContent = money(course.price);
        $("[data-course-overview]").innerHTML = asParagraphs(course.overview);
        $("[data-course-highlights]").innerHTML = listBlock("Course Highlights", course.highlights);
        $("[data-course-requirements]").innerHTML = listBlock("Eligibility / Requirements", course.requirements);
        $("[data-course-curriculum]").innerHTML = accordion(course.curriculum, "Curriculum details will be updated soon.");
        $("[data-course-faqs]").innerHTML = accordion(course.faqs, "FAQs will be updated soon.");
        $("[data-course-reviews]").innerHTML = renderReviews(course);
        $("[data-course-categories]").innerHTML = renderCategories(payload.categories);
        $("[data-course-related]").innerHTML = renderRelated(payload.related);
        $("[data-course-action]").textContent = payload.enrollment && payload.enrollment.actionLabel || "Apply for Course";
        $("[data-course-action-note]").textContent = payload.enrollment && payload.enrollment.reason || "Existing student login is reused for access.";

        var initial = String((course.instructor || "Admin").charAt(0) || "A").toUpperCase();
        $all("[data-course-avatar], [data-course-instructor-avatar]").forEach(function (node) { node.textContent = initial; });
        var image = course.imageUrl || fallbackImage;
        $("[data-course-preview]").innerHTML = '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(course.title) + '">';

        var loading = $("[data-course-loading]");
        var shell = $("[data-course-shell]");
        if (loading) loading.hidden = true;
        if (shell) shell.hidden = false;
        bindCourseAction(course);
        bindTabs();
        bindSearch();
        if (window.lucide) window.lucide.createIcons();
    }

    async function init() {
        var slug = slugFromLocation();
        if (!slug || !window.VinayakApi) {
            throw new Error("Course API is not available.");
        }
        var payload = await window.VinayakApi.json("/api/public/courses/" + encodeURIComponent(slug));
        render(payload);
    }

    init().catch(function (error) {
        if (window.VinayakLogger) window.VinayakLogger.error("Course detail failed.", error);
        var loading = $("[data-course-loading]");
        var errorBox = $("[data-course-error]");
        if (loading) loading.hidden = true;
        if (errorBox) errorBox.hidden = false;
        if (window.lucide) window.lucide.createIcons();
    });
})();
