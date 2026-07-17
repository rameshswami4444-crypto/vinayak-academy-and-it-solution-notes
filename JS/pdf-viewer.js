(function () {
    let pdfDoc = null;
    let pageNumber = 1;
    let scale = 1.15;
    let rendering = false;
    let pendingPage = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function setLoading(show, message) {
        const loader = byId("pdfLoading");
        if (!loader) return;
        loader.hidden = !show;
        const text = loader.querySelector("strong");
        if (text && message) text.textContent = message;
    }

    function setError(message) {
        const stage = byId("pdfStage");
        if (!stage) return;
        stage.innerHTML = '<div class="student-pdf-error"><i class="fas fa-triangle-exclamation"></i><strong>Could not open PDF</strong><p>' + String(message || "Please try again.").replace(/</g, "&lt;") + '</p></div>';
    }

    function updatePageInfo() {
        const pageInfo = byId("pdfPageInfo");
        if (pageInfo) {
            pageInfo.textContent = "Page " + pageNumber + " / " + (pdfDoc ? pdfDoc.numPages : "-");
        }
    }

    async function renderPage(number) {
        if (!pdfDoc || rendering) {
            pendingPage = number;
            return;
        }
        rendering = true;
        setLoading(true, "Rendering PDF...");
        try {
            const page = await pdfDoc.getPage(number);
            const canvas = byId("pdfCanvas");
            const context = canvas.getContext("2d");
            const viewport = page.getViewport({ scale: scale });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            pageNumber = number;
            updatePageInfo();
            canvas.hidden = false;
            setLoading(false);
        } finally {
            rendering = false;
            if (pendingPage !== null) {
                const nextPage = pendingPage;
                pendingPage = null;
                renderPage(nextPage);
            }
        }
    }

    function bindControls() {
        const back = byId("pdfBackBtn");
        if (back) {
            back.addEventListener("click", function () {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = "studymaterial.html";
                }
            });
        }
        const zoomIn = byId("pdfZoomIn");
        const zoomOut = byId("pdfZoomOut");
        const prev = byId("pdfPrevPage");
        const next = byId("pdfNextPage");
        if (zoomIn) {
            zoomIn.addEventListener("click", function () {
                scale = Math.min(scale + 0.15, 2.4);
                renderPage(pageNumber);
            });
        }
        if (zoomOut) {
            zoomOut.addEventListener("click", function () {
                scale = Math.max(scale - 0.15, 0.65);
                renderPage(pageNumber);
            });
        }
        if (prev) {
            prev.addEventListener("click", function () {
                if (!pdfDoc || pageNumber <= 1) return;
                renderPage(pageNumber - 1);
            });
        }
        if (next) {
            next.addEventListener("click", function () {
                if (!pdfDoc || pageNumber >= pdfDoc.numPages) return;
                renderPage(pageNumber + 1);
            });
        }
    }

    async function initViewer() {
        bindControls();
        try {
            if (!window.pdfjsLib) {
                throw new Error("PDF viewer library failed to load.");
            }
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            const id = new URLSearchParams(window.location.search).get("id");
            if (!id) {
                throw new Error("Missing PDF id.");
            }
            if (!window.VinayakAuth || !window.VinayakNotesPage) {
                throw new Error("Required portal services are not loaded.");
            }
            const session = await window.VinayakAuth.initProtectedPage();
            if (!session) return;
            const note = await window.VinayakNotesPage.fetchNoteById(id);
            byId("pdfTitle").textContent = note.title || "Study Material";
            byId("pdfSubject").textContent = note.subject || "PDF";
            const access = window.VinayakNotesPage.createR2PdfAccess
                ? await window.VinayakNotesPage.createR2PdfAccess(note)
                : { url: await window.VinayakNotesPage.createR2SignedUrl(note), fallbackUrl: "" };
            const signedUrl = access.url;
            console.log("PDF page viewer: loading signed URL returned by backend", {
                materialId: note.id,
                urlHost: (function () {
                    try { return new URL(signedUrl).host; } catch (error) { return ""; }
                }())
            });
            setLoading(true, "Opening secure PDF...");
            try {
                pdfDoc = await window.pdfjsLib.getDocument({ url: signedUrl }).promise;
            } catch (pdfError) {
                console.error("PDF.js failed while fetching signed URL", {
                    materialId: note.id,
                    message: pdfError.message,
                    name: pdfError.name,
                    stack: pdfError.stack
                });
                if (!access.fallbackUrl) {
                    throw new Error("PDF.js could not fetch the signed Cloudflare R2 URL. " + (pdfError.message || "Unknown fetch error."));
                }
                console.warn("PDF page viewer: retrying through backend stream fallback", {
                    materialId: note.id,
                    fallbackUrl: access.fallbackUrl
                });
                pdfDoc = await window.pdfjsLib.getDocument({
                    url: access.fallbackUrl,
                    httpHeaders: window.VinayakNotesPage.getStudentAuthHeaders ? window.VinayakNotesPage.getStudentAuthHeaders() : {}
                }).promise;
            }
            updatePageInfo();
            await renderPage(1);
        } catch (error) {
            console.error("PDF viewer failed", error);
            setError(error.message || "Could not open this PDF.");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initViewer);
    } else {
        initViewer();
    }
}());
