"use strict";

const fs = require("fs");
const path = require("path");
const {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    HeadBucketCommand,
    ListObjectsV2Command
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const DEFAULT_REGION = "auto";
const DEFAULT_SIGNED_URL_SECONDS = 300;
let startupCheckPrinted = false;

function loadDotEnv() {
    const envPath = path.resolve(__dirname, "..", "..", ".env");
    if (!fs.existsSync(envPath)) {
        return {};
    }

    return fs.readFileSync(envPath, "utf8")
        .split(/\r?\n/)
        .reduce(function (env, line) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) return env;

            const separatorIndex = trimmed.indexOf("=");
            if (separatorIndex === -1) return env;

            const key = trimmed.slice(0, separatorIndex).trim();
            const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
            env[key] = value;
            return env;
        }, {});
}

function getConfig() {
    const localEnv = loadDotEnv();
    const env = Object.assign({}, localEnv, process.env);
    const accountId = env.R2_ACCOUNT_ID || "";
    const generatedEndpoint = accountId ? "https://" + accountId + ".r2.cloudflarestorage.com" : "";

    return {
        accountId: accountId,
        accessKey: env.R2_ACCESS_KEY || "",
        secretKey: env.R2_SECRET_KEY || "",
        bucket: env.R2_BUCKET || "",
        endpoint: env.R2_ENDPOINT || generatedEndpoint,
        expectedEndpoint: generatedEndpoint,
        region: env.R2_REGION || DEFAULT_REGION
    };
}

function assertConfig(config) {
    const missing = [];
    if (!config.accountId) missing.push("R2_ACCOUNT_ID");
    if (!config.accessKey) missing.push("R2_ACCESS_KEY");
    if (!config.secretKey) missing.push("R2_SECRET_KEY");
    if (!config.bucket) missing.push("R2_BUCKET");
    if (!config.endpoint) missing.push("R2_ENDPOINT");

    if (missing.length) {
        missing.forEach(function (name) {
            console.error("Missing environment variable: " + name);
        });
        const error = new Error("Missing environment variable: " + missing.join(", "));
        error.code = "MISSING_R2_ENV";
        error.missingVariables = missing;
        throw error;
    }
}

function printStartupCheck() {
    if (startupCheckPrinted) return;
    startupCheckPrinted = true;
    const config = getConfig();
    console.log("Cloudflare R2 Startup Check");
    console.log("R2_ACCOUNT_ID loaded:", Boolean(config.accountId));
    console.log("R2_ACCESS_KEY loaded:", Boolean(config.accessKey));
    console.log("R2_SECRET_KEY loaded:", Boolean(config.secretKey));
    console.log("R2_BUCKET loaded:", Boolean(config.bucket));
    console.log("R2_ENDPOINT loaded:", Boolean(config.endpoint));
    console.log("✓ Cloudflare Endpoint:", config.endpoint || "NOT LOADED");
    console.log("✓ Bucket Name:", config.bucket || "NOT LOADED");
    console.log("✓ Credentials Loaded:", Boolean(config.accessKey && config.secretKey));
}

function createClient() {
    const config = getConfig();
    assertConfig(config);

    return new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.accessKey,
            secretAccessKey: config.secretKey
        },
        forcePathStyle: true
    });
}

function normalizeKey(key) {
    const config = getConfig();
    let objectKey = String(key || "").trim();
    if (/^https?:\/\//i.test(objectKey)) {
        try {
            const parsed = new URL(objectKey);
            objectKey = decodeURIComponent(parsed.pathname || "");
        } catch (error) {
            // Fall through to regular cleanup below.
        }
    }
    objectKey = objectKey.split("?")[0].replace(/^\/+/, "");
    if (config.bucket && objectKey.indexOf(config.bucket + "/") === 0) {
        objectKey = objectKey.slice(config.bucket.length + 1);
    }
    if (!objectKey) {
        throw new Error("R2 object key is required.");
    }
    return objectKey;
}

function serializeR2Error(error) {
    const metadata = error && error.$metadata ? error.$metadata : {};
    const statusCode = metadata.httpStatusCode || error.statusCode || error.status || "";
    return {
        name: error && error.name ? error.name : "",
        message: error && error.message ? error.message : String(error || "Unknown R2 error"),
        code: (error && (error.Code || error.code || error.name)) || "",
        stack: error && error.stack ? error.stack : "",
        status: statusCode,
        statusCode: statusCode,
        requestId: metadata.requestId || "",
        attempts: metadata.attempts || "",
        totalRetryDelay: metadata.totalRetryDelay || 0,
        metadata: metadata
    };
}

function maskSecret(value) {
    const text = String(value || "");
    if (!text) return "";
    if (text.length <= 8) return "****";
    return text.slice(0, 4) + "****" + text.slice(-4);
}

function getDiagnostics() {
    const config = getConfig();
    return {
        accountId: config.accountId,
        bucket: config.bucket,
        endpoint: config.endpoint,
        expectedEndpoint: config.expectedEndpoint,
        region: config.region,
        accessKeyLoaded: Boolean(config.accessKey),
        secretKeyLoaded: Boolean(config.secretKey),
        accessKeyMasked: maskSecret(config.accessKey),
        secretKeyMasked: maskSecret(config.secretKey),
        missingVariables: [
            !config.accountId ? "R2_ACCOUNT_ID" : "",
            !config.accessKey ? "R2_ACCESS_KEY" : "",
            !config.secretKey ? "R2_SECRET_KEY" : "",
            !config.bucket ? "R2_BUCKET" : "",
            !config.endpoint ? "R2_ENDPOINT" : ""
        ].filter(Boolean)
    };
}

