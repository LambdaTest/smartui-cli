import { Context } from '../types.js';

// Reports snapshots that fail inside the CLI to SmartUI (TE-27113), so the build page can
// show which screenshots are missing and why. Reporting is best effort: it never throws
// and never changes the user's output or exit code.

export const FAILURE_TYPE = {
    EXEC: 'cli-exec',
    PROCESS: 'cli-process',
} as const;

export const FAILURE_REASON = {
    INVALID_SNAPSHOT: 'INVALID_SNAPSHOT',
    DUPLICATE_NAME: 'DUPLICATE_NAME',
    NOT_SAVED: 'NOT_SAVED',
    DISCOVERY_FAILED: 'DISCOVERY_FAILED',
    EXEC_FAILED: 'EXEC_FAILED',
    CONFIG_ERROR: 'CONFIG_ERROR',
} as const;

export type FailureType = typeof FAILURE_TYPE[keyof typeof FAILURE_TYPE];
export type FailureReason = typeof FAILURE_REASON[keyof typeof FAILURE_REASON];

export interface SnapshotFailure {
    type: FailureType;
    reason: FailureReason;
    error: unknown;
    snapshotName?: string;
    sessionId?: string;
    browser?: string;
    viewport?: string;
}

interface FailureReport {
    buildId: string;
    projectToken: string;
    payload: Record<string, any>;
    attempts: number;
}

const MAX_NAME_LENGTH = 255;
const MAX_ATTEMPTS = 2;
const FLUSH_TIMEOUT_MS = 10000;

const inFlight = new Set<Promise<void>>();
const deferred: SnapshotFailure[] = [];
const failed: FailureReport[] = [];

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

// Caps-based sessions report against their own build, matching the queue's useCapsBuildId rule.
function resolveTarget(ctx: Context, sessionId?: string): { buildId: string; projectToken: string } {
    const caps: any = sessionId ? ctx.sessionCapabilitiesMap?.get(sessionId) : undefined;
    if (caps?.buildId && caps?.projectToken) {
        return { buildId: caps.buildId, projectToken: caps.projectToken };
    }
    return { buildId: ctx.build?.id || '', projectToken: '' };
}

function buildReport(failure: SnapshotFailure, target: { buildId: string; projectToken: string }): FailureReport {
    const message = errorMessage(failure.error) || 'Unknown error';
    const trace = failure.error instanceof Error && failure.error.stack ? failure.error.stack : message;
    const payload: Record<string, any> = {
        buildId: target.buildId,
        snapshotError: message,
        trace,
        type: failure.type,
        reason: failure.reason,
    };
    const name = typeof failure.snapshotName === 'string' ? failure.snapshotName.trim() : '';
    if (name) payload.snapshotName = name.slice(0, MAX_NAME_LENGTH);
    if (failure.browser) payload.browser = failure.browser;
    if (failure.viewport) payload.viewport = failure.viewport;
    return { ...target, payload, attempts: 0 };
}

function send(ctx: Context, report: FailureReport): void {
    const request: Promise<void> = ctx.client
        .reportSnapshotFailure(ctx, report.projectToken, report.payload)
        .then(() => {
            ctx.log.debug(`Reported ${report.payload.reason} for snapshot '${report.payload.snapshotName || '-'}'`);
        })
        .catch((error: any) => {
            report.attempts += 1;
            failed.push(report);
            ctx.log.debug(`Failed to report snapshot failure (attempt ${report.attempts}): ${error?.message}`);
        })
        .finally(() => {
            inFlight.delete(request);
        });
    inFlight.add(request);
}

function enqueue(ctx: Context, failure: SnapshotFailure, allowDefer: boolean): void {
    const target = resolveTarget(ctx, failure.sessionId);
    if (!target.buildId) {
        if (allowDefer) {
            deferred.push(failure);
            ctx.log.debug(`No build yet; deferring ${failure.reason} report for snapshot '${failure.snapshotName || '-'}'`);
        } else {
            ctx.log.debug(`No build available; dropping ${failure.reason} report for snapshot '${failure.snapshotName || '-'}'`);
        }
        return;
    }
    send(ctx, buildReport(failure, target));
}

export function reportSnapshotFailure(ctx: Context, failure: SnapshotFailure): void {
    try {
        if (!ctx?.client) return;
        enqueue(ctx, failure, true);
    } catch (error: any) {
        ctx?.log?.debug(`Unable to report snapshot failure: ${error?.message}`);
    }
}

async function waitForInFlight(timeoutMs: number): Promise<void> {
    if (inFlight.size === 0 || timeoutMs <= 0) return;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>(resolve => {
        timer = setTimeout(resolve, timeoutMs);
    });
    await Promise.race([Promise.allSettled([...inFlight]), timeout]);
    if (timer) clearTimeout(timer);
}

// Call before finalizing a build: sends deferred reports, waits for pending ones and retries failures once.
export async function flushSnapshotFailures(ctx: Context): Promise<void> {
    try {
        const start = Date.now();
        for (const failure of deferred.splice(0)) {
            enqueue(ctx, failure, false);
        }
        await waitForInFlight(FLUSH_TIMEOUT_MS);

        let exhausted = 0;
        for (const report of failed.splice(0)) {
            if (report.attempts < MAX_ATTEMPTS) {
                send(ctx, report);
            } else {
                exhausted += 1;
            }
        }
        await waitForInFlight(FLUSH_TIMEOUT_MS - (Date.now() - start));

        const unsent = exhausted + failed.length + inFlight.size;
        if (unsent > 0) {
            ctx.log.debug(`${unsent} snapshot failure report(s) could not be sent`);
        }
    } catch (error: any) {
        ctx?.log?.debug(`Unable to flush snapshot failure reports: ${error?.message}`);
    }
}
