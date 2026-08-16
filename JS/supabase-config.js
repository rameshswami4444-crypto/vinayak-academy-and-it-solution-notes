(function () {
    if (window.__vinayakSupabaseConfigLoaded) return;
    window.__vinayakSupabaseConfigLoaded = true;

    var SUPABASE_URL = "https://aptuynimvcllzbbqfmoj.supabase.co";
    var SUPABASE_ANON_KEY = "sb_publishable_DsBlz0MNKxBzterSVTqC_Q_0OMVWVb7";

    window.VINAYAK_SUPABASE_CONFIG = {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        publishableKey: SUPABASE_ANON_KEY,
        loginRedirect: "/dashboard.html",
        adminRedirect: "/admin.html",
        apiBase: "https://www.vinayakacademy.online",
        studentsTable: "students",
        studentIdentifierColumn: "id"
    };

})();
