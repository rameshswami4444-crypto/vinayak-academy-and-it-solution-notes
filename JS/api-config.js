(function () {
    var config = window.VINAYAK_API_CONFIG || {};

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

    var backendUrl = String(
        window.API_BASE_URL ||
        window.VINAYAK_API_BASE ||
        config.apiBase ||
        ((window.VINAYAK_SUPABASE_CONFIG && window.VINAYAK_SUPABASE_CONFIG.apiBase) || "") ||
        fromVercelHost() ||
        fromLocalStaticHost() ||
        ""
    ).trim();

    window.API_BASE_URL = backendUrl.replace(/\/+$/, "");
    window.VINAYAK_API_BASE = window.API_BASE_URL;
    console.log("API_BASE_URL resolved:", window.API_BASE_URL || "(same origin)");
})();
