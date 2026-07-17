"use strict";

const fs = require("fs");
const formidableModule = require("formidable");
const { serializeR2Error, uploadPDF } = require("../services/r2");

const MAX_PDF_SIZE = 200 * 1024 * 1024;
const formidable = formidableModule.formidable || formidableModule.default || formidableModule;

function isDevelopmentMode() {
    return process.env.NODE_ENV !== "production";
}

function parseForm(request) {
    const form = formidable({
        multiples: false,
        maxFileSize: MAX_PDF_SIZE,
        allowEmptyFiles: false
    });

    return new Promise(function (resolve, reject) {
        form.parse(request, function (error, fields, files) {
            if (error) {
                reject(error);
                return;
            }
            resolve({ fields: fields, files: files });
        });
    });
}

function firstValue(value) {
    return Array.isArray(value) ? value[0] : value;
}

function getUploadedFile(files) {
    const file = files.file || files.pdf || files.material;
    return Array.isArray(file) ? file[0] : file;
}

module.exports = async function handler(request, response) {
    if (request.method && request.method !== "POST") {
        response.statusCode = 405;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ success: false, error: "Method not allowed. Use POST." }));
        return;
    }

    try {
        const parsed = await parseForm(request);
        const key = String(firstValue(parsed.fields.key) || "").replace(/^\/+/, "");
        const file = getUploadedFile(parsed.files);

        if (!key) {
            throw new Error("R2 object key is required.");
        }
        if (!file) {
            throw new Error("PDF file is required.");
        }

        const originalName = file.originalFilename || "";
        const mimeType = file.mimetype || "";
        const size = Number(file.size || 0);
        if (size > MAX_PDF_SIZE) {
            throw new Error("PDF must be 200 MB or smaller.");
        }
        if (mimeType && mimeType !== "application/pdf") {
            throw new Error("Only PDF files are allowed.");
        }
        if (!/\.pdf$/i.test(originalName) && mimeType !== "application/pdf") {
            throw new Error("Only PDF files are allowed.");
        }

        console.log("Cloudflare R2 Upload Request");
        console.log("Object Key:", key);
        console.log("File Size:", size);
        console.log("Mime Type:", mimeType || "unknown");

        const buffer = await fs.promises.readFile(file.filepath);
        const objectKey = await uploadPDF(buffer, key);

        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ success: true, key: objectKey }));
    } catch (error) {
        const details = serializeR2Error(error);
        console.error("R2 PDF upload failed", details);
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        const payload = {
            success: false,
            error: details.message,
            message: details.message,
            code: details.code,
            status: details.status,
            statusCode: details.statusCode
        };
        if (isDevelopmentMode()) {
            payload.stack = details.stack;
            payload.details = details;
        }
        response.end(JSON.stringify(payload));
    }
};

module.exports.config = {
    api: {
        bodyParser: false
    }
};
