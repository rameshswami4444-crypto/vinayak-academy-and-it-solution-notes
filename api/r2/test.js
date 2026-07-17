"use strict";

const { serializeR2Error, testConnection } = require("../services/r2");

module.exports = async function handler(request, response) {
    if (request.method && request.method !== "GET") {
        response.statusCode = 405;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            success: false,
            error: "Method not allowed. Use GET."
        }));
        return;
    }

    try {
        const result = await testConnection();
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            connected: Boolean(result.connected),
            bucketConfigured: Boolean(result.bucket),
            totalFiles: result.totalFiles,
            responseTime: result.responseTimeMs
        }));
    } catch (error) {
        const details = serializeR2Error(error);
        console.error("R2 connection test failed", details);
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            connected: false,
            error: details.message,
            details: details
        }));
    }
};
