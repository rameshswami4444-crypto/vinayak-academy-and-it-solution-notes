(function () {
    if (window.__vinayakApiConfigLoaded) return;
    window.__vinayakApiConfigLoaded = true;

    var config = window.VINAYAK_API_CONFIG || {};
    var PRODUCTION_BACKEND_URL = "https://vinayak-academy-and-it-solution-notes.onrender.com";
    var DEBUG = Boolean(config.debug || window.VINAYAK_DEBUG);

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

    function isLocalHost() {
        var host = String(window.location && window.location.hostname || "").toLowerCase();
        return host === "localhost" || host === "127.0.0.1";
    }

    function fromConfiguredApiBase() {
        if (isLocalHost()) {
            return "";
        }
        return config.apiBase || ((window.VINAYAK_SUPABASE_CONFIG && window.VINAYAK_SUPABASE_CONFIG.apiBase) || "");
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
        fromProductionHost() ||
        window.API_BASE_URL ||
        window.VINAYAK_API_BASE ||
        fromVercelHost() ||
        fromLocalStaticHost() ||
        fromConfiguredApiBase() ||
        fromUnresolvedProductionHost() ||
        ""
    ).trim();

    window.API_BASE_URL = backendUrl.replace(/\/+$/, "");
    window.VINAYAK_API_BASE = window.API_BASE_URL;
    window.VinayakApi = {
        baseUrl: window.API_BASE_URL,
        url: function (path) {
            return window.API_BASE_URL + path;
        }
    };
    window.VinayakLogger = {
        debug: function () {
            if (DEBUG && window.console && console.log) console.log.apply(console, arguments);
        },
        warn: function () {
            if (window.console && console.warn) console.warn.apply(console, arguments);
        },
        error: function () {
            if (window.console && console.error) console.error.apply(console, arguments);
        }
    };
    window.VinayakLogger.debug("API_BASE_URL resolved:", window.API_BASE_URL || "(same origin)");
})();
