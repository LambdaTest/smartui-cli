// Strip credentials out of anything before it is printed.
//
// The backend echoes the caller's credentials in at least one error message: a failed
// /visualui/1.0/token/verify answers with "Authentication failed for provided username: <user>
// and accessKey: <the actual access key>". Printing a server message verbatim therefore wrote a
// live access key to stdout, and from there into CI logs and anywhere they are shipped.
//
// Redaction happens on the way out rather than at each call site, because the leak is in data we
// do not control and new messages appear whenever the backend changes.

// Long opaque tokens LambdaTest issues, e.g. LT_xxxxxxxx...
const ACCESS_KEY_PATTERN = /\bLT_[A-Za-z0-9_-]{16,}\b/g;
// The composite project token shape: orgId#ULID#projectName
const COMPOSITE_TOKEN_PATTERN = /\b\d{4,}#[0-9A-HJKMNP-TV-Z]{26}#[^\s"',]+/g;

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redact(value) {
    if (typeof value !== 'string' || !value) return value;
    let out = value;

    // Exact values first: these catch key shapes the patterns below do not anticipate.
    for (const secret of [process.env.LT_ACCESS_KEY, process.env.PROJECT_TOKEN]) {
        if (secret && secret.length >= 8) {
            out = out.replace(new RegExp(escapeRegExp(secret), 'g'), '[REDACTED]');
        }
    }

    out = out.replace(ACCESS_KEY_PATTERN, '[REDACTED]');
    out = out.replace(COMPOSITE_TOKEN_PATTERN, '[REDACTED]');
    return out;
}

module.exports = { redact };
