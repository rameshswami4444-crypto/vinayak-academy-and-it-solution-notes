(function () {
    const WORKER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const PDFJS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    const MIN_SCALE = 0.5;
    const MAX_SCALE = 3;
    const ZOOM_LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
    const MAX_CONCURRENT_RENDERS = 1;
    const KEEP_PAGE_RADIUS = 5;
    const QUEUE_PAGE_RADIUS = 2;
    const MAX_CANVAS_PIXELS = 9000000;
    const ZOOM_DEBOUNCE_MS = 140;
    const RESIZE_DEBOUNCE_MS = 180;
    const TOOLBAR_HIDE_MS = 2400;

    let pdfLibPromise = null;
    let pdfDoc = null;
    let activeNote = null;
    let scale = 1;
    let visualScale = 1;
    let fitMode = "width";
    let currentPage = 1;
    let renderGeneration = 0;
    let activeRenderCount = 0;
    let observer = null;
    let scrollRaf = 0;
    let resizeTimer = 0;
    let zoomTimer = 0;
    let toolbarTimer = 0;
    let lastScrollTop = 0;
    let toolbarPointerInside = false;
    let pinchStartDistance = 0;
    let pinchStartScale = 1;
    let visiblePages = new Set();
    let queuedPages = new Map();
    let renderedPages = new Map();
    let renderingPages = new Map();
    let pageSizeCache = new Map();
    let pagePromises = new Map();
    let defaultPageSize = { width: 720, height: 930 };
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
            '<div class="student-pdf-modal-card toolbar-visible" id="studentPdfModalCard">',
            '<div class="student-pdf-toolbar-reveal" data-pdf-toolbar-reveal></div>',
            '<header class="student-pdf-modal-toolbar" id="studentPdfToolbar">',
            '<button type="button" class="student-pdf-tool student-pdf-back" data-pdf-back title="Back"><i class="fas fa-arrow-left"></i><span>Back</span></button>',
            '<div class="student-pdf-doc-meta">',
            '<strong id="studentPdfTitle">Study Material</strong>',
            '<span id="studentPdfSubject">PDF</span>',
            '</div>',
            '<div class="student-pdf-modal-controls">',
            '<button type="button" class="student-pdf-tool" data-pdf-prev title="Previous page"><i class="fas fa-chevron-left"></i></button>',
            '<label class="student-pdf-page-control"><input id="studentPdfPageInput" inputmode="numeric" value="1" aria-label="Page number"><span id="studentPdfPageTotal">/ -</span></label>',
            '<button type="button" class="student-pdf-tool" data-pdf-next title="Next page"><i class="fas fa-chevron-right"></i></button>',
            '<button type="button" class="student-pdf-tool" data-pdf-zoom-out title="Zoom out"><i class="fas fa-minus"></i></button>',
            '<span class="student-pdf-zoom" id="studentPdfZoomInfo">100%</span>',
            '<button type="button" class="student-pdf-tool" data-pdf-zoom-in title="Zoom in"><i class="fas fa-plus"></i></button>',
            '<button type="button" class="student-pdf-tool text" data-pdf-fit-width title="Fit width">Fit Width</button>',
            '<button type="button" class="student-pdf-tool text" data-pdf-fit-page title="Fit page">Fit Page</button>',
            '<button type="button" class="student-pdf-tool text" data-pdf-actual-size title="Actual size">100%</button>',
            '<button type="button" class="student-pdf-tool" data-pdf-fullscreen title="Fullscreen"><i class="fas fa-expand"></i></button>',
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

    function getStage() {
        return byId("studentPdfModalStage");
    }

    function getPagesRoot() {
        return byId("studentPdfPages");
    }

    function getShell(number) {
        return document.querySelector('.student-pdf-page-shell[data-page-number="' + number + '"]');
    }

    function setLoading(show, message) {
        const loader = byId("studentPdfModalLoader");
        if (!loader) return;
        loader.hidden = !show;
        const text = loader.querySelector("strong");
        if (text && message) text.textContent = message;
    }

    function setError(message) {
        const pages = getPagesRoot();
        setLoading(false);
        if (!pages) return;
        pages.innerHTML = '<div class="student-pdf-modal-error"><i class="fas fa-triangle-exclamation"></i><strong>Could not open PDF</strong><p>' + escapeHtml(message || "Please try again.") + '</p></div>';
    }

    function showToolbar(reason) {
        const card = byId("studentPdfModalCard");
        if (!card) return;
        card.classList.add("toolbar-visible");
        card.classList.remove("toolbar-hidden");
        window.clearTimeout(toolbarTimer);
        if (reason === "focus" || toolbarPointerInside) return;
        toolbarTimer = window.setTimeout(function () {
            if (!toolbarPointerInside && document.activeElement !== byId("studentPdfPageInput")) hideToolbar();
        }, TOOLBAR_HIDE_MS);
    }

    function hideToolbar() {
        const card = byId("studentPdfModalCard");
        if (!card || toolbarPointerInside) return;
        if (document.activeElement === byId("studentPdfPageInput")) return;
        card.classList.add("toolbar-hidden");
        card.classList.remove("toolbar-visible");
    }

    function updateToolbar() {
        const input = byId("studentPdfPageInput");
        const total = byId("studentPdfPageTotal");
        const zoomInfo = byId("studentPdfZoomInfo");
        if (input && document.activeElement !== input) input.value = String(currentPage);
        if (total) total.textContent = "/ " + (pdfDoc ? pdfDoc.numPages : "-");
        if (zoomInfo) zoomInfo.textContent = Math.round(scale * 100) + "%";
        document.querySelectorAll("[data-pdf-fit-width], [data-pdf-fit-page], [data-pdf-actual-size]").forEach(function (button) {
            button.classList.remove("active");
        });
        const active = fitMode === "width" ? "[data-pdf-fit-width]" : fitMode === "page" ? "[data-pdf-fit-page]" : Math.abs(scale - 1) < 0.001 ? "[data-pdf-actual-size]" : "";
        if (active) {
            const button = document.querySelector(active);
            if (button) button.classList.add("active");
        }
    }

    function setDocumentMeta(note) {
        const title = byId("studentPdfTitle");
        const subject = byId("studentPdfSubject");
        if (title) title.textContent = note && note.title ? note.title : "Study Material";
        if (subject) subject.textContent = note && note.subject ? note.subject : "PDF";
    }

    function makeWatermarkText() {
        const now = new Date();
        let studentId = "";
        let studentName = "";
        try {
            studentId = window.VinayakAuth && window.VinayakAuth.getStoredStudentId ? window.VinayakAuth.getStoredStudentId() : "";
            const raw = window.localStorage.getItem("student_session") || window.localStorage.getItem("vinayak_session") || "";
            const session = raw ? JSON.parse(raw) : null;
            studentName = session && (session.studentName || session.name) ? (session.studentName || session.name) : "";
            if (!studentName) {
                const nameNode = document.querySelector("[data-layout-student-name], [data-home-student-name]");
                studentName = nameNode ? String(nameNode.textContent || "").trim() : "";
            }
        } catch (error) {
            studentId = "";
            studentName = "";
        }
        return ["Vinayak Academy", studentName || "Enrolled Student", studentId ? "Student ID: " + studentId : "", now.toLocaleString()].filter(Boolean).join(" | ");
    }

    function getPage(number) {
        if (pagePromises.has(number)) return pagePromises.get(number);
        const promise = pdfDoc.getPage(number);
        pagePromises.set(number, promise);
        return promise;
    }

    async function getBasePageSize(number) {
        if (pageSizeCache.has(number)) return pageSizeCache.get(number);
        const page = await getPage(number);
        const viewport = page.getViewport({ scale: 1 });
        const size = { width: viewport.width, height: viewport.height };
        pageSizeCache.set(number, size);
        if (number === 1) defaultPageSize = size;
        return size;
    }

    async function calculateScale(mode) {
        if (!pdfDoc) return 1;
        const pageSize = await getBasePageSize(currentPage || 1);
        const stage = getStage();
        const isMobile = window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
        const horizontalPadding = isMobile ? 18 : 72;
        const verticalPadding = isMobile ? 80 : 96;
        const availableWidth = Math.max(220, (stage ? stage.clientWidth : window.innerWidth) - horizontalPadding);
        const availableHeight = Math.max(260, (stage ? stage.clientHeight : window.innerHeight) - verticalPadding);
        const widthScale = availableWidth / pageSize.width;
        const heightScale = availableHeight / pageSize.height;
        return clamp(mode === "page" ? Math.min(widthScale, heightScale) : widthScale, MIN_SCALE, MAX_SCALE);
    }

    async function applyFitScale() {
        if (fitMode === "width" || fitMode === "page") {
            scale = await calculateScale(fitMode);
            visualScale = scale;
        }
        updateToolbar();
    }

    async function createPageShells() {
        const root = getPagesRoot();
        if (!root || !pdfDoc) return;
        defaultPageSize = await getBasePageSize(1);
        const shellWidth = defaultPageSize.width * visualScale;
        const shellHeight = defaultPageSize.height * visualScale;
        const shells = [];
        for (let index = 1; index <= pdfDoc.numPages; index += 1) {
            shells.push([
                '<article class="student-pdf-page-shell" data-page-number="', index, '" style="width: ', shellWidth.toFixed(2), 'px; min-height: ', shellHeight.toFixed(2), 'px; aspect-ratio: ', defaultPageSize.width, ' / ', defaultPageSize.height, ';">',
                '<div class="student-pdf-page-skeleton"><span></span><strong>Page ', index, '</strong></div>',
                '<div class="student-pdf-watermark">', escapeHtml(watermarkText), '</div>',
                '</article>'
            ].join(""));
        }
        root.innerHTML = shells.join("");
    }

    function updateShellSizes(skipAnchor) {
        if (!pdfDoc) return;
        const anchor = skipAnchor ? null : getReadingAnchor();
        document.querySelectorAll(".student-pdf-page-shell").forEach(function (shell) {
            const number = Number(shell.getAttribute("data-page-number"));
            const size = pageSizeCache.get(number) || defaultPageSize;
            shell.style.width = (size.width * visualScale).toFixed(2) + "px";
            shell.style.minHeight = (size.height * visualScale).toFixed(2) + "px";
            shell.style.aspectRatio = size.width + " / " + size.height;
        });
        if (anchor) restoreReadingAnchor(anchor, false);
    }

    function cleanupRenderState() {
        renderedPages.clear();
        queuedPages.clear();
        visiblePages.clear();
        pageSizeCache.clear();
        pagePromises.clear();
        renderingPages.forEach(function (entry) {
            try {
                if (entry.task) entry.task.cancel();
            } catch (error) {}
        });
        renderingPages.clear();
        activeRenderCount = 0;
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    function getRenderPixelRatio(viewport) {
        const deviceRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        const pixels = viewport.width * viewport.height * deviceRatio * deviceRatio;
        if (pixels <= MAX_CANVAS_PIXELS) return deviceRatio;
        return Math.max(1, Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)));
    }

    function setCanvasVisualScale(entry) {
        if (!entry || !entry.canvas) return;
        const factor = visualScale / entry.renderScale;
        entry.canvas.style.transform = "scale(" + factor + ")";
        entry.canvas.style.transformOrigin = "top left";
        entry.canvas.style.width = entry.cssWidth.toFixed(2) + "px";
        entry.canvas.style.height = entry.cssHeight.toFixed(2) + "px";
    }

    function applyImmediateVisualScale(nextScale) {
        visualScale = nextScale;
        updateShellSizes(false);
        renderedPages.forEach(setCanvasVisualScale);
    }

    function queuePage(number, priority, force) {
        if (!pdfDoc || number < 1 || number > pdfDoc.numPages) return;
        const rendered = renderedPages.get(number);
        if (rendered && !force && Math.abs(rendered.renderScale - scale) < 0.001) return;
        const existing = queuedPages.get(number);
        if (!existing || priority < existing.priority || force) {
            queuedPages.set(number, { number: number, priority: priority, generation: renderGeneration, force: Boolean(force) });
        }
        pumpRenderQueue();
    }

    function enqueueNearbyPages(page, force) {
        if (!pdfDoc) return;
        queuePage(page, 0, force);
        visiblePages.forEach(function (number) {
            queuePage(number, Math.abs(number - page), force);
        });
        for (let offset = 1; offset <= QUEUE_PAGE_RADIUS; offset += 1) {
            queuePage(page + offset, offset + 1, force);
            queuePage(page - offset, offset + 1, force);
        }
    }

    function pumpRenderQueue() {
        if (!pdfDoc) return;
        while (activeRenderCount < MAX_CONCURRENT_RENDERS && queuedPages.size) {
            const next = Array.from(queuedPages.values()).sort(function (a, b) {
                if (a.priority !== b.priority) return a.priority - b.priority;
                return Math.abs(a.number - currentPage) - Math.abs(b.number - currentPage);
            })[0];
            queuedPages.delete(next.number);
            startRender(next);
        }
    }

    async function startRender(job) {
        const number = job.number;
        const shell = getShell(number);
        if (!shell || !pdfDoc) return;
        const existingRender = renderingPages.get(number);
        if (existingRender) {
            try {
                if (existingRender.task) existingRender.task.cancel();
            } catch (error) {}
        }
        activeRenderCount += 1;
        const renderScale = scale;
        const generation = renderGeneration;
        shell.classList.add("is-rendering");
        try {
            const page = await getPage(number);
            const viewport = page.getViewport({ scale: renderScale });
            pageSizeCache.set(number, { width: viewport.width / renderScale, height: viewport.height / renderScale });
            shell.style.width = (viewport.width * (visualScale / renderScale)).toFixed(2) + "px";
            shell.style.minHeight = (viewport.height * (visualScale / renderScale)).toFixed(2) + "px";
            shell.style.aspectRatio = (viewport.width / renderScale) + " / " + (viewport.height / renderScale);
            const ratio = getRenderPixelRatio(viewport);
            const canvas = document.createElement("canvas");
            canvas.draggable = false;
            canvas.setAttribute("aria-label", "Page " + number);
            canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
            canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
            canvas.style.width = viewport.width.toFixed(2) + "px";
            canvas.style.height = viewport.height.toFixed(2) + "px";
            canvas.style.transformOrigin = "top left";
            const context = canvas.getContext("2d", { alpha: false });
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            const task = page.render({ canvasContext: context, viewport: viewport });
            renderingPages.set(number, { task: task, generation: generation });
            await task.promise;
            if (generation !== renderGeneration || Math.abs(renderScale - scale) > 0.001) {
                canvas.width = 1;
                canvas.height = 1;
                return;
            }
            const previous = renderedPages.get(number);
            if (previous && previous.canvas) previous.canvas.remove();
            shell.querySelectorAll("canvas").forEach(function (oldCanvas) { oldCanvas.remove(); });
            shell.appendChild(canvas);
            shell.classList.add("is-rendered");
            renderedPages.set(number, {
                canvas: canvas,
                renderScale: renderScale,
                cssWidth: viewport.width,
                cssHeight: viewport.height
            });
            setCanvasVisualScale(renderedPages.get(number));
        } catch (error) {
            if (error && error.name !== "RenderingCancelledException") {
                console.error("PDF page render failed", { page: number, message: error.message });
                shell.classList.add("is-render-error");
            }
        } finally {
            renderingPages.delete(number);
            shell.classList.remove("is-rendering");
            activeRenderCount = Math.max(0, activeRenderCount - 1);
            unloadFarPages();
            pumpRenderQueue();
        }
    }

    function unloadFarPages() {
        if (!pdfDoc) return;
        renderedPages.forEach(function (entry, number) {
            if (Math.abs(number - currentPage) <= KEEP_PAGE_RADIUS || visiblePages.has(number)) return;
            if (entry.canvas) {
                entry.canvas.width = 1;
                entry.canvas.height = 1;
                entry.canvas.remove();
            }
            const shell = getShell(number);
            if (shell) shell.classList.remove("is-rendered");
            renderedPages.delete(number);
        });
        renderingPages.forEach(function (entry, number) {
            if (Math.abs(number - currentPage) <= KEEP_PAGE_RADIUS || visiblePages.has(number)) return;
            try {
                if (entry.task) entry.task.cancel();
            } catch (error) {}
            renderingPages.delete(number);
        });
    }

    function observePages() {
        const stage = getStage();
        if (!stage || !window.IntersectionObserver) {
            enqueueNearbyPages(1, true);
            return;
        }
        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                const number = Number(entry.target.getAttribute("data-page-number"));
                if (!number) return;
                if (entry.isIntersecting) visiblePages.add(number);
                else visiblePages.delete(number);
            });
            updateCurrentPageFromScroll();
            enqueueNearbyPages(currentPage, false);
            unloadFarPages();
        }, {
            root: stage,
            rootMargin: "820px 0px",
            threshold: [0.01, 0.25, 0.6]
        });
        document.querySelectorAll(".student-pdf-page-shell").forEach(function (shell) {
            observer.observe(shell);
        });
    }

    function updateCurrentPageFromScroll() {
        const stage = getStage();
        if (!stage) return;
        const stageRect = stage.getBoundingClientRect();
        const center = stageRect.top + stageRect.height * 0.46;
        let best = currentPage;
        let bestDistance = Infinity;
        document.querySelectorAll(".student-pdf-page-shell").forEach(function (shell) {
            const rect = shell.getBoundingClientRect();
            if (rect.bottom < stageRect.top || rect.top > stageRect.bottom) return;
            const distance = Math.abs((rect.top + rect.height / 2) - center);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = Number(shell.getAttribute("data-page-number")) || best;
            }
        });
        if (best !== currentPage) {
            currentPage = best;
            updateToolbar();
            enqueueNearbyPages(currentPage, false);
        }
    }

    function onScroll() {
        const stage = getStage();
        if (stage) {
            const nextTop = stage.scrollTop;
            if (nextTop > lastScrollTop + 8) hideToolbar();
            if (nextTop < lastScrollTop - 12) showToolbar("scroll-up");
            lastScrollTop = nextTop;
        }
        if (scrollRaf) return;
        scrollRaf = window.requestAnimationFrame(function () {
            scrollRaf = 0;
            updateCurrentPageFromScroll();
            unloadFarPages();
        });
    }

    function getReadingAnchor() {
        const stage = getStage();
        const shell = getShell(currentPage);
        if (!stage || !shell) return { page: currentPage, ratio: 0 };
        const rawOffset = stage.scrollTop - shell.offsetTop;
        return { page: currentPage, ratio: shell.offsetHeight ? clamp(rawOffset / shell.offsetHeight, 0, 1) : 0 };
    }

    function restoreReadingAnchor(anchor, smooth) {
        const stage = getStage();
        const shell = getShell(anchor && anchor.page);
        if (!stage || !shell) return;
        const target = shell.offsetTop + shell.offsetHeight * (anchor.ratio || 0);
        stage.scrollTo({ top: Math.max(0, target), behavior: smooth ? "smooth" : "auto" });
    }

    function scrollToPage(number) {
        if (!pdfDoc) return;
        currentPage = clamp(number, 1, pdfDoc.numPages);
        updateToolbar();
        restoreReadingAnchor({ page: currentPage, ratio: 0 }, true);
        enqueueNearbyPages(currentPage, true);
        showToolbar("nav");
    }

    function nearestZoomLevel(direction) {
        if (direction > 0) return ZOOM_LEVELS.find(function (level) { return level > scale + 0.001; }) || MAX_SCALE;
        const reversed = ZOOM_LEVELS.slice().reverse();
        return reversed.find(function (level) { return level < scale - 0.001; }) || MIN_SCALE;
    }

    function debounceZoomRender() {
        window.clearTimeout(zoomTimer);
        zoomTimer = window.setTimeout(function () {
            renderGeneration += 1;
            enqueueNearbyPages(currentPage, true);
        }, ZOOM_DEBOUNCE_MS);
    }

    function setManualZoom(direction) {
        if (!pdfDoc) return;
        const anchor = getReadingAnchor();
        fitMode = "custom";
        scale = nearestZoomLevel(direction);
        renderGeneration += 1;
        visualScale = scale;
        updateShellSizes(false);
        renderedPages.forEach(setCanvasVisualScale);
        updateToolbar();
        restoreReadingAnchor(anchor, false);
        debounceZoomRender();
        showToolbar("zoom");
    }

    function setPinchZoom(nextScale) {
        if (!pdfDoc) return;
        const anchor = getReadingAnchor();
        fitMode = "custom";
        scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
        renderGeneration += 1;
        visualScale = scale;
        updateShellSizes(false);
        renderedPages.forEach(setCanvasVisualScale);
        updateToolbar();
        restoreReadingAnchor(anchor, false);
        debounceZoomRender();
    }

    async function setFit(mode) {
        if (!pdfDoc) return;
        const anchor = getReadingAnchor();
        fitMode = mode;
        scale = mode === "actual" ? 1 : await calculateScale(mode);
        visualScale = scale;
        renderGeneration += 1;
        updateToolbar();
        updateShellSizes(false);
        restoreReadingAnchor(mode === "page" ? { page: currentPage, ratio: 0 } : anchor, false);
        enqueueNearbyPages(currentPage, true);
        showToolbar("fit");
    }

    function submitPageInput() {
        const input = byId("studentPdfPageInput");
        if (!input || !pdfDoc) return;
        const number = clamp(Math.floor(Number(input.value || currentPage)), 1, pdfDoc.numPages);
        input.value = String(number);
        scrollToPage(number);
    }

    function toggleFullscreen() {
        const card = byId("studentPdfModalCard");
        if (!document.fullscreenElement && card && card.requestFullscreen) {
            card.requestFullscreen();
        } else if (document.fullscreenElement) {
            document.exitFullscreen().catch(function () {});
        }
        showToolbar("fullscreen");
    }

    function close() {
        const modal = byId("studentPdfModal");
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove("student-pdf-open", "student-pdf-fullscreen-active");
        if (document.fullscreenElement && document.fullscreenElement.id === "studentPdfModalCard") {
            document.exitFullscreen().catch(function () {});
        }
        window.clearTimeout(toolbarTimer);
        window.clearTimeout(zoomTimer);
        cleanupRenderState();
        pdfDoc = null;
        activeNote = null;
        currentPage = 1;
        scale = 1;
        visualScale = 1;
        renderGeneration += 1;
    }

    function updateFullscreenState() {
        const isActive = Boolean(document.fullscreenElement && document.fullscreenElement.id === "studentPdfModalCard");
        document.body.classList.toggle("student-pdf-fullscreen-active", isActive);
        const icon = document.querySelector("[data-pdf-fullscreen] i");
        if (icon) icon.className = isActive ? "fas fa-compress" : "fas fa-expand";
        if (pdfDoc && (fitMode === "width" || fitMode === "page")) {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(function () { setFit(fitMode); }, RESIZE_DEBOUNCE_MS);
        }
    }

    function maybeShowDevtoolsWarning() {
        const warning = byId("studentPdfDevtoolsWarning");
        if (!warning) return;
        const widthGap = window.outerWidth - window.innerWidth;
        const heightGap = window.outerHeight - window.innerHeight;
        warning.hidden = !(widthGap > 180 || heightGap > 180);
    }

    function isTypingTarget(target) {
        const tag = target && target.tagName ? target.tagName.toLowerCase() : "";
        return tag === "input" || tag === "textarea" || tag === "select" || (target && target.isContentEditable);
    }

    function bindModal(modal) {
        modal.addEventListener("contextmenu", function (event) { event.preventDefault(); });
        modal.addEventListener("dragstart", function (event) { event.preventDefault(); });
        modal.addEventListener("drop", function (event) { event.preventDefault(); });
        modal.addEventListener("click", function (event) {
            if (event.target.closest("[data-pdf-back]") || event.target.closest("[data-pdf-close]")) close();
            if (event.target.closest("[data-pdf-prev]")) scrollToPage(currentPage - 1);
            if (event.target.closest("[data-pdf-next]")) scrollToPage(currentPage + 1);
            if (event.target.closest("[data-pdf-zoom-out]")) setManualZoom(-1);
            if (event.target.closest("[data-pdf-zoom-in]")) setManualZoom(1);
            if (event.target.closest("[data-pdf-fit-width]")) setFit("width");
            if (event.target.closest("[data-pdf-fit-page]")) setFit("page");
            if (event.target.closest("[data-pdf-actual-size]")) setFit("actual");
            if (event.target.closest("[data-pdf-fullscreen]")) toggleFullscreen();
            showToolbar("click");
        });
        modal.addEventListener("dblclick", function (event) {
            if (event.target.closest(".student-pdf-modal-toolbar")) return;
            toggleFullscreen();
        });
        const toolbar = modal.querySelector("#studentPdfToolbar");
        if (toolbar) {
            toolbar.addEventListener("mouseenter", function () {
                toolbarPointerInside = true;
                showToolbar("focus");
            });
            toolbar.addEventListener("mouseleave", function () {
                toolbarPointerInside = false;
                showToolbar("toolbar-leave");
            });
            toolbar.addEventListener("focusin", function () { showToolbar("focus"); });
        }
        const reveal = modal.querySelector("[data-pdf-toolbar-reveal]");
        if (reveal) reveal.addEventListener("mouseenter", function () { showToolbar("top-edge"); });
        const pageInput = modal.querySelector("#studentPdfPageInput");
        if (pageInput) {
            pageInput.addEventListener("keydown", function (event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    submitPageInput();
                    pageInput.blur();
                }
            });
            pageInput.addEventListener("blur", submitPageInput);
        }
        const stage = modal.querySelector("#studentPdfModalStage");
        if (stage) {
            stage.addEventListener("scroll", onScroll, { passive: true });
            stage.addEventListener("pointermove", function (event) {
                const rect = stage.getBoundingClientRect();
                if (event.clientY - rect.top < 74) showToolbar("top-edge");
            }, { passive: true });
            stage.addEventListener("click", function () { showToolbar("tap"); });
        }
        modal.addEventListener("wheel", function (event) {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            setManualZoom(event.deltaY < 0 ? 1 : -1);
        }, { passive: false });
        modal.addEventListener("touchstart", function (event) {
            if (event.touches.length === 2) {
                const dx = event.touches[0].clientX - event.touches[1].clientX;
                const dy = event.touches[0].clientY - event.touches[1].clientY;
                pinchStartDistance = Math.hypot(dx, dy);
                pinchStartScale = scale;
            } else {
                showToolbar("touch");
            }
        }, { passive: true });
        modal.addEventListener("touchmove", function (event) {
            if (event.touches.length !== 2 || !pinchStartDistance) return;
            event.preventDefault();
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            setPinchZoom(pinchStartScale * (Math.hypot(dx, dy) / pinchStartDistance));
        }, { passive: false });
        modal.addEventListener("touchend", function () { pinchStartDistance = 0; }, { passive: true });
        window.addEventListener("keydown", function (event) {
            if (modal.hidden || isTypingTarget(event.target)) return;
            if (event.key === "Escape") {
                if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
                else close();
                return;
            }
            if (event.key === "ArrowLeft" || event.key === "PageUp") {
                event.preventDefault();
                scrollToPage(currentPage - 1);
            }
            if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
                event.preventDefault();
                scrollToPage(currentPage + 1);
            }
            if (event.key === "Home") {
                event.preventDefault();
                scrollToPage(1);
            }
            if (event.key === "End" && pdfDoc) {
                event.preventDefault();
                scrollToPage(pdfDoc.numPages);
            }
            if (event.key === "+" || event.key === "=") {
                event.preventDefault();
                setManualZoom(1);
            }
            if (event.key === "-") {
                event.preventDefault();
                setManualZoom(-1);
            }
            if (event.key === "0") {
                event.preventDefault();
                setFit("actual");
            }
            showToolbar("key");
        });
        window.addEventListener("resize", function () {
            maybeShowDevtoolsWarning();
            if (!modal.hidden && (fitMode === "width" || fitMode === "page")) {
                window.clearTimeout(resizeTimer);
                resizeTimer = window.setTimeout(function () { setFit(fitMode); }, RESIZE_DEBOUNCE_MS);
            }
        });
        document.addEventListener("fullscreenchange", updateFullscreenState);
    }

    async function openNote(noteOrId) {
        const modal = ensureModal();
        modal.hidden = false;
        const card = byId("studentPdfModalCard");
        if (card) {
            card.classList.remove("toolbar-hidden");
            card.classList.add("toolbar-visible");
        }
        document.body.classList.add("student-pdf-open");
        setLoading(true, "Checking access...");
        cleanupRenderState();
        pdfDoc = null;
        activeNote = null;
        currentPage = 1;
        scale = 1;
        visualScale = 1;
        fitMode = "width";
        renderGeneration += 1;
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
            const access = window.VinayakNotesPage.createR2PdfAccess
                ? await window.VinayakNotesPage.createR2PdfAccess(note)
                : { url: await window.VinayakNotesPage.createR2SignedUrl(note), fallbackUrl: "" };
            setLoading(true, "Opening secure PDF...");
            pdfDoc = await pdfjsLib.getDocument({
                url: access.url,
                httpHeaders: access.url === access.fallbackUrl && window.VinayakNotesPage.getStudentAuthHeaders ? window.VinayakNotesPage.getStudentAuthHeaders() : {},
                disableAutoFetch: false,
                disableStream: false,
                isEvalSupported: false
            }).promise;
            await applyFitScale();
            await createPageShells();
            updateToolbar();
            setLoading(false);
            observePages();
            enqueueNearbyPages(1, true);
            lastScrollTop = 0;
            showToolbar("open");
        } catch (error) {
            console.error("PDF modal viewer failed", { message: error.message, name: error.name });
            setError(error.message || "Could not open this PDF.");
        }
    }

    window.VinayakPdfModal = {
        openNote: openNote,
        close: close
    };
}());
