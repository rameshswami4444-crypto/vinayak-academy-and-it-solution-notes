"use strict";

const { generateSignedUrl, serializeR2Error } = require("../services/r2");

module.exports = async function handler(request, response) {
    if (request.method && request.method !== "GET") {
        response.statusCode = 405;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ success: false, error: "Method not allowed. Use GET." }));
        return;
    }

    try {
        const requestUrl = new URL(request.url || "", "http://localhost");
        const key = String(requestUrl.searchParams.get("key") || "").replace(/^\/+/, "");
        if (!key) {
            throw new Error("R2 object key is required.");
        }

        const signedUrl = await generateSignedUrl(key, { expiresIn: 300 });
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            success: true,
            signedUrl: signedUrl,
            expiresIn: 300
        }));
    } catch (error) {
        const details = serializeR2Error(error);
        console.error("R2 signed URL generation failed", details);
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            success: false,
            error: details.message,
            details: details
        }));
    }
};
