(function () {
    if (window.__vinayakApiConfigLoaded) return;
    window.__vinayakApiConfigLoaded = true;

    var config = window.VINAYAK_API_CONFIG || {};
    var DEBUG = Boolean(config.debug || window.VINAYAK_DEBUG);

    function fromLocalStaticHost() {
        var host = String(window.location && window.location.hostname || "").toLowerCase();
        var port = String(window.location && window.location.port || "");
        if ((host === "localhost" || host === "127.0.0.1") && ["5500", "5501", "5502"].indexOf(port) !== -1) {
            return "http://localhost:3000";
        }
        return "";
    }

    function fromConfiguredApiBase() {
        return config.apiBase || ((window.VINAYAK_SUPABASE_CONFIG && window.VINAYAK_SUPABASE_CONFIG.apiBase) || "");
    }

    var backendUrl = String(
        fromLocalStaticHost() ||
        fromConfiguredApiBase() ||
        window.API_BASE_URL ||
        window.VINAYAK_API_BASE ||
        (window.location && window.location.origin) ||
        ""
    ).trim();

    window.API_BASE_URL = backendUrl.replace(/\/+$/, "");
    window.VINAYAK_API_BASE = window.API_BASE_URL;
    window.VinayakApi = {
        baseUrl: window.API_BASE_URL,
        url: function (path) {
            var cleanPath = String(path || "");
            if (/^https?:\/\//i.test(cleanPath)) {
                return cleanPath;
            }
            if (cleanPath.charAt(0) !== "/") {
                cleanPath = "/" + cleanPath;
            }
            return window.API_BASE_URL + cleanPath;
        },
        fetch: function (path, options) {
            return window.fetch(window.VinayakApi.url(path), options || {});
        },
        json: async function (path, options) {
            var response = await window.VinayakApi.fetch(path, options || {});
            var payload = await response.json().catch(function () { return {}; });
            if (!response.ok || payload.success === false) {
                throw new Error(payload.message || payload.error || "API request failed.");
            }
            return payload;
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
