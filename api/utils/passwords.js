"use strict";

const crypto = require("crypto");

const PASSWORD_HASH_PREFIX = "scrypt$";

function isPasswordHash(value) {
    return String(value || "").startsWith(PASSWORD_HASH_PREFIX);
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("base64url");
    const hash = crypto.scryptSync(String(password || ""), salt, 64).toString("base64url");
    return PASSWORD_HASH_PREFIX + salt + "$" + hash;
}

function timingSafeEqualString(a, b) {
    const left = Buffer.from(String(a || ""));
    const right = Buffer.from(String(b || ""));
    if (left.length !== right.length) {
        crypto.timingSafeEqual(Buffer.from("0"), Buffer.from("1"));
        return false;
    }
    return crypto.timingSafeEqual(left, right);
}

function verifyPassword(password, stored) {
    const value = String(stored || "");
    if (!value) return false;
    if (!isPasswordHash(value)) return timingSafeEqualString(String(password || ""), value);
    const parts = value.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;
    const expected = crypto.scryptSync(String(password || ""), parts[1], 64).toString("base64url");
    return timingSafeEqualString(expected, parts[2]);
}

module.exports = {
    PASSWORD_HASH_PREFIX,
    hashPassword,
    isPasswordHash,
    timingSafeEqualString,
    verifyPassword
};
