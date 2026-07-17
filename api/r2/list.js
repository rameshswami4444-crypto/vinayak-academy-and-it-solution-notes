"use strict";

const { listFiles, serializeR2Error } = require("../services/r2");

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
        const prefix = request.query && request.query.prefix ? String(request.query.prefix) : "";
        const files = await listFiles(prefix);
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            success: true,
            prefix: prefix,
            totalFiles: files.length,
            files: files.map(function (file) {
                return {
                    key: file.Key,
                    size: file.Size,
                    lastModified: file.LastModified,
                    etag: file.ETag
                };
            })
        }, null, 2));
    } catch (error) {
        const details = serializeR2Error(error);
        console.error("R2 list files failed", details);
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            success: false,
            error: details.message,
            details: details
        }, null, 2));
    }
};
