"use strict";

const { fileExists, serializeR2Error, uploadPDF } = require("../services/r2");

module.exports = async function handler(request, response) {
    if (request.method && request.method !== "POST") {
        response.statusCode = 405;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            success: false,
            error: "Method not allowed. Use POST."
        }));
        return;
    }

    const key = "r2-test/" + Date.now() + "-connection-test.pdf";
    const testPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "utf8");

    try {
        const uploadedKey = await uploadPDF(testPdf, key);
        const exists = await fileExists(uploadedKey);
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            success: true,
            uploadedKey: uploadedKey,
            exists: exists
        }, null, 2));
    } catch (error) {
        const details = serializeR2Error(error);
        console.error("R2 test upload failed", details);
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({
            success: false,
            error: details.message,
            details: details
        }, null, 2));
    }
};
