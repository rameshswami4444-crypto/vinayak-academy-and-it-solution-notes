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
        return '<section class="public-cta-band"><div class="public-container public-cta-inner"><div><h2>Ready to start?</h2><p>Start your course journey or send a general question.</p></div><a class="public-link-btn" href="/get-started">' + icon("rocket") + 'GET STARTED</a><a class="public-link-btn public-link-btn-red" href="/enquiry">' + icon("send") + 'ENQUIRY</a></div></section>';
    }

    function requestedCourse() {
        return String(new URLSearchParams(window.location.search).get("course") || "").trim().toLowerCase();
    }

    function courseOptions(courses, selectedSlug) {
        return (courses || []).map(function (course) {
            var value = course.slug || course.id || course.title;
            var selected = selectedSlug && String(course.slug || "").toLowerCase() === selectedSlug ? " selected" : "";
            return '<option value="' + escapeHtml(value) + '" data-title="' + escapeHtml(course.title) + '" data-category="' + escapeHtml(course.category) + '"' + selected + '>' + escapeHtml(course.title) + '</option>';
        }).join("");
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

    function renderGetStarted(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container public-apply-container"><article class="public-info-card public-enquiry-card"><h2>Get Started</h2><form class="public-form" data-get-started-form><input type="hidden" name="mobile_verification_token" data-mobile-token><div class="public-form-grid"><div class="public-field"><label for="student_name">Student Name*</label><input id="student_name" name="student_name" required autocomplete="name"></div><div class="public-field"><label for="guardian_name">Father / Guardian Name*</label><input id="guardian_name" name="guardian_name" required autocomplete="off"></div><div class="public-field public-field-wide"><label for="mobile">Mobile Number*</label><div class="public-inline-control"><input id="mobile" name="mobile" required inputmode="numeric" autocomplete="tel" maxlength="10" pattern="[6-9][0-9]{9}" placeholder="10 digit mobile number" data-mobile-input><button class="public-form-btn secondary" type="button" data-send-otp>Send OTP</button></div></div><div class="public-field public-field-wide" data-otp-row hidden><label for="otp">OTP*</label><div class="public-inline-control"><input id="otp" name="otp" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" data-otp-input><button class="public-form-btn secondary" type="button" data-verify-otp>Verify OTP</button></div></div><div class="public-verified-state public-field-wide" data-verified-state hidden>Mobile Number Verified</div><div class="public-field"><label for="selected_course">Interested Course*</label><select id="selected_course" name="selected_course" data-apply-course required><option value="">Select Course</option>' + courseOptions(data.courses, requestedCourse()) + '</select></div><div class="public-field"><label for="alternate_mobile">Alternate Mobile Number</label><input id="alternate_mobile" name="alternate_mobile" inputmode="numeric" maxlength="10" autocomplete="tel"></div><div class="public-field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email"></div><div class="public-field"><label for="date_of_birth">Date of Birth</label><input id="date_of_birth" name="date_of_birth" type="date"></div><div class="public-field"><label for="gender">Gender</label><select id="gender" name="gender"><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></div><div class="public-field"><label for="qualification">Education Qualification</label><input id="qualification" name="qualification"></div><div class="public-field"><label for="preferred_learning_mode">Preferred Learning Mode</label><select id="preferred_learning_mode" name="preferred_learning_mode"><option value="">Select</option><option>Classroom</option><option>Online</option><option>Hybrid</option></select></div><div class="public-field public-field-wide"><label for="address">Address</label><textarea id="address" name="address" autocomplete="street-address"></textarea></div><div class="public-field"><label for="city">City</label><input id="city" name="city" autocomplete="address-level2"></div><div class="public-field"><label for="state">State</label><input id="state" name="state" autocomplete="address-level1"></div><div class="public-field"><label for="pin_code">Pin Code</label><input id="pin_code" name="pin_code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" autocomplete="postal-code"></div><div class="public-field public-field-wide"><label for="message">Message</label><textarea id="message" name="message" placeholder="Tell us what you want to learn..."></textarea></div></div><div class="public-turnstile" data-turnstile-container></div><label class="public-consent"><input name="consent" type="checkbox" required> I agree to be contacted regarding course and admission information.</label><button class="public-form-btn public-submit-btn" type="submit">Submit Details</button><div class="public-form-status" data-form-status></div></form></article></div></section>');
    }

    function renderEnquiry(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container public-apply-container"><article class="public-info-card public-enquiry-card"><h2>General Enquiry</h2><form class="public-form" data-general-enquiry-form><div class="public-form-grid"><div class="public-field"><label for="name">Name*</label><input id="name" name="name" required autocomplete="name"></div><div class="public-field"><label for="phone">Mobile Number*</label><input id="phone" name="phone" required inputmode="tel" autocomplete="tel"></div><div class="public-field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email"></div><div class="public-field"><label for="subject">Subject*</label><input id="subject" name="subject" required></div><div class="public-field"><label for="enquiry_type_option">Enquiry Type*</label><select id="enquiry_type_option" name="enquiry_type_option" required><option value="">Select Type</option><option>Course Information</option><option>Fees</option><option>Admission</option><option>Computer Course</option><option>Competition Course</option><option>IT Service</option><option>Accounting & GST Service</option><option>Website Development</option><option>Other</option></select></div><div class="public-field public-field-wide"><label for="message">Message*</label><textarea id="message" name="message" required></textarea></div></div><label class="public-consent"><input name="consent" type="checkbox" required> I agree to be contacted regarding my enquiry.</label><button class="public-form-btn public-submit-btn" type="submit">Submit Enquiry</button><div class="public-form-status" data-form-status></div></form></article></div></section>');
    }

    function renderApply(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container public-apply-container"><article class="public-info-card public-enquiry-card"><h2>Course Enquiry</h2><form class="public-form" data-apply-form><input type="hidden" name="mobile_verification_token" data-mobile-token><div class="public-form-grid"><div class="public-field"><label for="student_name">Student Name*</label><input id="student_name" name="student_name" required autocomplete="name"></div><div class="public-field"><label for="guardian_name">Father / Guardian Name*</label><input id="guardian_name" name="guardian_name" required autocomplete="off"></div><div class="public-field public-field-wide"><label for="mobile">Mobile Number*</label><div class="public-inline-control"><input id="mobile" name="mobile" required inputmode="numeric" autocomplete="tel" maxlength="10" pattern="[6-9][0-9]{9}" placeholder="10 digit mobile number" data-mobile-input><button class="public-form-btn secondary" type="button" data-send-otp>Send OTP</button></div></div><div class="public-field public-field-wide" data-otp-row hidden><label for="otp">OTP*</label><div class="public-inline-control"><input id="otp" name="otp" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" data-otp-input><button class="public-form-btn secondary" type="button" data-verify-otp>Verify OTP</button></div></div><div class="public-verified-state public-field-wide" data-verified-state hidden>✓ Mobile Number Verified</div><div class="public-field"><label for="selected_course">Interested Course*</label><select id="selected_course" name="selected_course" data-apply-course required><option value="">Select Course</option>' + data.courses.map(function (course) { return '<option value="' + escapeHtml(course.id || course.title) + '" data-title="' + escapeHtml(course.title) + '" data-category="' + escapeHtml(course.category) + '">' + escapeHtml(course.title) + '</option>'; }).join("") + '</select></div><div class="public-field"><label for="address">Address / City*</label><input id="address" name="address" required autocomplete="address-level2"></div><div class="public-field"><label for="preferred_contact_time">Preferred Contact Time</label><select id="preferred_contact_time" name="preferred_contact_time"><option>Anytime</option><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div><div class="public-field"><label for="message">Message / Enquiry</label><textarea id="message" name="message" placeholder="Tell us what you are interested in..."></textarea></div></div><div class="public-turnstile" data-turnstile-container></div><label class="public-consent"><input name="consent" type="checkbox" required> I agree to be contacted regarding my enquiry.</label><button class="public-form-btn public-submit-btn" type="submit">Submit Enquiry</button><div class="public-form-status" data-form-status></div></form></article></div></section>');
    }

    function renderAdmission(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container public-apply-container"><article class="public-info-card public-enquiry-card"><h2>Online Admission</h2><form class="public-form public-admission-form" data-admission-form><input type="hidden" name="mobile_verification_token" data-mobile-token><div class="public-admission-steps" data-admission-steps><span class="active">1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span></div><section data-admission-panel="1"><h3>Personal Details</h3><div class="public-form-grid"><div class="public-field"><label>Student Name*</label><input name="student_name" required></div><div class="public-field"><label>Father / Guardian Name*</label><input name="guardian_name" required></div><div class="public-field public-field-wide"><label>Mobile Number*</label><div class="public-inline-control"><input name="mobile" required inputmode="numeric" maxlength="10" pattern="[6-9][0-9]{9}" data-mobile-input><button class="public-form-btn secondary" type="button" data-send-otp>Send OTP</button></div></div><div class="public-field public-field-wide" data-otp-row hidden><label>OTP*</label><div class="public-inline-control"><input name="otp" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" data-otp-input><button class="public-form-btn secondary" type="button" data-verify-otp>Verify OTP</button></div></div><div class="public-verified-state public-field-wide" data-verified-state hidden>Mobile Verified ✓</div><div class="public-field"><label>Email</label><input name="email" type="email"></div><div class="public-field"><label>Date of Birth</label><input name="date_of_birth" type="date"></div><div class="public-field"><label>Gender</label><select name="gender"><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></div></div></section><section data-admission-panel="2" hidden><h3>Contact / Address</h3><div class="public-form-grid"><div class="public-field public-field-wide"><label>Address*</label><textarea name="address" required></textarea></div><div class="public-field"><label>City*</label><input name="city" required></div><div class="public-field"><label>State*</label><input name="state" required></div><div class="public-field"><label>PIN Code*</label><input name="pin_code" required inputmode="numeric" maxlength="6" pattern="[0-9]{6}"></div><div class="public-field"><label>Alternate Mobile</label><input name="alternate_mobile" inputmode="numeric" maxlength="10"></div></div></section><section data-admission-panel="3" hidden><h3>Education</h3><div class="public-field"><label>Education Qualification*</label><input name="education_qualification" required></div></section><section data-admission-panel="4" hidden><h3>Course Selection</h3><div class="public-form-grid"><div class="public-field"><label>Course*</label><select name="selected_course" data-admission-course required><option value="">Loading courses...</option></select></div><div class="public-field"><label>Batch / Session*</label><select name="batch_id" data-admission-batch required><option value="">Select course first</option></select></div></div></section><section data-admission-panel="5" hidden><h3>Fees / Admission</h3><div class="public-fee-summary" data-fee-summary></div><div class="public-form-grid"><div class="public-field"><label>Admission / Advance Fee</label><input name="admission_fee" type="number" min="0" step="0.01" data-admission-fee></div><div class="public-field"><label>Number of EMIs</label><input name="emi_count" type="number" min="1" max="12" value="1" data-emi-count></div><div class="public-field"><label>First EMI Due Date</label><input name="first_due_date" type="date" data-first-due-date></div></div><div class="public-fee-summary" data-emi-summary></div></section><section data-admission-panel="6" hidden><h3>Documents</h3><div class="public-empty">No public document upload is configured in the existing admission system.</div></section><section data-admission-panel="7" hidden><h3>Confirmation</h3><div class="public-admission-summary" data-admission-summary></div><div class="public-turnstile" data-turnstile-container></div><label class="public-consent"><input name="consent" type="checkbox" required> I confirm these details are correct and request online admission.</label></section><div class="public-form-actions"><button class="public-form-btn secondary" type="button" data-admission-prev hidden>Back</button><button class="public-form-btn" type="button" data-admission-next>Continue</button><button class="public-form-btn public-submit-btn" type="submit" data-admission-submit hidden>Submit Admission</button></div><div class="public-form-status" data-form-status></div></form></article></div></section>');
    }

    function renderGallery(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container"><div class="public-filter-bar"><select data-gallery-filter><option value="">All Gallery</option><option>Classroom</option><option>Computer Lab</option><option>Student Activity</option><option>Event</option></select></div><div class="public-gallery-grid">' + data.gallery.map(function (item, index) {
            return '<button class="public-gallery-button" type="button" data-gallery-item="' + index + '" data-category="' + escapeHtml(item.category) + '"><img src="' + escapeHtml(item.src) + '" alt="' + escapeHtml(item.title) + '" loading="lazy"></button>';
        }).join("") + '</div></div></section><div class="public-lightbox" data-lightbox><button type="button" data-lightbox-close>×</button><img src="" alt=""></div>');
    }

    function renderAbout(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container public-service-detail-grid"><article class="public-info-card"><h2>Empowering Careers With Computer Education & Digital Solutions</h2><p>Vinayak Academy & IT Solution is committed to affordable, practical computer education and reliable IT services for students, professionals and businesses.</p><h3>Mission</h3><p>To provide practical training that helps learners build confidence and useful career skills.</p><h3>Vision</h3><p>To be a trusted local academy for computer education, competition guidance and digital solutions.</p><h3>Values</h3><ul class="public-list"><li>Affordable fees</li><li>Practical knowledge</li><li>Course guidance</li><li>Business solutions</li></ul></article><aside class="public-info-card"><h2>Statistics</h2><p><strong>2017</strong> Founded</p><p><strong>1000+</strong> Learners</p><p><strong>IT Solutions</strong> For students and businesses</p></aside></div></section>');
    }

    function renderLegal(data) {
        return shell(data, '<section class="public-content-section"><div class="public-container"><article class="public-info-card"><h2>' + escapeHtml(data.title) + '</h2><p><strong>Owner review required:</strong> This draft is provided for website structure and should be reviewed by the academy owner or legal advisor before publication.</p><p>Vinayak Academy & IT Solution may collect contact and enquiry details submitted by visitors to respond to course and service requests.</p><p>For corrections or questions, contact +91-9950756514 or vca.academysog@gmail.com.</p></article></div></section>');
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

    var publicFormConfig = null;

    function isValidIndianMobile(value) {
        return /^[6-9]\d{9}$/.test(String(value || "").replace(/\D/g, "").slice(-10));
    }

    async function loadFormConfig() {
        if (publicFormConfig) return publicFormConfig;
        try {
            publicFormConfig = await window.VinayakApi.json("/api/public/form-config");
        } catch (error) {
            publicFormConfig = { success: false };
        }
        return publicFormConfig;
    }

    function mountTurnstile(form, config) {
        var container = form.querySelector("[data-turnstile-container]");
        if (!container || !config || !config.turnstile_site_key) return;
        function renderWidget() {
            if (!window.turnstile || container.dataset.rendered) return;
            window.turnstile.render(container, { sitekey: config.turnstile_site_key });
            container.dataset.rendered = "true";
        }
        if (window.turnstile) {
            renderWidget();
            return;
        }
        var script = document.querySelector('script[data-turnstile-script]');
        if (!script) {
            script = document.createElement("script");
            script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
            script.async = true;
            script.defer = true;
            script.dataset.turnstileScript = "true";
            script.addEventListener("load", renderWidget);
            document.head.appendChild(script);
        } else {
            script.addEventListener("load", renderWidget);
        }
    }

    function setStatus(form, message, type) {
        var status = form.querySelector("[data-form-status]");
        if (!status) return;
        status.textContent = message || "";
        status.dataset.statusType = type || "";
    }

    function bindOtpControls(form) {
        var mobileInput = form.querySelector("[data-mobile-input]");
        var otpRow = form.querySelector("[data-otp-row]");
        var otpInput = form.querySelector("[data-otp-input]");
        var tokenInput = form.querySelector("[data-mobile-token]");
        var verifiedState = form.querySelector("[data-verified-state]");
        var sendButton = form.querySelector("[data-send-otp]");
        var verifyButton = form.querySelector("[data-verify-otp]");

        function clearVerification() {
            if (tokenInput) tokenInput.value = "";
            if (verifiedState) verifiedState.hidden = true;
            if (mobileInput) mobileInput.readOnly = false;
        }

        if (mobileInput) {
            mobileInput.addEventListener("input", function () {
                mobileInput.value = mobileInput.value.replace(/\D/g, "").slice(0, 10);
                clearVerification();
            });
        }
        if (otpInput) {
            otpInput.addEventListener("input", function () {
                otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6);
            });
        }
        if (sendButton) {
            sendButton.addEventListener("click", async function () {
                var mobile = mobileInput && mobileInput.value;
                if (!isValidIndianMobile(mobile)) {
                    setStatus(form, "Enter a valid 10-digit Indian mobile number.", "error");
                    return;
                }
                sendButton.disabled = true;
                setStatus(form, "Sending OTP...", "");
                try {
                    var payload = await window.VinayakApi.json("/api/public/otp/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mobile: mobile })
                    });
                    if (otpRow) otpRow.hidden = false;
                    if (otpInput) otpInput.focus();
                    setStatus(form, payload.message || "OTP sent successfully.", "success");
                } catch (error) {
                    setStatus(form, error.message || "OTP could not be sent.", "error");
                } finally {
                    sendButton.disabled = false;
                }
            });
        }
        if (verifyButton) {
            verifyButton.addEventListener("click", async function () {
                var mobile = mobileInput && mobileInput.value;
                var otp = otpInput && otpInput.value;
                if (!isValidIndianMobile(mobile) || !/^\d{6}$/.test(String(otp || ""))) {
                    setStatus(form, "Enter the 6-digit OTP sent to your mobile.", "error");
                    return;
                }
                verifyButton.disabled = true;
                setStatus(form, "Verifying OTP...", "");
                try {
                    var payload = await window.VinayakApi.json("/api/public/otp/verify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mobile: mobile, otp: otp })
                    });
                    if (tokenInput) tokenInput.value = payload.mobile_verification_token || "";
                    if (verifiedState) verifiedState.hidden = false;
                    if (mobileInput) mobileInput.readOnly = true;
                    setStatus(form, "Mobile Number Verified", "success");
                } catch (error) {
                    clearVerification();
                    setStatus(form, error.message || "OTP verification failed.", "error");
                } finally {
                    verifyButton.disabled = false;
                }
            });
        }
    }

    function bindAdmissionForm(config) {
        var form = document.querySelector("[data-admission-form]");
        if (!form) return;
        mountTurnstile(form, config);
        bindOtpControls(form);
        var state = { step: 1, courses: [], batches: [] };
        var courseSelect = form.querySelector("[data-admission-course]");
        var batchSelect = form.querySelector("[data-admission-batch]");
        var feeInput = form.querySelector("[data-admission-fee]");
        var emiInput = form.querySelector("[data-emi-count]");
        var firstDueInput = form.querySelector("[data-first-due-date]");

        function selectedCourse() {
            var value = courseSelect && courseSelect.value;
            return state.courses.find(function (course) { return String(course.id || course.title) === String(value); }) || null;
        }

        function batchesForCourse(course) {
            if (!course) return [];
            return state.batches.filter(function (batch) {
                return String(batch.course_id || "") === String(course.id || "");
            });
        }

        function moneyText(value) {
            return money(Number(value || 0));
        }

        function updateBatchOptions() {
            var course = selectedCourse();
            var batches = batchesForCourse(course);
            if (!batchSelect) return;
            batchSelect.innerHTML = '<option value="">Select batch</option>' + batches.map(function (batch) {
                var label = batch.name + (batch.timing ? " - " + batch.timing : "");
                return '<option value="' + escapeHtml(batch.id) + '">' + escapeHtml(label) + '</option>';
            }).join("");
            if (!batches.length) batchSelect.innerHTML = '<option value="">No active batch found</option>';
            updateFees();
        }

        function updateFees() {
            var course = selectedCourse();
            var total = Math.max(Number(course && course.price || 0), 0);
            var admission = Math.max(0, Math.min(Number(feeInput && feeInput.value || 0), total));
            var remaining = Math.max(total - admission, 0);
            var emiCount = Math.max(1, Number(emiInput && emiInput.value || 1));
            var feeSummary = form.querySelector("[data-fee-summary]");
            var emiSummary = form.querySelector("[data-emi-summary]");
            if (feeSummary) {
                feeSummary.innerHTML = '<div><strong>Course Fee</strong><span>' + moneyText(total) + '</span></div><div><strong>Advance</strong><span>' + moneyText(admission) + '</span></div><div><strong>Remaining</strong><span>' + moneyText(remaining) + '</span></div>';
            }
            if (emiSummary) {
                emiSummary.innerHTML = remaining > 0
                    ? '<div><strong>EMI Plan</strong><span>' + emiCount + ' EMI(s), approx. ' + moneyText(remaining / emiCount) + ' each</span></div>'
                    : '<div><strong>EMI Plan</strong><span>No EMI required</span></div>';
            }
            if (firstDueInput) firstDueInput.required = remaining > 0;
        }

        function renderSummary() {
            var data = Object.fromEntries(new FormData(form).entries());
            var course = selectedCourse();
            var batch = state.batches.find(function (item) { return String(item.id) === String(data.batch_id); });
            var summary = form.querySelector("[data-admission-summary]");
            if (!summary) return;
            summary.innerHTML = [
                ["Student Name", data.student_name],
                ["Father / Guardian", data.guardian_name],
                ["Mobile", data.mobile],
                ["Email", data.email || "-"],
                ["Address", [data.address, data.city, data.state, data.pin_code].filter(Boolean).join(", ")],
                ["Education", data.education_qualification],
                ["Course", course && course.title],
                ["Batch", batch && (batch.name + (batch.timing ? " - " + batch.timing : ""))],
                ["Advance Fee", moneyText(data.admission_fee)],
                ["EMIs", data.emi_count || "1"]
            ].map(function (row) {
                return '<div><strong>' + escapeHtml(row[0]) + '</strong><span>' + escapeHtml(row[1] || "-") + '</span></div>';
            }).join("");
        }

        function showStep(step) {
            state.step = Math.max(1, Math.min(7, Number(step) || 1));
            form.querySelectorAll("[data-admission-panel]").forEach(function (panel) {
                panel.hidden = Number(panel.getAttribute("data-admission-panel")) !== state.step;
            });
            form.querySelectorAll("[data-admission-steps] span").forEach(function (node, index) {
                node.classList.toggle("active", index + 1 === state.step);
                node.classList.toggle("complete", index + 1 < state.step);
            });
            var prev = form.querySelector("[data-admission-prev]");
            var next = form.querySelector("[data-admission-next]");
            var submit = form.querySelector("[data-admission-submit]");
            if (prev) prev.hidden = state.step === 1;
            if (next) next.hidden = state.step === 7;
            if (submit) submit.hidden = state.step !== 7;
            if (state.step === 7) renderSummary();
        }

        function validateStep() {
            var panel = form.querySelector('[data-admission-panel="' + state.step + '"]');
            var fields = panel ? Array.prototype.slice.call(panel.querySelectorAll("input, select, textarea")) : [];
            for (var index = 0; index < fields.length; index += 1) {
                if (!fields[index].checkValidity()) {
                    fields[index].reportValidity();
                    return false;
                }
            }
            if (state.step === 1 && !isValidIndianMobile(form.elements.mobile && form.elements.mobile.value)) {
                setStatus(form, "Enter a valid 10-digit Indian mobile number.", "error");
                return false;
            }
            if (state.step === 1 && !(form.querySelector("[data-mobile-token]") && form.querySelector("[data-mobile-token]").value)) {
                setStatus(form, "Please verify your mobile number before continuing.", "error");
                return false;
            }
            if (state.step === 2 && !/^\d{6}$/.test(String(form.elements.pin_code && form.elements.pin_code.value || ""))) {
                setStatus(form, "Enter a valid 6-digit PIN code.", "error");
                return false;
            }
            if (state.step === 4 && (!selectedCourse() || !(form.elements.batch_id && form.elements.batch_id.value))) {
                setStatus(form, "Select course and batch.", "error");
                return false;
            }
            setStatus(form, "", "");
            return true;
        }

        async function loadAdmissionConfig() {
            setStatus(form, "Loading admission options...", "");
            try {
                var config = await window.VinayakApi.json("/api/public/admission-config");
                state.courses = config.courses || [];
                state.batches = config.batches || [];
                if (courseSelect) {
                    courseSelect.innerHTML = '<option value="">Select Course</option>' + state.courses.map(function (course) {
                        return '<option value="' + escapeHtml(course.id || course.title) + '">' + escapeHtml(course.title) + '</option>';
                    }).join("");
                }
                if (feeInput) feeInput.value = Number(config.admission_fee_default || 0);
                if (emiInput) emiInput.max = Number(config.max_emi_count || 12);
                updateBatchOptions();
                setStatus(form, "", "");
            } catch (error) {
                setStatus(form, error.message || "Could not load admission options.", "error");
            }
        }

        form.querySelector("[data-admission-next]").addEventListener("click", function () {
            if (!validateStep()) return;
            showStep(state.step + 1);
        });
        form.querySelector("[data-admission-prev]").addEventListener("click", function () {
            showStep(state.step - 1);
        });
        if (courseSelect) courseSelect.addEventListener("change", updateBatchOptions);
        [feeInput, emiInput].forEach(function (input) { if (input) input.addEventListener("input", updateFees); });
        form.querySelectorAll('[name="mobile"], [name="alternate_mobile"], [name="pin_code"]').forEach(function (input) {
            input.addEventListener("input", function () {
                input.value = input.value.replace(/\D/g, "").slice(0, input.name === "pin_code" ? 6 : 10);
            });
        });
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            if (!validateStep()) return;
            var submit = form.querySelector("[data-admission-submit]");
            if (submit) submit.disabled = true;
            setStatus(form, "Submitting admission...", "");
            try {
                var data = Object.fromEntries(new FormData(form).entries());
                data.consent = Boolean(form.querySelector('[name="consent"]') && form.querySelector('[name="consent"]').checked);
                if (window.turnstile) data.turnstile_token = window.turnstile.getResponse();
                var payload = await window.VinayakApi.json("/api/public/admissions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                form.innerHTML = '<div class="public-empty"><h3>Admission completed successfully</h3><p><strong>Student ID:</strong> ' + escapeHtml(payload.student_id) + '</p><p><strong>Password:</strong> ' + escapeHtml(payload.password) + '</p><p><strong>Course:</strong> ' + escapeHtml(payload.course) + '</p><p>You can now log in from the student login page.</p><a class="public-link-btn" href="/login.html?role=student">Student Login</a></div>';
            } catch (error) {
                setStatus(form, error.message || "Admission could not be submitted.", "error");
            } finally {
                if (submit) submit.disabled = false;
            }
        });
        loadAdmissionConfig();
        showStep(1);
    }

    async function bindForms(data) {
        document.querySelectorAll("[data-contact-form]").forEach(function (form) { bindForm(form, "/api/public/contact"); });
        var config = await loadFormConfig();
        document.querySelectorAll("[data-apply-form]").forEach(function (form) {
            bindOtpControls(form);
            mountTurnstile(form, config);
            bindForm(form, "/api/public/apply-now");
        });
        document.querySelectorAll("[data-get-started-form]").forEach(function (form) {
            bindOtpControls(form);
            mountTurnstile(form, config);
            bindForm(form, "/api/public/get-started");
        });
        document.querySelectorAll("[data-general-enquiry-form]").forEach(function (form) {
            bindForm(form, "/api/public/enquiry");
        });
        bindAdmissionForm(config);
    }

    function bindForm(form, endpoint) {
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var status = form.querySelector("[data-form-status]");
            var data = Object.fromEntries(new FormData(form).entries());
            data.consent = Boolean(form.querySelector('[name="consent"]') && form.querySelector('[name="consent"]').checked);
            var isCourseLead = endpoint.indexOf("apply-now") !== -1 || endpoint.indexOf("get-started") !== -1;
            if (isCourseLead) {
                var token = form.querySelector("[data-mobile-token]");
                if (!token || !token.value) {
                    status.textContent = "Please verify your mobile number before submitting.";
                    return;
                }
                if (window.turnstile) {
                    data.turnstile_token = window.turnstile.getResponse();
                }
            }
            var selected = form.querySelector("[data-apply-course] option:checked");
            if (selected && selected.dataset.title) data.selected_course_name = selected.dataset.title;
            status.textContent = "Submitting...";
            var submit = form.querySelector('[type="submit"]');
            if (submit) submit.disabled = true;
            try {
                var payload = await window.VinayakApi.json(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
                if (isCourseLead && payload.enquiry_number) {
                    form.innerHTML = '<div class="public-empty"><h3>Thank you!</h3><p>Your details have been submitted successfully.</p><p><strong>Course:</strong> ' + escapeHtml(payload.course || data.selected_course_name || data.selected_course) + '</p><p><strong>Enquiry No:</strong> ' + escapeHtml(payload.enquiry_number) + '</p><p>Our team will contact you regarding course and admission information.</p><p><a class="public-link-btn secondary" href="/index.html">Back to Home</a> <a class="public-link-btn" href="/skill-courses">Explore Courses</a></p></div>';
                    if (window.lucide) window.lucide.createIcons();
                    return;
                }
                if (endpoint.indexOf("enquiry") !== -1 && payload.enquiry_number) {
                    form.innerHTML = '<div class="public-empty"><h3>Enquiry submitted successfully</h3><p><strong>Enquiry No:</strong> ' + escapeHtml(payload.enquiry_number) + '</p><p>Thank you. Our team will contact you soon.</p><p><a class="public-link-btn" href="/index.html">Back to Home</a></p></div>';
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
            "get-started": renderGetStarted,
            enquiry: renderEnquiry,
            admission: renderAdmission,
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
