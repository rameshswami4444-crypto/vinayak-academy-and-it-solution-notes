(function () {
    const WORKER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const PDFJS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    const MIN_SCALE = 0.45;
    const MAX_SCALE = 3.25;
    const ZOOM_STEP = 0.14;
    let pdfLibPromise = null;
    let pdfDoc = null;
    let activeNote = null;
    let scale = 1;
    let fitMode = "width";
    let currentPage = 1;
    let observer = null;
    let scrollRaf = 0;
    let resizeTimer = 0;
    let pinchZoomTimer = 0;
    let pinchStartDistance = 0;
    let pinchStartScale = 1;
    let visiblePages = new Set();
    let renderedPages = new Map();
    let renderingPages = new Map();
    let watermarkText = "";

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function loadPdfJs() {
        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
            return Promise.resolve(window.pdfjsLib);
        }
        if (pdfLibPromise) return pdfLibPromise;
        pdfLibPromise = new Promise(function (resolve, reject) {
            const script = document.createElement("script");
            script.src = PDFJS_SRC;
            script.async = true;
            script.onload = function () {
                if (!window.pdfjsLib) {
                    reject(new Error("PDF viewer library failed to load."));
                    return;
                }
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
                resolve(window.pdfjsLib);
            };
            script.onerror = function () {
                reject(new Error("PDF viewer library failed to load."));
            };
            document.head.appendChild(script);
        });
        return pdfLibPromise;
    }

    function ensureModal() {
        let modal = byId("studentPdfModal");
        if (modal) return modal;
        modal = document.createElement("section");
        modal.id = "studentPdfModal";
        modal.className = "student-pdf-modal premium-pdf-viewer";
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("role", "dialog");
        modal.hidden = true;
        modal.innerHTML = [
            '<div class="student-pdf-modal-card" id="studentPdfModalCard">',
            '<header class="student-pdf-modal-toolbar">',
            '<button type="button" class="student-pdf-tool student-pdf-back" data-pdf-back title="Back"><i class="fas fa-arrow-left"></i><span>Back</span></button>',
            '<div class="student-pdf-doc-meta">',
            '<strong id="studentPdfTitle">Study Material</strong>',
            '<span id="studentPdfSubject">PDF</span>',
            '</div>',
            '<div class="student-pdf-modal-controls">',
            '<span class="student-pdf-page" id="studentPdfPageInfo">Page - of -</span>',
            '<button type="button" class="student-pdf-tool" data-pdf-zoom-out title="Zoom out"><i class="fas fa-minus"></i></button>',
            '<span class="student-pdf-zoom" id="studentPdfZoomInfo">100%</span>',
            '<button type="button" class="student-pdf-tool" data-pdf-zoom-in title="Zoom in"><i class="fas fa-plus"></i></button>',
            '<button type="button" class="student-pdf-tool text" data-pdf-fit-width title="Fit width">Fit Width</button>',
            '<button type="button" class="student-pdf-tool text" data-pdf-fit-page title="Fit page">Fit Page</button>',
            '<button type="button" class="student-pdf-tool" data-pdf-fullscreen title="Fullscreen"><i class="fas fa-expand"></i></button>',
            '<button type="button" class="student-pdf-tool student-pdf-search" title="Search coming soon" aria-disabled="true"><i class="fas fa-magnifying-glass"></i><span>Search</span></button>',
            '<button type="button" class="student-pdf-tool close" data-pdf-close title="Close"><i class="fas fa-xmark"></i></button>',
            '</div>',
            '</header>',
            '<div class="student-pdf-modal-stage" id="studentPdfModalStage">',
            '<div class="student-pdf-modal-loader" id="studentPdfModalLoader"><span></span><strong>Loading secure PDF...</strong></div>',
            '<div class="student-pdf-pages" id="studentPdfPages" aria-label="PDF pages"></div>',
            '</div>',
            '<div class="student-pdf-devtools-warning" id="studentPdfDevtoolsWarning" hidden><strong>Sharing warning</strong><span>This document is for enrolled students only.</span></div>',
            '</div>'
        ].join("");
        document.body.appendChild(modal);
        bindModal(modal);
        return modal;
    }

    function setLoading(show, message) {
        const loader = byId("studentPdfModalLoader");
        if (!loader) return;
        loader.hidden = !show;
        const text = loader.querySelector("strong");
        if (text && message) text.textContent = message;
    }

    function setError(message) {
        const pages = byId("studentPdfPages");
        setLoading(false);
        if (!pages) return;
        pages.innerHTML = '<div class="student-pdf-modal-error"><i class="fas fa-triangle-exclamation"></i><strong>Could not open PDF</strong><p>' + escapeHtml(message || "Please try again.") + '</p></div>';
    }

    function updateToolbar() {
        const pageInfo = byId("studentPdfPageInfo");
        const zoomInfo = byId("studentPdfZoomInfo");
        if (pageInfo) pageInfo.textContent = "Page " + currentPage + " of " + (pdfDoc ? pdfDoc.numPages : "-");
        if (zoomInfo) zoomInfo.textContent = Math.round(scale * 100) + "%";
    }

    function setDocumentMeta(note) {
        const title = byId("studentPdfTitle");
        const subject = byId("studentPdfSubject");
        if (title) title.textContent = note && note.title ? note.title : "Study Material";
        if (subject) subject.textContent = note && note.subject ? note.subject : "PDF";
    }

    function getStage() {
        return byId("studentPdfModalStage");
    }

    function getPagesRoot() {
        return byId("studentPdfPages");
    }

    function makeWatermarkText() {
        const now = new Date();
        let studentId = "";
        try {
            studentId = window.VinayakAuth && window.VinayakAuth.getStoredStudentId ? window.VinayakAuth.getStoredStudentId() : "";
        } catch (error) {
            studentId = "";
        }
        return ["Vinayak Academy", studentId ? "Student ID: " + studentId : "Enrolled Student", now.toLocaleString()].join(" | ");
    }

    async function calculateScale() {
        if (!pdfDoc) return 1;
        const page = await pdfDoc.getPage(currentPage || 1);
        const viewport = page.getViewport({ scale: 1 });
        const stage = getStage();
        const widthScale = Math.max(MIN_SCALE, ((stage ? stage.clientWidth : window.innerWidth) - 76) / viewport.width);
        const heightScale = Math.max(MIN_SCALE, ((stage ? stage.clientHeight : window.innerHeight) - 120) / viewport.height);
        return fitMode === "page" ? clamp(Math.min(widthScale, heightScale), MIN_SCALE, MAX_SCALE) : clamp(widthScale, MIN_SCALE, MAX_SCALE);
    }

    async function applyFitScale() {
        if (fitMode === "width" || fitMode === "page") {
            scale = await calculateScale();
        }
        updateToolbar();
    }

    function createPageShells() {
        const root = getPagesRoot();
        if (!root || !pdfDoc) return;
        const shells = [];
        for (let index = 1; index <= pdfDoc.numPages; index += 1) {
            shells.push([
                '<article class="student-pdf-page-shell" data-page-number="', index, '">',
                '<div class="student-pdf-page-skeleton"><span></span><strong>Page ', index, '</strong></div>',
                '<div class="student-pdf-watermark">', escapeHtml(watermarkText), '</div>',
                '</article>'
            ].join(""));
        }
        root.innerHTML = shells.join("");
    }

    function cleanupRenderState() {
        renderedPages.clear();
        renderingPages.clear();
        visiblePages.clear();
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    function getPageShell(number) {
        return document.querySelector('.student-pdf-page-shell[data-page-number="' + number + '"]');
    }

    async function renderPage(number) {
        if (!pdfDoc || renderedPages.has(number) || renderingPages.has(number)) return;
        const shell = getPageShell(number);
        if (!shell) return;
        renderingPages.set(number, true);
        shell.classList.add("is-rendering");
        try {
            const page = await pdfDoc.getPage(number);
            const viewport = page.getViewport({ scale: scale });
            const ratio = window.devicePixelRatio || 1;
            const canvas = document.createElement("canvas");
            canvas.draggable = false;
            canvas.setAttribute("aria-label", "Page " + number);
            canvas.width = Math.floor(viewport.width * ratio);
            canvas.height = Math.floor(viewport.height * ratio);
            canvas.style.width = Math.floor(viewport.width) + "px";
            canvas.style.height = Math.floor(viewport.height) + "px";
            const context = canvas.getContext("2d", { alpha: false });
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            shell.querySelectorAll("canvas").forEach(function (oldCanvas) { oldCanvas.remove(); });
            shell.appendChild(canvas);
            shell.classList.add("is-rendered");
            shell.classList.remove("is-rendering");
            renderedPages.set(number, canvas);
        } catch (error) {
            console.error("PDF page render failed", error);
            shell.innerHTML = '<div class="student-pdf-modal-error"><strong>Page failed to render</strong><p>Please scroll away and try again.</p></div>';
        } finally {
            renderingPages.delete(number);
        }
    }

    function unloadFarPages() {
        if (!pdfDoc) return;
        renderedPages.forEach(function (canvas, number) {
            if (Math.abs(number - currentPage) <= 3 || visiblePages.has(number)) return;
            const shell = getPageShell(number);
            if (!shell) return;
            canvas.remove();
            shell.classList.remove("is-rendered");
            renderedPages.delete(number);
        });
    }

    function observePages() {
        const stage = getStage();
        if (!stage || !window.IntersectionObserver) {
            renderPage(1);
            return;
        }
        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                const number = Number(entry.target.getAttribute("data-page-number"));
                if (!number) return;
                if (entry.isIntersecting) {
                    visiblePages.add(number);
                    renderPage(number);
                    if (number + 1 <= pdfDoc.numPages) renderPage(number + 1);
                } else {
                    visiblePages.delete(number);
                }
            });
            updateCurrentPageFromScroll();
            unloadFarPages();
        }, {
            root: stage,
            rootMargin: "720px 0px",
            threshold: [0.01, 0.2, 0.6]
        });
        document.querySelectorAll(".student-pdf-page-shell").forEach(function (shell) {
            observer.observe(shell);
        });
    }

    function updateCurrentPageFromScroll() {
        const stage = getStage();
        if (!stage) return;
        const stageRect = stage.getBoundingClientRect();
        const center = stageRect.top + stageRect.height * 0.45;
        let best = currentPage;
        let bestDistance = Infinity;
        document.querySelectorAll(".student-pdf-page-shell").forEach(function (shell) {
            const rect = shell.getBoundingClientRect();
            const distance = Math.abs((rect.top + rect.height / 2) - center);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = Number(shell.getAttribute("data-page-number")) || best;
            }
        });
        if (best !== currentPage) {
            currentPage = best;
            updateToolbar();
        }
    }

    function onScroll() {
        if (scrollRaf) return;
        scrollRaf = window.requestAnimationFrame(function () {
            scrollRaf = 0;
            updateCurrentPageFromScroll();
            unloadFarPages();
        });
    }

    function scrollToPage(number) {
        const shell = getPageShell(number);
        if (shell) shell.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function rerenderVisible(keepPage) {
        const pageToKeep = keepPage || currentPage;
        const root = getPagesRoot();
        if (root) root.classList.add("is-zooming");
        await applyFitScale();
        renderedPages.forEach(function (canvas) { canvas.remove(); });
        renderedPages.clear();
        renderingPages.clear();
        document.querySelectorAll(".student-pdf-page-shell").forEach(function (shell) {
            shell.classList.remove("is-rendered", "is-rendering");
        });
        const toRender = Array.from(visiblePages);
        if (!toRender.includes(pageToKeep)) toRender.push(pageToKeep);
        await Promise.all(toRender.map(renderPage));
        scrollToPage(pageToKeep);
        window.setTimeout(function () {
            if (root) root.classList.remove("is-zooming");
        }, 220);
    }

    function setManualZoom(nextScale) {
        fitMode = "custom";
        scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
        updateToolbar();
        rerenderVisible(currentPage);
    }

    function setPinchZoom(nextScale) {
        fitMode = "custom";
        scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
        updateToolbar();
        window.clearTimeout(pinchZoomTimer);
        pinchZoomTimer = window.setTimeout(function () {
            rerenderVisible(currentPage);
        }, 90);
    }

    function setFit(mode) {
        fitMode = mode;
        rerenderVisible(currentPage);
    }

    function goPage(delta) {
        if (!pdfDoc) return;
        currentPage = clamp(currentPage + delta, 1, pdfDoc.numPages);
        updateToolbar();
        renderPage(currentPage);
        scrollToPage(currentPage);
    }

    function toggleFullscreen() {
        const card = byId("studentPdfModalCard");
        if (!document.fullscreenElement && card && card.requestFullscreen) {
            card.requestFullscreen();
        } else if (document.fullscreenElement) {
            document.exitFullscreen().catch(function () {});
        }
    }

    function close() {
        const modal = byId("studentPdfModal");
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove("student-pdf-open", "student-pdf-fullscreen-active");
        if (document.fullscreenElement && document.fullscreenElement.id === "studentPdfModalCard") {
            document.exitFullscreen().catch(function () {});
        }
        cleanupRenderState();
        pdfDoc = null;
        activeNote = null;
        currentPage = 1;
    }

    function updateFullscreenState() {
        const isActive = Boolean(document.fullscreenElement && document.fullscreenElement.id === "studentPdfModalCard");
        document.body.classList.toggle("student-pdf-fullscreen-active", isActive);
        const icon = document.querySelector("[data-pdf-fullscreen] i");
        if (icon) icon.className = isActive ? "fas fa-compress" : "fas fa-expand";
        if (pdfDoc && (fitMode === "width" || fitMode === "page")) {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(function () { rerenderVisible(currentPage); }, 120);
        }
    }

    function maybeShowDevtoolsWarning() {
        const warning = byId("studentPdfDevtoolsWarning");
        if (!warning) return;
        const widthGap = window.outerWidth - window.innerWidth;
        const heightGap = window.outerHeight - window.innerHeight;
        warning.hidden = !(widthGap > 180 || heightGap > 180);
    }

    function bindModal(modal) {
        modal.addEventListener("contextmenu", function (event) { event.preventDefault(); });
        modal.addEventListener("dragstart", function (event) { event.preventDefault(); });
        modal.addEventListener("drop", function (event) { event.preventDefault(); });
        modal.addEventListener("click", function (event) {
            if (event.target.closest("[data-pdf-back]") || event.target.closest("[data-pdf-close]")) close();
            if (event.target.closest("[data-pdf-zoom-out]")) setManualZoom(scale - ZOOM_STEP);
            if (event.target.closest("[data-pdf-zoom-in]")) setManualZoom(scale + ZOOM_STEP);
            if (event.target.closest("[data-pdf-fit-width]")) setFit("width");
            if (event.target.closest("[data-pdf-fit-page]")) setFit("page");
            if (event.target.closest("[data-pdf-fullscreen]")) toggleFullscreen();
        });
        modal.addEventListener("dblclick", function (event) {
            if (event.target.closest(".student-pdf-modal-toolbar")) return;
            toggleFullscreen();
        });
        const stage = modal.querySelector("#studentPdfModalStage");
        if (stage) stage.addEventListener("scroll", onScroll, { passive: true });
        modal.addEventListener("wheel", function (event) {
            if (!event.ctrlKey) return;
            event.preventDefault();
            setManualZoom(scale + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
        }, { passive: false });
        modal.addEventListener("touchstart", function (event) {
            if (event.touches.length === 2) {
                const dx = event.touches[0].clientX - event.touches[1].clientX;
                const dy = event.touches[0].clientY - event.touches[1].clientY;
                pinchStartDistance = Math.hypot(dx, dy);
                pinchStartScale = scale;
            }
        }, { passive: true });
        modal.addEventListener("touchmove", function (event) {
            if (event.touches.length !== 2 || !pinchStartDistance) return;
            event.preventDefault();
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            const nextDistance = Math.hypot(dx, dy);
            setPinchZoom(pinchStartScale * (nextDistance / pinchStartDistance));
        }, { passive: false });
        modal.addEventListener("touchend", function () {
            pinchStartDistance = 0;
        }, { passive: true });
        window.addEventListener("keydown", function (event) {
            if (modal.hidden) return;
            if (event.key === "Escape") {
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(function () {});
                } else {
                    close();
                }
            }
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") goPage(-1);
            if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === " ") goPage(1);
            if (event.key === "+" || event.key === "=") setManualZoom(scale + ZOOM_STEP);
            if (event.key === "-") setManualZoom(scale - ZOOM_STEP);
            if (event.key.toLowerCase() === "f") setFit("width");
        });
        window.addEventListener("resize", function () {
            maybeShowDevtoolsWarning();
            if (!modal.hidden && (fitMode === "width" || fitMode === "page")) {
                window.clearTimeout(resizeTimer);
                resizeTimer = window.setTimeout(function () { rerenderVisible(currentPage); }, 160);
            }
        });
        document.addEventListener("fullscreenchange", updateFullscreenState);
    }

    async function openNote(noteOrId) {
        const modal = ensureModal();
        modal.hidden = false;
        document.body.classList.add("student-pdf-open");
        setLoading(true, "Checking access...");
        cleanupRenderState();
        pdfDoc = null;
        activeNote = null;
        currentPage = 1;
        scale = 1;
        fitMode = "width";
        const root = getPagesRoot();
        if (root) root.innerHTML = "";
        updateToolbar();
        maybeShowDevtoolsWarning();
        try {
            if (!window.VinayakNotesPage) throw new Error("Study material service is not loaded.");
            const note = typeof noteOrId === "object" ? noteOrId : await window.VinayakNotesPage.fetchNoteById(noteOrId);
            activeNote = note;
            setDocumentMeta(note);
            watermarkText = makeWatermarkText();
            const pdfjsLib = await loadPdfJs();
            const signedUrl = await window.VinayakNotesPage.createSignedUrl(note);
            setLoading(true, "Opening secure PDF...");
            pdfDoc = await pdfjsLib.getDocument({
                url: signedUrl,
                disableAutoFetch: true,
                disableStream: false,
                isEvalSupported: false
            }).promise;
            await applyFitScale();
            createPageShells();
            updateToolbar();
            setLoading(false);
            await renderPage(1);
            observePages();
        } catch (error) {
            console.error("PDF modal viewer failed", error);
            setError(error.message || "Could not open this PDF.");
        }
    }

    window.VinayakPdfModal = {
        openNote: openNote,
        close: close
    };
}());
