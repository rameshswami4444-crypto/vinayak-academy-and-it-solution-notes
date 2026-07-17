"use strict";

const { getDiagnostics, serializeR2Error } = require("../services/r2");

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
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        const diagnostics = getDiagnostics();
        response.end(JSON.stringify({
            success: true,
            diagnostics: {
                accountIdLoaded: Boolean(diagnostics.accountId),
                bucketLoaded: Boolean(diagnostics.bucket),
                endpointLoaded: Boolean(diagnostics.endpoint),
                region: diagnostics.region,
                accessKeyLoaded: diagnostics.accessKeyLoaded,
                secretKeyLoaded: diagnostics.secretKeyLoaded,
                missingVariables: diagnostics.missingVariables
            }
        }, null, 2));
    } catch (error) {
        const details = serializeR2Error(error);
        console.error("R2 credentials diagnostics failed", details);
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            success: false,
            error: details.message,
            details: details
        }, null, 2));
    }
};
