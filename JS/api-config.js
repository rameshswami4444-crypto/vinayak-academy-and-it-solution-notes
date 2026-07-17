(function () {
    var config = window.VINAYAK_API_CONFIG || {};
    var PRODUCTION_BACKEND_URL = "https://vinayak-academy-and-it-solution-notes.onrender.com";

    function fromVercelHost() {
        var host = String(window.location && window.location.hostname || "").toLowerCase();
        if (!/\.vercel\.app$/.test(host)) {
            return "";
        }
        var project = host.replace(/\.vercel\.app$/, "").split(".")[0];
        return project ? "https://" + project + ".onrender.com" : "";
    }

    function fromLocalStaticHost() {
        var host = String(window.location && window.location.hostname || "").toLowerCase();
        var port = String(window.location && window.location.port || "");
        if ((host === "localhost" || host === "127.0.0.1") && ["5500", "5501", "5502"].indexOf(port) !== -1) {
            return "http://localhost:3000";
        }
        return "";
    }

    function fromProductionHost() {
        var host = String(window.location && window.location.hostname || "").toLowerCase();
        if (host === "www.vinayakacademy.online" || host === "vinayakacademy.online") {
            return PRODUCTION_BACKEND_URL;
        }
        return "";
    }

    function fromUnresolvedProductionHost() {
        var host = String(window.location && window.location.hostname || "").toLowerCase();
        if (!host || host === "localhost" || host === "127.0.0.1") {
            return "";
        }
        return PRODUCTION_BACKEND_URL;
    }

    var backendUrl = String(
        window.API_BASE_URL ||
        window.VINAYAK_API_BASE ||
        config.apiBase ||
        ((window.VINAYAK_SUPABASE_CONFIG && window.VINAYAK_SUPABASE_CONFIG.apiBase) || "") ||
        fromVercelHost() ||
        fromLocalStaticHost() ||
        fromProductionHost() ||
        fromUnresolvedProductionHost() ||
        ""
    ).trim();

    window.API_BASE_URL = backendUrl.replace(/\/+$/, "");
    window.VINAYAK_API_BASE = window.API_BASE_URL;
    console.log("API_BASE_URL resolved:", window.API_BASE_URL || "(same origin)");
})();
