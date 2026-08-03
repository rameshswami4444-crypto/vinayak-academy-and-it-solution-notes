(function () {
    "use strict";

    if (window.__vinayakPublicLayoutLoaded) return;
    window.__vinayakPublicLayoutLoaded = true;

    var CONTACT = {
        phone: "+91-9950756514",
        phoneHref: "tel:+919950756514",
        email: "vca.academysog@gmail.com",
        emailHref: "mailto:vca.academysog@gmail.com",
        address: "Behind new Bus stand Suratgarh sri ganganagar 335804 (Rajasthan)",
        mapHref: "https://www.google.com/maps/search/?api=1&query=Behind%20new%20Bus%20stand%20Suratgarh%20sri%20ganganagar%20335804%20Rajasthan",
        whatsappHref: "https://wa.me/919950756514"
    };

    var ROUTES = {
        home: "/index.html",
        login: "/login.html",
        studentDashboard: "/dashboard.html",
        adminDashboard: "/admin.html",
        apply: "/apply-now",
        skillCourses: "/skill-courses",
        competitionCourses: "/competition-courses",
        services: "/services",
        gallery: "/course-gallery",
        contact: "/contact"
    };

    var skillGroups = [
        ["Basic Skill Programs", "/skill-courses/basic", [["Hindi Typing", "/courses/hindi-typing"], ["English Typing", "/courses/english-typing"], ["Computer Basics", "/courses/computer-basics"], ["RS-CIT", "/courses/rscit"], ["CCC", "/courses/ccc"], ["Office Management", "/courses/office-management"], ["Advanced Excel", "/courses/advanced-excel"]]],
        ["Diploma Programs", "/skill-courses/diploma", [["DCA", "/courses/dca"], ["DDEO", "/courses/ddeo"], ["DWD", "/courses/dwd"], ["DITGIT", "/courses/ditgit"], ["DDI", "/courses/ddi"], ["DCIS", "/courses/dcis"], ["DCFA", "/courses/dcfa"], ["RS-CFA", "/courses/rscfa"]]],
        ["Advanced Diploma Programs", "/skill-courses/advanced-diploma", [["ADFA", "/courses/adfa"], ["ADCA", "/courses/adca"], ["ADOM", "/courses/adom"], ["ADCH", "/courses/adch"], ["ADNS", "/courses/adns"], ["ADWD", "/courses/adwd"], ["ADDA", "/courses/adda"], ["ADFD", "/courses/adfd"]]]
    ];

    var competitionGroups = [
        ["Teaching Exams", "/competition-courses/teaching-exams", [["PRE PTET", "/courses/pre-ptet"], ["PRE BSTC", "/courses/pre-bstc"], ["REET PRE", "/courses/reet-pre"], ["REET Mains", "/courses/reet-mains"], ["Mother Teacher Bharti", "/courses/mother-teacher-bharti"], ["Second Grade Teacher", "/courses/second-grade-teacher"], ["First Grade Teacher", "/courses/first-grade-teacher"]]],
        ["Rajasthan Government Exams", "/competition-courses/rajasthan-government-exams", [["LDC", "/courses/ldc"], ["Rajasthan Police", "/courses/rajasthan-police"], ["Patwari", "/courses/patwari"], ["VDO", "/courses/vdo"], ["Jail Prahari", "/courses/jail-prahari"]]],
        ["Central Government Exams", "/competition-courses/central-government-exams", [["SSC GD", "/courses/ssc-gd"], ["Railway Group D", "/courses/railway-group-d"], ["Loco Pilot", "/courses/loco-pilot"], ["Banking", "/courses/banking"]]]
    ];

    var serviceLinks = [
        ["Accounting & GST", "/services/accounting-gst"],
        ["Business Registration", "/services/business-registration"],
        ["IT & Software", "/services/it-software"],
        ["Ads & Promotion", "/services/ads-promotion"],
        ["Creative & Design", "/services/creative-design"],
        ["Website Development", "/services/website-development"],
        ["E-Commerce Development", "/services/ecommerce-development"],
        ["SEO Services", "/services/seo-services"]
    ];

    var tickerItems = ["Accounting & GST", "Website Development", "Digital Marketing", "SEO Services", "Graphic Design", "Business Registration"];

    function icon(name) {
        return '<i data-lucide="' + name + '" aria-hidden="true"></i>';
    }

    function escapeHtml(value) {
        return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function menuCards(items) {
        return items.map(function (item) {
            var children = item[2] || [];
            return '<div class="public-submenu-item"><a href="' + item[1] + '"><span>' + escapeHtml(item[0]) + '</span>' + icon("chevron-right") + '</a><div class="public-submenu">' + children.map(function (child) {
                return '<a href="' + child[1] + '"><span>' + escapeHtml(child[0]) + '</span>' + icon("arrow-up-right") + '</a>';
            }).join("") + '</div></div>';
        }).join("");
    }

    function menuList(items) {
        return items.map(function (item) {
            return '<a href="' + item[1] + '"><span>' + escapeHtml(item[0]) + '</span>' + icon("arrow-up-right") + '</a>';
        }).join("");
    }

    function mobileDetails(title, items, isCards) {
        var links = items.map(function (item) {
            var href = item[1];
            var children = isCards && item[2] ? item[2].map(function (child) {
                return '<a href="' + child[1] + '">' + escapeHtml(child[0]) + '</a>';
            }).join("") : "";
            return '<a href="' + href + '">' + escapeHtml(item[0]) + '</a>' + children;
        }).join("");
        return '<details class="public-mobile-details"><summary class="public-mobile-summary"><span>' + escapeHtml(title) + '</span>' + icon("chevron-down") + '</summary><div class="public-mobile-subgrid">' + links + '</div></details>';
    }

    function headerMarkup() {
        var tickerGroup = tickerItems.map(function (item) {
            return '<span>' + escapeHtml(item) + '</span>';
        }).join("");
        return [
            '<div class="public-topbar">',
            '<div class="public-container public-topbar-inner">',
            '<div class="public-contact-list">',
            '<a class="public-contact-link public-icon-text" href="' + CONTACT.phoneHref + '">' + icon("phone") + '<span>' + CONTACT.phone + '</span></a>',
            '<a class="public-contact-link public-icon-text" href="' + CONTACT.emailHref + '">' + icon("mail") + '<span>' + CONTACT.email + '</span></a>',
            '</div>',
            '<a class="public-location public-icon-text" href="' + CONTACT.mapHref + '" target="_blank" rel="noopener">' + icon("map-pin") + '<span>' + CONTACT.address + '</span></a>',
            '<div class="public-topbar-auth" data-public-auth-actions></div>',
            '</div>',
            '</div>',
            '<header class="public-header" data-public-header-shell>',
            '<div class="public-container public-header-inner">',
            '<a class="public-brand" href="' + ROUTES.home + '" aria-label="Vinayak Academy home"><img class="public-logo" src="/logo.png" alt="Vinayak Academy & IT Solution logo" width="500" height="214"></a>',
            '<nav class="public-nav" aria-label="Primary navigation">',
            '<ul class="public-nav-list">',
            '<li class="public-nav-item"><a class="public-nav-link" href="' + ROUTES.home + '">Home</a></li>',
            '<li class="public-nav-item"><button class="public-nav-trigger" type="button" aria-expanded="false">Skill Courses ' + icon("chevron-down") + '</button><div class="public-dropdown"><div class="public-menu-list">' + menuCards(skillGroups) + '</div></div></li>',
            '<li class="public-nav-item"><button class="public-nav-trigger" type="button" aria-expanded="false">Competition Courses ' + icon("chevron-down") + '</button><div class="public-dropdown"><div class="public-menu-list">' + menuCards(competitionGroups) + '</div></div></li>',
            '<li class="public-nav-item"><button class="public-nav-trigger" type="button" aria-expanded="false">Our Services ' + icon("chevron-down") + '</button><div class="public-dropdown"><div class="public-menu-list">' + menuList(serviceLinks) + '</div></div></li>',
            '<li class="public-nav-item"><a class="public-nav-link" href="' + ROUTES.gallery + '">Course Gallery</a></li>',
            '<li class="public-nav-item"><a class="public-nav-link" href="' + ROUTES.contact + '">Contact us</a></li>',
            '</ul>',
            '</nav>',
            '<div class="public-header-actions">',
            '<a class="public-btn public-btn-primary" href="' + ROUTES.apply + '">' + icon("send") + '<span>APPLY NOW</span></a>',
            '</div>',
            '<button class="public-nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" data-public-menu-toggle>' + icon("menu") + '</button>',
            '</div>',
            '<div class="public-mobile-panel" data-public-mobile-panel>',
            '<div class="public-container public-mobile-nav">',
            '<a class="public-mobile-link" href="' + ROUTES.home + '">Home</a>',
            mobileDetails("Skill Courses", skillGroups, true),
            mobileDetails("Competition Courses", competitionGroups, true),
            mobileDetails("Our Services", serviceLinks, false),
            '<a class="public-mobile-link" href="' + ROUTES.gallery + '">Course Gallery</a>',
            '<a class="public-mobile-link" href="' + ROUTES.contact + '">Contact us</a>',
            '<a class="public-mobile-link" href="' + ROUTES.apply + '">APPLY NOW</a>',
            '<div data-public-mobile-auth></div>',
            '</div>',
            '</div>',
            '</header>',
            '<div class="public-ticker" aria-label="Professional services"><div class="public-ticker-track"><div class="public-ticker-group">' + tickerGroup + '</div><div class="public-ticker-group" aria-hidden="true">' + tickerGroup + '</div></div></div>'
        ].join("");
    }

    function footerMarkup() {
        return [
            '<footer class="public-footer">',
            '<div class="public-container public-footer-main">',
            '<section>',
            '<img class="public-footer-logo" src="/logo.png" alt="Vinayak Academy & IT Solution logo" width="500" height="214">',
            '<p>Quality computer education, competition preparation and practical IT services from Suratgarh.</p>',
            '</section>',
            '<section><h2>Quick Links</h2><nav class="public-footer-links" aria-label="Footer quick links">',
            '<a href="' + ROUTES.home + '">Home</a><a href="' + ROUTES.skillCourses + '">Skill Courses</a><a href="' + ROUTES.competitionCourses + '">Competition Courses</a><a href="' + ROUTES.gallery + '">Course Gallery</a>',
            '</nav></section>',
            '<section><h2>Services</h2><nav class="public-footer-links" aria-label="Footer service links">',
            '<a href="/services/accounting-gst">Accounting &amp; GST</a><a href="/services/website-development">Website Development</a><a href="/services/seo-services">SEO Services</a><a href="/services/creative-design">Graphic Design</a>',
            '</nav></section>',
            '<section><h2>Contact</h2><div class="public-footer-links">',
            '<a href="' + CONTACT.phoneHref + '">' + CONTACT.phone + '</a><a href="' + CONTACT.emailHref + '">' + CONTACT.email + '</a><a href="' + CONTACT.mapHref + '" target="_blank" rel="noopener">Suratgarh, Rajasthan</a>',
            '</div></section>',
            '</div>',
            '<div class="public-footer-bottom"><div class="public-container public-footer-bottom-inner"><span>Copyright ' + new Date().getFullYear() + ' Vinayak Academy &amp; IT Solution</span><span>Public website connected to existing student and admin portals</span></div></div>',
            '</footer>',
            '<button class="public-scroll-top" type="button" aria-label="Scroll to top" data-scroll-top>' + icon("arrow-up") + '</button>',
            '<a class="public-whatsapp-float" href="' + CONTACT.whatsappHref + '" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">' + icon("message-circle") + '</a>'
        ].join("");
    }

    function authButtonMarkup(session) {
        if (session && session.role === "student") {
            return '<a class="public-btn public-btn-primary public-btn-compact" href="' + ROUTES.studentDashboard + '">' + icon("layout-dashboard") + '<span>Dashboard</span></a><button class="public-btn public-btn-danger public-btn-compact" type="button" data-public-logout>' + icon("log-out") + '<span>Logout</span></button>';
        }
        if (session && session.role === "admin") {
            return '<a class="public-btn public-btn-primary public-btn-compact" href="' + ROUTES.adminDashboard + '">' + icon("shield-check") + '<span>Dashboard</span></a><button class="public-btn public-btn-danger public-btn-compact" type="button" data-public-logout>' + icon("log-out") + '<span>Logout</span></button>';
        }
        return '<a class="public-btn public-btn-secondary public-btn-compact" href="' + ROUTES.login + '?role=student">' + icon("graduation-cap") + '<span>Student Login</span></a><a class="public-btn public-btn-secondary public-btn-compact" href="' + ROUTES.login + '?role=admin">' + icon("shield") + '<span>Admin Login</span></a>';
    }

    async function resolveSession() {
        if (!window.VinayakAuth || typeof window.VinayakAuth.getValidatedSession !== "function") {
            return null;
        }
        try {
            var studentSession = await window.VinayakAuth.getValidatedSession("student");
            if (studentSession && studentSession.role === "student") return studentSession;
        } catch (error) {
            if (window.VinayakLogger) window.VinayakLogger.warn("Public student session check skipped.", error);
        }
        try {
            var adminSession = await window.VinayakAuth.getValidatedSession("admin");
            if (adminSession && adminSession.role === "admin") return adminSession;
        } catch (error) {
            if (window.VinayakLogger) window.VinayakLogger.warn("Public admin session check skipped.", error);
        }
        return null;
    }

    function bindMenus() {
        document.querySelectorAll(".public-nav-trigger").forEach(function (trigger) {
            trigger.addEventListener("click", function () {
                var item = trigger.closest(".public-nav-item");
                var isOpen = item && item.classList.toggle("is-open");
                trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
            });
        });

        document.addEventListener("click", function (event) {
            if (event.target.closest(".public-nav-item")) return;
            document.querySelectorAll(".public-nav-item.is-open").forEach(function (item) {
                item.classList.remove("is-open");
                var trigger = item.querySelector(".public-nav-trigger");
                if (trigger) trigger.setAttribute("aria-expanded", "false");
            });
        });

        document.addEventListener("keydown", function (event) {
            if (event.key !== "Escape") return;
            document.querySelectorAll(".public-nav-item.is-open").forEach(function (item) {
                item.classList.remove("is-open");
                var trigger = item.querySelector(".public-nav-trigger");
                if (trigger) trigger.setAttribute("aria-expanded", "false");
            });
        });

        var toggle = document.querySelector("[data-public-menu-toggle]");
        var panel = document.querySelector("[data-public-mobile-panel]");
        if (toggle && panel) {
            toggle.addEventListener("click", function () {
                var isOpen = panel.classList.toggle("is-open");
                toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
                toggle.innerHTML = icon(isOpen ? "x" : "menu");
                refreshIcons();
            });
        }
    }

    function bindLogout() {
        document.querySelectorAll("[data-public-logout]").forEach(function (button) {
            button.addEventListener("click", async function () {
                button.disabled = true;
                if (window.VinayakAuth && typeof window.VinayakAuth.logoutAndRedirect === "function") {
                    await window.VinayakAuth.logoutAndRedirect();
                } else {
                    window.localStorage.clear();
                    window.location.href = ROUTES.login;
                }
            });
        });
    }

    function renderAuth(session) {
        var markup = authButtonMarkup(session);
        document.querySelectorAll("[data-public-auth-actions]").forEach(function (node) {
            node.insertAdjacentHTML("beforeend", markup);
        });
        document.querySelectorAll("[data-public-mobile-auth]").forEach(function (node) {
            node.innerHTML = '<div class="public-mobile-auth-row">' + markup + '</div>';
        });
        bindLogout();
        refreshIcons();
    }

    function initHeroSlider() {
        var slider = document.querySelector("[data-hero-slider]");
        if (!slider) return;
        var slides = Array.prototype.slice.call(slider.querySelectorAll("[data-slide]"));
        var dotsHost = slider.querySelector("[data-slide-dots]");
        var prev = slider.querySelector("[data-slide-prev]");
        var next = slider.querySelector("[data-slide-next]");
        var current = 0;
        var timer = null;
        var startX = 0;
        var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (!slides.length || !dotsHost) return;

        dotsHost.innerHTML = slides.map(function (_, index) {
            return '<button class="home-slider-dot' + (index === 0 ? " is-active" : "") + '" type="button" role="tab" aria-label="Show slide ' + (index + 1) + '" aria-selected="' + (index === 0 ? "true" : "false") + '" data-slide-dot="' + index + '"></button>';
        }).join("");

        var dots = Array.prototype.slice.call(dotsHost.querySelectorAll("[data-slide-dot]"));

        function show(index) {
            current = (index + slides.length) % slides.length;
            slides.forEach(function (slide, slideIndex) {
                slide.classList.toggle("is-active", slideIndex === current);
            });
            dots.forEach(function (dot, dotIndex) {
                dot.classList.toggle("is-active", dotIndex === current);
                dot.setAttribute("aria-selected", dotIndex === current ? "true" : "false");
            });
        }

        function stop() {
            if (timer) window.clearInterval(timer);
            timer = null;
        }

        function start() {
            if (reducedMotion || timer) return;
            timer = window.setInterval(function () {
                show(current + 1);
            }, 5500);
        }

        dots.forEach(function (dot) {
            dot.addEventListener("click", function () {
                stop();
                show(Number(dot.getAttribute("data-slide-dot") || 0));
                start();
            });
        });

        if (prev) {
            prev.addEventListener("click", function () {
                stop();
                show(current - 1);
                start();
            });
        }

        if (next) {
            next.addEventListener("click", function () {
                stop();
                show(current + 1);
                start();
            });
        }

        slider.addEventListener("keydown", function (event) {
            if (event.key === "ArrowLeft") {
                stop();
                show(current - 1);
                start();
            }
            if (event.key === "ArrowRight") {
                stop();
                show(current + 1);
                start();
            }
        });

        slider.addEventListener("pointerdown", function (event) {
            startX = event.clientX;
            stop();
        });

        slider.addEventListener("pointerup", function (event) {
            var delta = event.clientX - startX;
            if (Math.abs(delta) > 42) {
                show(delta > 0 ? current - 1 : current + 1);
            }
            start();
        });

        slider.addEventListener("mouseenter", stop);
        slider.addEventListener("mouseleave", start);
        slider.setAttribute("tabindex", "0");
        start();
    }

    function bindScrollTop() {
        var button = document.querySelector("[data-scroll-top]");
        if (!button) return;
        function update() {
            button.classList.toggle("is-visible", window.scrollY > 480);
        }
        button.addEventListener("click", function () {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
        window.addEventListener("scroll", update, { passive: true });
        update();
    }

    function refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    async function init() {
        var headerTarget = document.querySelector("[data-public-header]");
        var footerTarget = document.querySelector("[data-public-footer]");
        if (headerTarget) headerTarget.innerHTML = headerMarkup();
        if (footerTarget) footerTarget.innerHTML = footerMarkup();
        bindMenus();
        renderAuth(await resolveSession());
        initHeroSlider();
        bindScrollTop();
        refreshIcons();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
}());
