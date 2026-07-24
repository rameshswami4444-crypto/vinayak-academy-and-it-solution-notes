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
        const limitValue = request.query && request.query.limit ? Number(request.query.limit) : 100;
        const limit = Math.max(1, Math.min(Math.floor(Number.isFinite(limitValue) ? limitValue : 100), 500));
        const files = await listFiles(prefix);
        const visibleFiles = files.slice(0, limit);
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            success: true,
            prefix: prefix,
            totalFiles: files.length,
            limit: limit,
            hasMore: files.length > visibleFiles.length,
            files: visibleFiles.map(function (file) {
                return {
                    key: file.Key,
                    size: file.Size,
                    lastModified: file.LastModified,
                    etag: request.query && request.query.include_etag === "1" ? file.ETag : undefined
                };
            })
        }));
    } catch (error) {
        const details = serializeR2Error(error);
        console.error("R2 list files failed", details);
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            success: false,
            error: details.message,
            details: details
        }));
    }
};
