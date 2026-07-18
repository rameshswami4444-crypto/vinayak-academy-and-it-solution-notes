(function () {
    "use strict";

    const output = document.getElementById("r2TestOutput");
    function apiUrl(path) {
        if (window.VinayakApi) return window.VinayakApi.url(path);
        return String(window.API_BASE_URL || window.VINAYAK_API_BASE || "").replace(/\/+$/, "") + path;
    }

    function render(payload) {
        if (!output) return;
        output.textContent = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    }

    async function requestJson(url, options) {
        const startedAt = performance.now();
        const requestUrl = apiUrl(url);
        console.log("R2 diagnostic API URL", requestUrl);
        const response = await fetch(requestUrl, options || {});
        const text = await response.text();
        let body;
        try {
            body = JSON.parse(text);
        } catch (error) {
            body = { raw: text };
        }
        body.httpStatus = response.status;
        body.ok = response.ok;
        body.clientResponseTimeMs = Math.round(performance.now() - startedAt);
        return body;
    }

    async function runTest(type) {
        render("Running " + type + " test...");
        try {
            if (type === "credentials") {
                render(await requestJson("/api/r2/credentials"));
                return;
            }
            if (type === "bucket") {
                render(await requestJson("/api/r2/test"));
                return;
            }
            if (type === "upload") {
                render(await requestJson("/api/r2/upload-test", { method: "POST" }));
                return;
            }
            if (type === "list") {
                render(await requestJson("/api/r2/list"));
            }
        } catch (error) {
            console.error("R2 diagnostic failed", error);
            render({
                success: false,
                message: error.message,
                stack: error.stack
            });
        }
    }

    document.addEventListener("click", function (event) {
        const button = event.target.closest("[data-r2-test]");
        if (!button) return;
        runTest(button.getAttribute("data-r2-test"));
    });

    if (window.VinayakAuth && window.VinayakAuth.initProtectedPage) {
        window.VinayakAuth.initProtectedPage({ adminOnly: true });
    } else {
        document.body.classList.remove("auth-pending");
    }
})();
