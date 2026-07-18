(function () {
    var SUPABASE_URL = "https://aptuynimvcllzbbqfmoj.supabase.co";
    var SUPABASE_ANON_KEY = "sb_publishable_DsBlz0MNKxBzterSVTqC_Q_0OMVWVb7";
    var API_BASE = "https://vinayak-academy-and-it-solution-notes.onrender.com";

    window.VINAYAK_SUPABASE_CONFIG = {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        publishableKey: SUPABASE_ANON_KEY,
        loginRedirect: "index.html",
        adminRedirect: "admin.html",
        apiBase: API_BASE,
        studentsTable: "students",
        studentIdentifierColumn: "id"
    };

    var host = String(window.location && window.location.hostname || "").toLowerCase();
    var isLocal = host === "localhost" || host === "127.0.0.1";
    if (!isLocal) {
        window.API_BASE_URL = window.API_BASE_URL || API_BASE;
        window.VINAYAK_API_BASE = window.VINAYAK_API_BASE || API_BASE;
    }

    console.log("VINAYAK_SUPABASE_CONFIG loaded:", window.VINAYAK_SUPABASE_CONFIG);
    console.log("Configured API_BASE_URL:", window.API_BASE_URL);
})();
