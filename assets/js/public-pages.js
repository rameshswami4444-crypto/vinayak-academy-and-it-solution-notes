(function () {
    "use strict";

    var root = document.querySelector("[data-public-page-root]");
    var image = "/assets/images/banners/academy-computer-lab-1.png";

    function escapeHtml(value) {
        return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function money(value) {
        if (!value || Number(value) <= 0) return "Contact for Fee";
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));
    }

    function icon(name) {
        return '<i data-lucide="' + name + '" aria-hidden="true"></i>';
    }

    function pagePath() {
        return window.location.pathname.replace(/\/+$/, "") || "/";
    }

    function setSeo(data) {
        var title = data.title + " | Vinayak Academy & IT Solution";
        document.title = title;
        var description = data.description || "Vinayak Academy & IT Solution public page.";
        document.querySelector('meta[name="description"]').setAttribute("content", description);
        document.querySelector('meta[property="og:title"]').setAttribute("content", title);
        document.querySelector('meta[property="og:description"]').setAttribute("content", description);
        document.querySelector('link[rel="canonical"]').setAttribute("href", window.location.origin + pagePath());
    }

    function shell(data, content) {
        return [
            '<section class="public-breadcrumb"><div class="public-container"><a href="/index.html">Home</a><span>/</span><span>' + escapeHtml(data.title) + '</span></div></section>',
            '<section class="public-page-banner"><div class="public-container"><span class="eyebrow">' + escapeHtml(data.eyebrow || "Vinayak Academy") + '</span><h1>' + escapeHtml(data.title) + '</h1><p>' + escapeHtml(data.description || "") + '</p></div></section>',
            content,
            cta()
        ].join("");
    }

    function cta() {
        return '<section class="public-cta-band"><div class="public-container public-cta-inner"><div><h2>Ready to start?</h2><p>Talk to Vinayak Academy for course admission or IT service enquiry.</p></div><a class="public-link-btn" href="/apply-now">' + icon("send") + 'Apply Now</a></div></section>';
    }

    function categoryCards(categories, base) {
        return '<div class="public-category-grid">' + categories.map(function (category) {
            return '<article class="public-category-card"><div class="public-card-media"><img src="' + image + '" alt="' + escapeHtml(category.title) + '" loading="lazy"></div><div class="public-card-body"><span class="public-pill">' + escapeHtml(category.count || 0) + ' Courses</span><h2>' + escapeHtml(category.title) + '</h2><p>' + escapeHtml(category.description) + '</p><a class="public-link-btn secondary" href="' + base + '/' + category.slug + '">View Courses</a></div></article>';
        }).join("") + '</div>';
    }

    function courseCards(courses) {
        if (!courses || !courses.length) return '<div class="public-empty">No active courses found for this category.</div>';
        return '<div class="public-card-grid" data-course-grid>' + courses.map(function (course) {
            return '<article class="public-course-card" data-course-card data-title="' + escapeHtml(course.title.toLowerCase()) + '" data-category="' + escapeHtml(course.category) + '" data-duration="' + escapeHtml(course.duration) + '"><div class="public-card-media"><img src="' + escapeHtml(course.imageUrl || image) + '" alt="' + escapeHtml(course.title) + '" loading="lazy"></div><div class="public-card-body"><span class="public-pill">' + escapeHtml(course.category) + '</span><h3>' + escapeHtml(course.title) + '</h3><p>' + escapeHtml(course.shortDescription || course.overview || "") + '</p><div class="public-meta-row"><span>' + escapeHtml(course.duration || "Contact Academy") + '</span><span>' + escapeHtml(money(course.price)) + '</span></div><a class="public-link-btn" href="/courses/' + encodeURIComponent(course.slug) + '">View Details</a></div></article>';
        }).join("") + '</div>';
    }

    function filterBar(categories) {
        return '<div class="public-filter-bar"><input type="search" placeholder="Search courses" data-course-search aria-label="Search courses"><select data-course-category aria-label="Filter category"><option value="">All Categories</option>' + categories.map(function (category) { return '<option value="' + escapeHtml(category.title) + '">' + escapeHtml(category.title) + '</option>'; }).join("") + '</select><select data-course-duration aria-label="Filter duration"><option value="">All Durations</option><option value="3">3 Months</option><option value="6">6 Months</option><option value="12">12 Months</option></select></div>';
    }

    function renderCourseListing(data) {
        var base = data.mode === "competition" ? "/competition-courses" : "/skill-courses";
        return shell(data, [
            '<section class="public-content-section"><div class="public-container"><div class="public-section-heading"><h2>Programme Categories</h2><p>Select a category and explore active courses.</p></div>',
            categoryCards(data.categories, base),
            '</div></section>',
            '<section class="public-content-section alt"><div class="public-container"><div class="public-section-heading"><h2>All Active Courses</h2><p>Search by name, category or duration.</p></div>',
            filterBar(data.categories),
            courseCards(data.courses),
            '</div></section>'
        ].join(""));
    }

    function renderCourseCategory(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container"><div class="public-section-heading"><h2>' + escapeHtml(data.category.count) + ' Available Courses</h2><p>' + escapeHtml(data.description) + '</p></div>' + filterBar(data.categories) + courseCards(data.courses) + '</div></section>');
    }

    function renderServices(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container"><div class="public-section-heading"><h2>Service Categories</h2><p>Business, digital and IT support under one roof.</p></div><div class="public-service-grid">' + data.services.map(function (service) {
            return '<article class="public-service-card">' + icon(service.icon) + '<h3>' + escapeHtml(service.title) + '</h3><p>' + escapeHtml(service.description) + '</p><a class="public-link-btn secondary" href="/services/' + service.slug + '">View Service</a></article>';
        }).join("") + '</div></div></section><section class="public-content-section alt"><div class="public-container public-category-grid"><article class="public-info-card"><h2>Benefits</h2><ul class="public-list"><li>Local support</li><li>Clear guidance</li><li>Practical implementation</li></ul></article><article class="public-info-card"><h2>Process</h2><ul class="public-list"><li>Requirement discussion</li><li>Document or content collection</li><li>Delivery and support</li></ul></article><article class="public-info-card"><h2>Why Choose Us</h2><p>Vinayak Academy combines training, IT knowledge and business services for students and local businesses.</p></article></div></section>');
    }

    function renderServiceDetail(data) {
        var service = data.service;
        return shell(data, '<section class="public-content-section"><div class="public-container public-service-detail-grid"><article class="public-info-card"><h2>' + escapeHtml(service.title) + '</h2><p>' + escapeHtml(service.description) + '</p><h3>Features</h3><ul class="public-list">' + service.features.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join("") + '</ul><h3>Benefits</h3><p>Reliable local service, practical support and clear communication from start to finish.</p><h3>Process</h3><ol class="public-list">' + service.process.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join("") + '</ol><h3>Who This Is For</h3><p>' + escapeHtml(service.audience) + '</p><h3>FAQs</h3><p>Contact us with your requirement and our team will confirm documents, timeline and pricing.</p></article><aside class="public-info-card"><h2>Enquire Now</h2>' + contactForm("Service enquiry: " + service.title) + '<hr><h3>Related Services</h3><ul class="public-list">' + data.related.map(function (item) { return '<li><a href="/services/' + item.slug + '">' + escapeHtml(item.title) + '</a></li>'; }).join("") + '</ul><p><a class="public-link-btn" href="https://wa.me/919950756514" target="_blank" rel="noopener">WhatsApp</a></p></aside></div></section>');
    }

    function contactForm(subject) {
        return '<form class="public-form" data-contact-form><div class="public-field"><label>Name</label><input name="name" required></div><div class="public-field"><label>Phone</label><input name="phone" required inputmode="tel"></div><div class="public-field"><label>Email</label><input name="email" type="email"></div><div class="public-field"><label>Subject</label><input name="subject" value="' + escapeHtml(subject || "") + '"></div><div class="public-field"><label>Message</label><textarea name="message" required></textarea></div><button class="public-form-btn" type="submit">Submit Enquiry</button><div class="public-form-status" data-form-status></div></form>';
    }

    function renderContact(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container public-contact-grid"><article class="public-info-card"><h2>Contact Details</h2><p><strong>Phone:</strong> <a href="tel:+919950756514">+91-9950756514</a></p><p><strong>Email:</strong> <a href="mailto:vca.academysog@gmail.com">vca.academysog@gmail.com</a></p><p><strong>Address:</strong> Behind new Bus stand Suratgarh sri ganganagar 335804 (Rajasthan)</p><p><strong>Business Hours:</strong> Contact academy for current timing.</p><a class="public-link-btn" href="https://www.google.com/maps/search/?api=1&query=Behind%20new%20Bus%20stand%20Suratgarh%20sri%20ganganagar%20335804%20Rajasthan" target="_blank" rel="noopener">Open Map</a></article><article class="public-info-card"><h2>Send Message</h2>' + contactForm("") + '</article></div></section>');
    }

    function renderApply(data) {
        var categoryOptions = data.skillCategories.concat(data.competitionCategories);
        return shell(data, '<section class="public-content-section"><div class="public-container"><article class="public-info-card"><h2>Admission Application</h2><form class="public-form" data-apply-form><div class="public-form-grid">' + [
            ["student_name", "Student Name", "text"], ["guardian_name", "Father / Guardian Name", "text"], ["mobile", "Mobile Number", "tel"], ["alternate_mobile", "Alternate Mobile", "tel"], ["email", "Email", "email"], ["date_of_birth", "Date of Birth", "date"], ["gender", "Gender", "text"], ["city", "City", "text"], ["state", "State", "text"], ["pin_code", "Pin Code", "text"], ["education_qualification", "Education Qualification", "text"], ["preferred_learning_mode", "Preferred Learning Mode", "text"]
        ].map(function (field) { return '<div class="public-field"><label>' + field[1] + '</label><input name="' + field[0] + '" type="' + field[2] + '"' + (["student_name", "mobile"].includes(field[0]) ? " required" : "") + '></div>'; }).join("") + '<div class="public-field"><label>Course Category</label><select name="course_category" data-apply-category required><option value="">Select Category</option>' + categoryOptions.map(function (category) { return '<option value="' + escapeHtml(category.title) + '">' + escapeHtml(category.title) + '</option>'; }).join("") + '</select></div><div class="public-field"><label>Selected Course</label><select name="selected_course" data-apply-course required><option value="">Select Course</option>' + data.courses.map(function (course) { return '<option value="' + escapeHtml(course.id || course.title) + '" data-title="' + escapeHtml(course.title) + '" data-category="' + escapeHtml(course.category) + '">' + escapeHtml(course.title) + '</option>'; }).join("") + '</select></div></div><div class="public-field"><label>Address</label><textarea name="address"></textarea></div><div class="public-field"><label>Message</label><textarea name="message"></textarea></div><label><input name="consent" type="checkbox" required> I agree to be contacted by Vinayak Academy about this application.</label><button class="public-form-btn" type="submit">Submit Application</button><div class="public-form-status" data-form-status></div></form></article></div></section>');
    }

    function renderGallery(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container"><div class="public-filter-bar"><select data-gallery-filter><option value="">All Gallery</option><option>Classroom</option><option>Computer Lab</option><option>Student Activity</option><option>Event</option></select></div><div class="public-gallery-grid">' + data.gallery.map(function (item, index) {
            return '<button class="public-gallery-button" type="button" data-gallery-item="' + index + '" data-category="' + escapeHtml(item.category) + '"><img src="' + escapeHtml(item.src) + '" alt="' + escapeHtml(item.title) + '" loading="lazy"></button>';
        }).join("") + '</div></div></section><div class="public-lightbox" data-lightbox><button type="button" data-lightbox-close>×</button><img src="" alt=""></div>');
    }

    function renderAbout(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container public-service-detail-grid"><article class="public-info-card"><h2>Empowering Careers With Computer Education & Digital Solutions</h2><p>Vinayak Academy & IT Solution is committed to affordable, practical computer education and reliable IT services for students, professionals and businesses.</p><h3>Mission</h3><p>To provide practical training that helps learners build confidence and useful career skills.</p><h3>Vision</h3><p>To be a trusted local academy for computer education, competition guidance and digital solutions.</p><h3>Values</h3><ul class="public-list"><li>Affordable fees</li><li>Practical knowledge</li><li>Admission support</li><li>Business solutions</li></ul></article><aside class="public-info-card"><h2>Statistics</h2><p><strong>2017</strong> Founded</p><p><strong>1000+</strong> Learners</p><p><strong>IT Solutions</strong> For students and businesses</p></aside></div></section>');
    }

    function renderLegal(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container"><article class="public-info-card"><h2>' + escapeHtml(data.title) + '</h2><p><strong>Owner review required:</strong> This draft is provided for website structure and should be reviewed by the academy owner or legal advisor before publication.</p><p>Vinayak Academy & IT Solution may collect contact, enquiry and application details submitted by visitors to respond to admissions and service requests.</p><p>For corrections or questions, contact +91-9950756514 or vca.academysog@gmail.com.</p></article></div></section>');
    }

    function bindFilters() {
        var search = document.querySelector("[data-course-search]");
        var category = document.querySelector("[data-course-category]");
        var duration = document.querySelector("[data-course-duration]");
        function apply() {
            var term = String(search && search.value || "").toLowerCase();
            var cat = String(category && category.value || "");
            var dur = String(duration && duration.value || "");
            document.querySelectorAll("[data-course-card]").forEach(function (card) {
                var ok = (!term || card.dataset.title.indexOf(term) !== -1) && (!cat || card.dataset.category === cat) && (!dur || card.dataset.duration.indexOf(dur) !== -1);
                card.hidden = !ok;
            });
        }
        [search, category, duration].forEach(function (node) { if (node) node.addEventListener("input", apply); });
    }

    function bindForms(data) {
        document.querySelectorAll("[data-contact-form]").forEach(function (form) { bindForm(form, "/api/public/contact"); });
        document.querySelectorAll("[data-apply-form]").forEach(function (form) {
            var category = form.querySelector("[data-apply-category]");
            var course = form.querySelector("[data-apply-course]");
            if (category && course) {
                category.addEventListener("change", function () {
                    Array.prototype.slice.call(course.options).forEach(function (option) {
                        option.hidden = option.value && option.dataset.category !== category.value;
                    });
                    course.value = "";
                });
            }
            bindForm(form, "/api/public/apply-now");
        });
    }

    function bindForm(form, endpoint) {
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var status = form.querySelector("[data-form-status]");
            var data = Object.fromEntries(new FormData(form).entries());
            data.consent = Boolean(form.querySelector('[name="consent"]') && form.querySelector('[name="consent"]').checked);
            var selected = form.querySelector("[data-apply-course] option:checked");
            if (selected && selected.dataset.title) data.selected_course_name = selected.dataset.title;
            status.textContent = "Submitting...";
            var submit = form.querySelector('[type="submit"]');
            if (submit) submit.disabled = true;
            try {
                var payload = await window.VinayakApi.json(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
                if (endpoint.indexOf("apply-now") !== -1 && payload.enquiry_number) {
                    form.innerHTML = '<div class="public-empty"><h3>Application submitted successfully</h3><p><strong>Application Number:</strong> ' + escapeHtml(payload.enquiry_number) + '</p><p><strong>Applicant:</strong> ' + escapeHtml(payload.applicant_name || data.student_name) + '</p><p><strong>Course:</strong> ' + escapeHtml(payload.course || data.selected_course_name || data.selected_course) + '</p><p>Vinayak Academy will contact you using the submitted contact details. For help, call ' + escapeHtml(payload.contact || "+91-9950756514") + '.</p></div>';
                    return;
                }
                status.textContent = payload.message || "Submitted successfully.";
                form.reset();
            } catch (error) {
                status.textContent = error.message || "Could not submit. Please call the academy.";
            } finally {
                if (submit) submit.disabled = false;
            }
        });
    }

    function bindGallery(data) {
        var filter = document.querySelector("[data-gallery-filter]");
        var lightbox = document.querySelector("[data-lightbox]");
        if (filter) {
            filter.addEventListener("input", function () {
                document.querySelectorAll("[data-gallery-item]").forEach(function (button) {
                    button.hidden = filter.value && button.dataset.category !== filter.value;
                });
            });
        }
        document.querySelectorAll("[data-gallery-item]").forEach(function (button) {
            button.addEventListener("click", function () {
                var item = data.gallery[Number(button.dataset.galleryItem)];
                lightbox.querySelector("img").src = item.src;
                lightbox.querySelector("img").alt = item.title;
                lightbox.classList.add("is-open");
            });
        });
        var close = document.querySelector("[data-lightbox-close]");
        if (close) close.addEventListener("click", function () { lightbox.classList.remove("is-open"); });
        document.addEventListener("keydown", function (event) { if (event.key === "Escape" && lightbox) lightbox.classList.remove("is-open"); });
    }

    function render(data) {
        setSeo(data);
        var map = {
            "course-listing": renderCourseListing,
            "course-category": renderCourseCategory,
            services: renderServices,
            "service-detail": renderServiceDetail,
            gallery: renderGallery,
            contact: renderContact,
            apply: renderApply,
            about: renderAbout,
            legal: renderLegal
        };
        root.innerHTML = (map[data.pageType] || renderAbout)(data);
        bindFilters();
        bindForms(data);
        if (data.pageType === "gallery") bindGallery(data);
        if (window.lucide) window.lucide.createIcons();
    }

    window.VinayakApi.json("/api/public/page-data?path=" + encodeURIComponent(pagePath()))
        .then(render)
        .catch(function () {
            root.innerHTML = shell({ title: "Page Not Found", eyebrow: "404", description: "This public page is not available." }, '<section class="public-content-section"><div class="public-container"><div class="public-empty">Please check the URL or go back to the homepage.</div></div></section>');
            if (window.lucide) window.lucide.createIcons();
        });
})();
