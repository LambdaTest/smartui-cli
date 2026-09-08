import fs from 'fs';

export type PdfThreshold = { approval?: number; rejection?: number };
export type PdfThresholdMap = Record<string, PdfThreshold>;

// mirrors the web path: the CLI resolves per item and the backend receives one final value each
export function resolvePdfThresholds(
    documentNames: string[],
    perFile: PdfThresholdMap,
    buildApproval: string,
    buildRejection: string
): PdfThresholdMap {
    const unknown = Object.keys(perFile).filter(name => !documentNames.includes(name));
    if (unknown.length) {
        throw new Error(`thresholds names PDFs that are not in this upload: ${unknown.sort().join(', ')}. Names must match the uploaded file names (or --pdfNames) exactly.`);
    }
    const buildA = toNumber(buildApproval, 'approvalThreshold');
    const buildR = toNumber(buildRejection, 'rejectionThreshold');
    const resolved: PdfThresholdMap = {};
    for (const name of documentNames) {
        const approval = perFile[name]?.approval ?? buildA;
        const rejection = perFile[name]?.rejection ?? buildR;
        if (approval === undefined && rejection === undefined) continue;
        resolved[name] = {};
        if (approval !== undefined) resolved[name].approval = approval;
        if (rejection !== undefined) resolved[name].rejection = rejection;
    }
    return resolved;
}

// --thresholds is inline JSON or a path; a value that is neither fails here, before any upload
export function readPdfThresholdInput(raw: string): PdfThresholdMap {
    const value = (raw || '').trim();
    if (!value) return {};
    let text = value;
    if (!value.startsWith('{')) {
        if (!fs.existsSync(value)) {
            throw new Error(`thresholds file not found: ${value}`);
        }
        text = fs.readFileSync(value, 'utf8');
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (e: any) {
        throw new Error(`thresholds must be a JSON object keyed by PDF name, e.g. {"invoice.pdf":{"approval":2,"rejection":5}}: ${e.message}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('thresholds must be a JSON object keyed by PDF name');
    }
    return parsed as PdfThresholdMap;
}

function toNumber(s: string, field: string): number | undefined {
    if (s === undefined || s === null || s === '') return undefined;
    const n = Number(s);
    if (!Number.isFinite(n)) {
        throw new Error(`${field} must be a number between 0 and 100, got "${s}"`);
    }
    return n;
}
