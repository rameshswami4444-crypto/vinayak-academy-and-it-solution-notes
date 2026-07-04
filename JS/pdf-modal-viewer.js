(function () {
    const WORKER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const PDFJS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    let pdfLibPromise = null;
    let pdfDoc = null;
    let pageNumber = 1;
    let scale = 1;
    let fitMode = "width";
    let rendering = false;
    let pendingRender = false;
    let activeNote = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let pinchStartDistance = 0;
    let pinchStartScale = 1;
    let wheelPageLock = false;

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
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

    function getConfigFlag(key) {
        const config = window.VinayakPdfViewerConfig || {};
        return Boolean(config[key]);
    }

    function ensureModal() {
        let modal = document.getElementById("studentPdfModal");
        if (modal) return modal;
        modal = document.createElement("section");
        modal.id = "studentPdfModal";
        modal.className = "student-pdf-modal";
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("role", "dialog");
        modal.hidden = true;
        modal.innerHTML = [
            '<div class="student-pdf-modal-card" id="studentPdfModalCard">',
            '<div class="student-pdf-modal-toolbar">',
            '<button type="button" class="student-pdf-tool back" data-pdf-close><i class="fas fa-arrow-left"></i><span>Back</span></button>',
            '<div class="student-pdf-modal-title"><strong id="studentPdfModalTitle">PDF</strong><small id="studentPdfModalSubject">Study Material</small></div>',
            '<div class="student-pdf-modal-controls">',
            '<button type="button" class="student-pdf-tool" data-pdf-prev title="Previous page"><i class="fas fa-chevron-left"></i></button>',
            '<span class="student-pdf-page" id="studentPdfPageInfo">Page - / -</span>',
            '<button type="button" class="student-pdf-tool" data-pdf-next title="Next page"><i class="fas fa-chevron-right"></i></button>',
            '<button type="button" class="student-pdf-tool" data-pdf-zoom-out title="Zoom out"><i class="fas fa-minus"></i></button>',
            '<span class="student-pdf-zoom" id="studentPdfZoomInfo">100%</span>',
            '<button type="button" class="student-pdf-tool" data-pdf-zoom-in title="Zoom in"><i class="fas fa-plus"></i></button>',
            '<button type="button" class="student-pdf-tool text" data-pdf-fit-width>Fit Width</button>',
            '<button type="button" class="student-pdf-tool text" data-pdf-fit-page>Fit Page</button>',
            '<button type="button" class="student-pdf-tool" data-pdf-fullscreen title="Fullscreen"><i class="fas fa-expand"></i></button>',
            '<button type="button" class="student-pdf-tool optional" data-pdf-download hidden title="Download"><i class="fas fa-download"></i></button>',
            '<button type="button" class="student-pdf-tool optional" data-pdf-print hidden title="Print"><i class="fas fa-print"></i></button>',
            '<button type="button" class="student-pdf-tool close" data-pdf-close title="Close"><i class="fas fa-xmark"></i></button>',
            '</div>',
            '</div>',
            '<div class="student-pdf-modal-stage" id="studentPdfModalStage">',
            '<div class="student-pdf-modal-loader" id="studentPdfModalLoader"><span></span><strong>Loading secure PDF...</strong></div>',
            '<canvas id="studentPdfCanvas" draggable="false"></canvas>',
            '</div>',
            '</div>'
        ].join("");
        document.body.appendChild(modal);
        bindModal(modal);
        return modal;
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function setLoading(show, message) {
        const loader = byId("studentPdfModalLoader");
        if (!loader) return;
        loader.hidden = !show;
        const text = loader.querySelector("strong");
        if (text && message) text.textContent = message;
    }

    function setError(message) {
        const stage = byId("studentPdfModalStage");
        if (!stage) return;
        stage.innerHTML = '<div class="student-pdf-modal-error"><i class="fas fa-triangle-exclamation"></i><strong>Could not open PDF</strong><p>' + escapeHtml(message || "Please try again.") + '</p></div>';
    }

    function resetStage() {
        const stage = byId("studentPdfModalStage");
        if (!stage || byId("studentPdfCanvas")) return;
        stage.innerHTML = [
            '<div class="student-pdf-modal-loader" id="studentPdfModalLoader"><span></span><strong>Loading secure PDF...</strong></div>',
            '<canvas id="studentPdfCanvas" draggable="false"></canvas>'
        ].join("");
    }

    function updateToolbar() {
        const pageInfo = byId("studentPdfPageInfo");
        const zoomInfo = byId("studentPdfZoomInfo");
        if (pageInfo) pageInfo.textContent = "Page " + pageNumber + " / " + (pdfDoc ? pdfDoc.numPages : "-");
        if (zoomInfo) zoomInfo.textContent = Math.round(scale * 100) + "%";
    }

    function calculateFitScale(page) {
        const stage = byId("studentPdfModalStage");
        const base = page.getViewport({ scale: 1 });
        const widthScale = Math.max(0.35, (stage.clientWidth - 34) / base.width);
        const heightScale = Math.max(0.35, (stage.clientHeight - 34) / base.height);
        return fitMode === "page" ? Math.min(widthScale, heightScale) : widthScale;
    }

    async function renderPage() {
        if (!pdfDoc || rendering) {
            pendingRender = true;
            return;
        }
        rendering = true;
        setLoading(true, "Rendering page...");
        try {
            const page = await pdfDoc.getPage(pageNumber);
            if (fitMode === "width" || fitMode === "page") {
                scale = calculateFitScale(page);
            }
            const viewport = page.getViewport({ scale: scale });
            const canvas = byId("studentPdfCanvas");
            const context = canvas.getContext("2d", { alpha: false });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            canvas.hidden = false;
            const stage = byId("studentPdfModalStage");
            if (stage) stage.scrollTop = 0;
            updateToolbar();
            setLoading(false);
        } finally {
            rendering = false;
            if (pendingRender) {
                pendingRender = false;
                renderPage();
            }
        }
    }

    function queueRenderManual(nextScale) {
        fitMode = "custom";
        scale = Math.max(0.35, Math.min(3, nextScale));
        renderPage();
    }

    function goPage(direction) {
        if (!pdfDoc) return;
        const next = Math.max(1, Math.min(pdfDoc.numPages, pageNumber + direction));
        if (next === pageNumber) return;
        pageNumber = next;
        renderPage();
    }

    function close() {
        const modal = byId("studentPdfModal");
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove("student-pdf-open");
        if (document.fullscreenElement && document.fullscreenElement.id === "studentPdfModalCard") {
            document.exitFullscreen().catch(function () {});
        }
        pdfDoc = null;
        activeNote = null;
    }

    function bindModal(modal) {
        modal.addEventListener("contextmenu", function (event) {
            event.preventDefault();
        });
        modal.addEventListener("dragstart", function (event) {
            event.preventDefault();
        });
        modal.addEventListener("click", function (event) {
            if (event.target.closest("[data-pdf-close]")) close();
            if (event.target.closest("[data-pdf-prev]")) goPage(-1);
            if (event.target.closest("[data-pdf-next]")) goPage(1);
            if (event.target.closest("[data-pdf-zoom-out]")) queueRenderManual(scale - 0.15);
            if (event.target.closest("[data-pdf-zoom-in]")) queueRenderManual(scale + 0.15);
            if (event.target.closest("[data-pdf-fit-width]")) {
                fitMode = "width";
                renderPage();
            }
            if (event.target.closest("[data-pdf-fit-page]")) {
                fitMode = "page";
                renderPage();
            }
            if (event.target.closest("[data-pdf-fullscreen]")) {
                const card = byId("studentPdfModalCard");
                if (!document.fullscreenElement && card && card.requestFullscreen) {
                    card.requestFullscreen();
                } else if (document.fullscreenElement) {
                    document.exitFullscreen().catch(function () {});
                }
            }
            if (event.target.closest("[data-pdf-download]") && activeNote && activeNote.signedUrl) {
                window.location.href = activeNote.signedUrl;
            }
            if (event.target.closest("[data-pdf-print]")) {
                window.print();
            }
        });
        modal.addEventListener("wheel", function (event) {
            if (event.ctrlKey) {
                event.preventDefault();
                queueRenderManual(scale + (event.deltaY < 0 ? 0.1 : -0.1));
                return;
            }
            const stage = byId("studentPdfModalStage");
            if (!stage || wheelPageLock) return;
            const atBottom = stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 6;
            const atTop = stage.scrollTop <= 6;
            if (event.deltaY > 24 && atBottom) {
                wheelPageLock = true;
                goPage(1);
                window.setTimeout(function () { wheelPageLock = false; }, 420);
            }
            if (event.deltaY < -24 && atTop) {
                wheelPageLock = true;
                goPage(-1);
                window.setTimeout(function () { wheelPageLock = false; }, 420);
            }
        }, { passive: false });
        modal.addEventListener("touchstart", function (event) {
            if (event.touches.length === 1) {
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
            }
            if (event.touches.length === 2) {
                const dx = event.touches[0].clientX - event.touches[1].clientX;
                const dy = event.touches[0].clientY - event.touches[1].clientY;
                pinchStartDistance = Math.hypot(dx, dy);
                pinchStartScale = scale;
            }
        }, { passive: true });
        modal.addEventListener("touchend", function (event) {
            if (event.changedTouches.length !== 1) return;
            const dx = event.changedTouches[0].clientX - touchStartX;
            const dy = event.changedTouches[0].clientY - touchStartY;
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) {
                goPage(dx < 0 ? 1 : -1);
            }
        }, { passive: true });
        modal.addEventListener("touchmove", function (event) {
            if (event.touches.length !== 2 || !pinchStartDistance) return;
            event.preventDefault();
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            const nextDistance = Math.hypot(dx, dy);
            queueRenderManual(pinchStartScale * (nextDistance / pinchStartDistance));
        }, { passive: false });
        window.addEventListener("keydown", function (event) {
            if (modal.hidden) return;
            if (event.key === "Escape") close();
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") goPage(-1);
            if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === " ") goPage(1);
            if (event.key === "+" || event.key === "=") queueRenderManual(scale + 0.15);
            if (event.key === "-") queueRenderManual(scale - 0.15);
            if (event.key.toLowerCase() === "f") {
                const fitButton = modal.querySelector("[data-pdf-fit-width]");
                if (fitButton) fitButton.click();
            }
        });
        window.addEventListener("resize", function () {
            if (!modal.hidden && (fitMode === "width" || fitMode === "page")) renderPage();
        });
    }

    async function openNote(noteOrId) {
        const modal = ensureModal();
        resetStage();
        modal.hidden = false;
        document.body.classList.add("student-pdf-open");
        setLoading(true, "Checking access...");
        try {
            if (!window.VinayakNotesPage) throw new Error("Study material service is not loaded.");
            const note = typeof noteOrId === "object" ? noteOrId : await window.VinayakNotesPage.fetchNoteById(noteOrId);
            byId("studentPdfModalTitle").textContent = note.title || "Study Material";
            byId("studentPdfModalSubject").textContent = note.subject || "PDF";
            modal.querySelector("[data-pdf-download]").hidden = !getConfigFlag("allowDownload");
            modal.querySelector("[data-pdf-print]").hidden = !getConfigFlag("allowPrint");
            const pdfjsLib = await loadPdfJs();
            const signedUrl = await window.VinayakNotesPage.createSignedUrl(note);
            activeNote = Object.assign({}, note, { signedUrl: signedUrl });
            setLoading(true, "Loading secure PDF...");
            pageNumber = 1;
            fitMode = "width";
            pdfDoc = await pdfjsLib.getDocument({
                url: signedUrl,
                disableAutoFetch: true,
                disableStream: false
            }).promise;
            updateToolbar();
            await renderPage();
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
