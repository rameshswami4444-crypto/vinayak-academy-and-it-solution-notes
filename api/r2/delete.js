"use strict";

const { deletePDF, serializeR2Error } = require("../services/r2");

function readBody(request) {
    return new Promise(function (resolve, reject) {
        let raw = "";
        request.on("data", function (chunk) {
            raw += chunk;
        });
        request.on("end", function () {
            if (!raw) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch (error) {
                reject(error);
            }
        });
        request.on("error", reject);
    });
}

module.exports = async function handler(request, response) {
    if (request.method && request.method !== "POST" && request.method !== "DELETE") {
        response.statusCode = 405;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ success: false, error: "Method not allowed. Use POST or DELETE." }));
        return;
    }

    try {
        const body = await readBody(request);
        const key = String(body.key || "").replace(/^\/+/, "");
        if (!key) {
            throw new Error("R2 object key is required.");
        }

        const objectKey = await deletePDF(key);
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ success: true, key: objectKey }));
    } catch (error) {
        const details = serializeR2Error(error);
        console.error("R2 PDF delete failed", details);
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            success: false,
            error: details.message,
            details: details
        }));
    }
};