function logR2UploadFailure(error, context) {
    const details = serializeR2Error(error);
    const info = context || {};
    console.error("----------------------------------");
    console.error("Cloudflare R2 Upload Failed");
    console.error("----------------------------------");
    console.error("Name:", details.name);
    console.error("Message:", details.message);
    console.error("Code:", details.code);
    console.error("Status:", details.status || "");
    console.error("Stack:", details.stack);
    console.error("Bucket:", info.bucket || "");
    console.error("Endpoint:", info.endpoint || "");
    console.error("Object Key:", info.key || "");
    console.error("AWS Metadata:", details.metadata || {});
    console.error("----------------------------------");
    console.error("Original AWS SDK Error:", error);
}

async function uploadPDF(fileBuffer, key) {
    const config = getConfig();
    assertConfig(config);

    const objectKey = normalizeKey(key);
    const contentType = "application/pdf";
    const fileSize = fileBuffer && fileBuffer.length != null ? fileBuffer.length : "unknown";
    console.log("==========================");
    console.log("R2 Upload Debug");
    console.log("==========================");
    console.log("Bucket:", config.bucket);
    console.log("Endpoint:", config.endpoint);
    console.log("Object Key:", objectKey);
    console.log("Content Type:", contentType);
    console.log("File Size:", fileSize);
    console.log("==========================");

    try {
        const client = createClient();
        const result = await client.send(new PutObjectCommand({
            Bucket: config.bucket,
            Key: objectKey,
            Body: fileBuffer,
            ContentType: contentType
        }));

        console.log("✓ Uploaded Successfully");
        console.log("Object Key:", objectKey);
        console.log("ETag:", result && result.ETag ? result.ETag : "");

        await client.send(new HeadObjectCommand({
            Bucket: config.bucket,
            Key: objectKey
        }));
        console.log("OK Verified Object Exists:", objectKey);
    } catch (error) {
        logR2UploadFailure(error, {
            bucket: config.bucket,
            endpoint: config.endpoint,
            key: objectKey
        });
        throw error;
    }

    return objectKey;
}

async function deletePDF(key) {
    const config = getConfig();
    assertConfig(config);

    const objectKey = normalizeKey(key);
    await createClient().send(new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: objectKey
    }));

    return objectKey;
}

async function fileExists(key) {
    const config = getConfig();
    assertConfig(config);

    try {
        await createClient().send(new HeadObjectCommand({
            Bucket: config.bucket,
            Key: normalizeKey(key)
        }));
        return true;
    } catch (error) {
        const statusCode = error && error.$metadata && error.$metadata.httpStatusCode;
        if (statusCode === 404 || error.name === "NotFound") {
            return false;
        }
        throw error;
    }
}

async function generateSignedUrl(key, options) {
    const settings = options || {};
    const config = getConfig();
    assertConfig(config);
    const objectKey = normalizeKey(key);

    const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        ResponseContentType: "application/pdf"
    });

    try {
        const signedUrl = await getSignedUrl(createClient(), command, {
            expiresIn: Number(settings.expiresIn || DEFAULT_SIGNED_URL_SECONDS)
        });
        console.log("R2 signed URL generated", {
            bucket: config.bucket,
            endpoint: config.endpoint,
            objectKey: objectKey,
            expiresIn: Number(settings.expiresIn || DEFAULT_SIGNED_URL_SECONDS),
            hasSignedUrl: Boolean(signedUrl)
        });
        return signedUrl;
    } catch (error) {
        console.error("R2 signed URL generation error", {
            bucket: config.bucket,
            endpoint: config.endpoint,
            objectKey: objectKey,
            error: serializeR2Error(error)
        });
        throw error;
    }
}

async function getPDFObject(key, options) {
    const settings = options || {};
    const config = getConfig();
    assertConfig(config);
    const objectKey = normalizeKey(key);
    const range = String(settings.range || "").trim();

    try {
        console.log("R2 PDF object requested", {
            bucket: config.bucket,
            endpoint: config.endpoint,
            objectKey: objectKey,
            hasRange: Boolean(range)
        });
        const command = {
            Bucket: config.bucket,
            Key: objectKey,
            ResponseContentType: "application/pdf"
        };
        if (range) command.Range = range;
        const result = await createClient().send(new GetObjectCommand(command));

        console.log("R2 PDF object fetched", {
            bucket: config.bucket,
            objectKey: objectKey,
            contentRange: result.ContentRange || "",
            contentLength: result.ContentLength || "",
            contentType: result.ContentType || "application/pdf"
        });
        return {
            body: result.Body,
            contentLength: result.ContentLength,
            contentRange: result.ContentRange || "",
            contentType: result.ContentType || "application/pdf",
            objectKey: objectKey,
            bucket: config.bucket
        };
    } catch (error) {
        console.error("R2 PDF object fetch error", {
            bucket: config.bucket,
            endpoint: config.endpoint,
            objectKey: objectKey,
            error: serializeR2Error(error)
        });
        throw error;
    }
}

async function listFiles(prefix) {
    const config = getConfig();
    assertConfig(config);

    const result = await createClient().send(new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix || "",
        MaxKeys: 1000
    }));

    return result.Contents || [];
}

async function testConnection() {
    const config = getConfig();
    assertConfig(config);

    const startedAt = Date.now();
    const client = createClient();

    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    const files = await listFiles("");

    return {
        connected: true,
        bucketExists: true,
        bucket: config.bucket,
        endpoint: config.endpoint,
        expectedEndpoint: config.expectedEndpoint,
        totalFiles: files.length,
        responseTimeMs: Date.now() - startedAt
    };
}

module.exports = {
    deletePDF,
    fileExists,
    generateSignedUrl,
    getDiagnostics,
    getPDFObject,
    listFiles,
    logR2UploadFailure,
    serializeR2Error,
    testConnection,
    uploadPDF
};

printStartupCheck();
