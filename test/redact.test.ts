// The backend echoes the caller's access key in a failed /token/verify response, so anything
// derived from a server message is scrubbed before it reaches stdout or a CI log.
import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { redact } = require('../src/storybookVendor/commands/utils/redact.cjs');

const ORIGINAL_ENV = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

describe('redact', () => {
    it('scrubs an access key echoed back by the auth endpoint', () => {
        const msg = 'Authentication failed for provided username: bob and accessKey: LT_abcdefghijklmnopqrstuvwxyz0123456789';
        const out = redact(msg);
        expect(out).not.toMatch(/LT_abcdef/);
        expect(out).toContain('[REDACTED]');
        expect(out).toContain('username: bob');
    });

    it('scrubs a composite project token', () => {
        const out = redact('Failed POST for projectToken: 3128042#01M1KCEV5GKHEPGHWGR6HVCVV7#My-Project due to x');
        expect(out).not.toMatch(/01M1KCEV5GKHEPGHWGR6HVCVV7/);
        expect(out).toContain('[REDACTED]');
    });

    it('scrubs the exact env values even when they do not match the generic shapes', () => {
        process.env.LT_ACCESS_KEY = 'some-unusual-key-value';
        process.env.PROJECT_TOKEN = 'another-odd-token';
        const out = redact('key=some-unusual-key-value token=another-odd-token');
        expect(out).toBe('key=[REDACTED] token=[REDACTED]');
    });

    it('ignores short or empty env values rather than redacting everything', () => {
        process.env.LT_ACCESS_KEY = 'ab';
        expect(redact('a stable message about ab')).toBe('a stable message about ab');
    });

    it('leaves messages without secrets untouched', () => {
        const msg = 'Given directory is not a storybook static directory. Error: No index.html found';
        expect(redact(msg)).toBe(msg);
    });

    it('passes non-strings through unchanged', () => {
        expect(redact(42)).toBe(42);
        expect(redact(null)).toBe(null);
        expect(redact(undefined)).toBe(undefined);
        const obj = { a: 1 };
        expect(redact(obj)).toBe(obj);
    });

    it('scrubs every occurrence, not just the first', () => {
        const out = redact('LT_aaaaaaaaaaaaaaaaaaaaaa and LT_bbbbbbbbbbbbbbbbbbbbbb');
        expect(out).toBe('[REDACTED] and [REDACTED]');
    });
});
