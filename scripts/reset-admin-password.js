"use strict";

require("dotenv").config();

const readline = require("readline");
const { createClient } = require("@supabase/supabase-js");
const { hashPassword, isPasswordHash } = require("../api/utils/passwords");

function getSupabaseConfig() {
    return {
        url: String(process.env.SUPABASE_URL || "").trim(),
        key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim()
    };
}

function createPrompt() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true
    });
}

function ask(prompt, question) {
    return new Promise(function (resolve) {
        prompt.question(question, function (answer) {
            resolve(String(answer || "").trim());
        });
    });
}

function askHidden(prompt, question) {
    return new Promise(function (resolve) {
        const input = process.stdin;
        const output = process.stdout;
        const wasRaw = Boolean(input.isRaw);
        let value = "";

        output.write(question);
        input.setRawMode(true);
        input.resume();
        input.setEncoding("utf8");

        function cleanup() {
            input.removeListener("data", onData);
            input.setRawMode(wasRaw);
            output.write("\n");
        }

        function onData(char) {
            if (char === "\u0003") {
                cleanup();
                process.exit(130);
            }
            if (char === "\r" || char === "\n") {
                cleanup();
                resolve(value);
                return;
            }
            if (char === "\u007f" || char === "\b") {
                value = value.slice(0, -1);
                return;
            }
            value += char;
        }

        input.on("data", onData);
    });
}

function validatePassword(password) {
    const value = String(password || "");
    if (value.length < 10 || value.length > 128) {
        return "Password must be 10 to 128 characters.";
    }
    if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
        return "Password must include uppercase, lowercase and a number.";
    }
    return "";
}

async function main() {
    const config = getSupabaseConfig();
    if (!config.url || !config.key) {
        throw new Error("SUPABASE_URL and a server Supabase key must be configured.");
    }

    const prompt = createPrompt();
    try {
        const username = await ask(prompt, "Admin username: ");
        if (!username) throw new Error("Username is required.");

        const client = createClient(config.url, config.key, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const existing = await client
            .from("admins")
            .select("username, password, role, account_status, status, failed_attempts, locked_until")
            .eq("username", username)
            .single();
        if (existing.error) throw existing.error;

        const storedPassword = String(existing.data.password || "");
        console.log("Admin found:", {
            username: existing.data.username,
            role: existing.data.role || null,
            account_status: existing.data.account_status || null,
            status: existing.data.status || null,
            failed_attempts: existing.data.failed_attempts || 0,
            locked: existing.data.locked_until ? new Date(existing.data.locked_until).getTime() > Date.now() : false,
            password_format: isPasswordHash(storedPassword) ? "scrypt" : (storedPassword ? "legacy_plaintext_or_unknown" : "empty"),
            password_length: storedPassword.length
        });

        const password = await askHidden(prompt, "New password: ");
        const confirm = await askHidden(prompt, "Confirm new password: ");
        if (password !== confirm) throw new Error("Passwords do not match.");
        const validationError = validatePassword(password);
        if (validationError) throw new Error(validationError);

        const update = await client
            .from("admins")
            .update({
                password: hashPassword(password),
                failed_attempts: 0,
                locked_until: null,
                last_failed_login: null
            })
            .eq("username", username);
        if (update.error) throw update.error;

        console.log("Admin password reset complete. The new password was hashed once and lockout counters were cleared.");
    } finally {
        prompt.close();
    }
}

main().catch(function (error) {
    console.error("Reset failed:", error.message || "Unknown error");
    process.exit(1);
});
