// Covers the `storybook` block added to ConfigSchema, and the SnapshotSchema regression
// QA hit as an HTTP 500 "Invalid snapshot" (TE-24908). That one was a stale branch base
// rather than a product defect, so these cases exist to stop it silently coming back.
import { describe, it, expect } from 'vitest';
import { validateConfig, validateSnapshot } from '../src/lib/schemaValidation.js';

const withStorybook = (storybook: unknown) => ({ storybook });
const ok = (config: unknown) => validateConfig(config) === true;
const errors = (config: unknown) => {
    validateConfig(config);
    return (validateConfig.errors ?? []).map((e) => e.message).join(' | ');
};

describe('ConfigSchema: storybook block', () => {
    it('accepts a config carrying only a storybook block', () => {
        // The top level is additionalProperties:false with an anyOf, so `storybook` has to
        // be listed in both places or a storybook-only config is rejected outright.
        expect(ok(withStorybook({ browsers: ['chrome'] }))).toBe(true);
    });

    it('accepts one file carrying both a web and a storybook block', () => {
        // This is what makes the TE-23033 merge legal.
        expect(ok({
            web: { browsers: ['chrome'], viewports: [[1920, 1080]] },
            storybook: { browsers: ['chrome'], viewports: [[1920, 1080]] },
        })).toBe(true);
    });

    it('rejects a config with neither web, mobile nor storybook', () => {
        expect(ok({})).toBe(false);
    });

    it('rejects an unknown top-level key', () => {
        expect(ok({ storybook: { browsers: ['chrome'] }, storyboook: {} })).toBe(false);
    });

    it('rejects an unknown key inside the storybook block', () => {
        expect(ok(withStorybook({ browsers: ['chrome'], nope: 1 }))).toBe(false);
    });

    describe('browsers', () => {
        it('accepts the four supported browsers', () => {
            expect(ok(withStorybook({ browsers: ['chrome', 'firefox', 'safari', 'edge'] }))).toBe(true);
        });
        it('rejects an unsupported browser and names the allowed set', () => {
            expect(ok(withStorybook({ browsers: ['opera'] }))).toBe(false);
            expect(errors(withStorybook({ browsers: ['opera'] }))).toMatch(/allowed storybook browsers/);
        });
        it('rejects an empty browsers array', () => {
            expect(ok(withStorybook({ browsers: [] }))).toBe(false);
        });
        it('rejects duplicate browsers', () => {
            expect(ok(withStorybook({ browsers: ['chrome', 'chrome'] }))).toBe(false);
        });
    });

    describe('viewports and resolutions', () => {
        it('accepts a [width] tuple', () => {
            expect(ok(withStorybook({ viewports: [[1280]] }))).toBe(true);
        });
        it('accepts a [width, height] tuple', () => {
            expect(ok(withStorybook({ viewports: [[1280, 720]] }))).toBe(true);
        });
        it('rejects a three-element tuple', () => {
            expect(ok(withStorybook({ viewports: [[1280, 720, 2]] }))).toBe(false);
        });
        it('rejects a width below 320', () => {
            expect(ok(withStorybook({ viewports: [[319]] }))).toBe(false);
        });
        it('rejects a width above 7680', () => {
            expect(ok(withStorybook({ viewports: [[7681]] }))).toBe(false);
        });
        it('rejects a height below 320', () => {
            expect(ok(withStorybook({ viewports: [[1280, 319]] }))).toBe(false);
        });
        it('rejects a non-integer dimension', () => {
            expect(ok(withStorybook({ viewports: [[1280.5]] }))).toBe(false);
        });
        it('caps viewports at 5', () => {
            const six = Array.from({ length: 6 }, (_, i) => [1000 + i]);
            expect(ok(withStorybook({ viewports: six }))).toBe(false);
            expect(errors(withStorybook({ viewports: six }))).toMatch(/max storybook viewports allowed - 5/);
        });
        it('caps resolutions at 5 with its own message', () => {
            const six = Array.from({ length: 6 }, (_, i) => [1000 + i]);
            expect(errors(withStorybook({ resolutions: six }))).toMatch(/max storybook resolutions allowed - 5/);
        });
        it('rejects an empty viewports array', () => {
            expect(ok(withStorybook({ viewports: [] }))).toBe(false);
        });
    });

    describe('waitForTimeout', () => {
        it('accepts 0 and the 300000 ceiling', () => {
            expect(ok(withStorybook({ waitForTimeout: 0 }))).toBe(true);
            expect(ok(withStorybook({ waitForTimeout: 300000 }))).toBe(true);
        });
        it('rejects a negative value', () => {
            expect(ok(withStorybook({ waitForTimeout: -1 }))).toBe(false);
        });
        it('rejects a value above the ceiling', () => {
            expect(ok(withStorybook({ waitForTimeout: 300001 }))).toBe(false);
        });
    });

    describe('backgroundTheme', () => {
        it.each(['light', 'dark', 'both'])('accepts %s', (theme) => {
            expect(ok(withStorybook({ backgroundTheme: theme }))).toBe(true);
        });
        it('rejects anything else', () => {
            expect(ok(withStorybook({ backgroundTheme: 'sepia' }))).toBe(false);
        });
    });

    describe('chunkSize', () => {
        it('accepts 1', () => {
            expect(ok(withStorybook({ chunkSize: 1 }))).toBe(true);
        });
        it('rejects 0', () => {
            expect(ok(withStorybook({ chunkSize: 0 }))).toBe(false);
        });
    });

    describe('customViewports', () => {
        it('accepts styles alone', () => {
            expect(ok(withStorybook({ customViewports: [{ stories: ['a'], styles: { width: 800 } }] }))).toBe(true);
        });
        it('accepts waitForTimeout alone', () => {
            expect(ok(withStorybook({ customViewports: [{ stories: ['a'], waitForTimeout: 10 }] }))).toBe(true);
        });
        it('rejects both styles and waitForTimeout together', () => {
            expect(ok(withStorybook({ customViewports: [{ stories: ['a'], styles: { width: 800 }, waitForTimeout: 10 }] }))).toBe(false);
        });
        it('rejects neither styles nor waitForTimeout', () => {
            expect(ok(withStorybook({ customViewports: [{ stories: ['a'] }] }))).toBe(false);
        });
        it('rejects stories and exclude together', () => {
            expect(ok(withStorybook({ customViewports: [{ stories: ['a'], exclude: ['b'], styles: { width: 800 } }] }))).toBe(false);
        });
        it('requires a width when styles is given', () => {
            expect(ok(withStorybook({ customViewports: [{ stories: ['a'], styles: { height: 600 } }] }))).toBe(false);
        });
    });
});

describe('SnapshotSchema: ignoreColors (TE-24908 regression guard)', () => {
    const snapshot = (options: unknown) => ({
        name: 'home',
        url: 'https://example.com',
        dom: { html: '<html></html>' },
        options,
    });

    // Snapshot `options` is additionalProperties:false, so a branch cut before the
    // ignoreColors work rejected the whole payload with the literal message
    // "Invalid snapshot", surfacing as an HTTP 500 and an Error-Build with 0 screenshots.
    it.each([
        ['cssSelector', { cssSelector: ['.price'] }],
        ['id', { id: ['total'] }],
        ['class', { class: ['muted'] }],
        ['xpath', { xpath: ['//div'] }],
        ['entireScreenshot', { entireScreenshot: true }],
    ])('accepts ignoreColors with %s', (_label, ignoreColors) => {
        validateSnapshot(snapshot({ ignoreColors }));
        const messages = (validateSnapshot.errors ?? []).map((e) => e.message).join(' | ');
        expect(messages).not.toMatch(/ignoreColors/);
    });

    it('still accepts ignoreDOM and selectDOM, which predate the branch cut', () => {
        for (const options of [{ ignoreDOM: { cssSelector: ['.x'] } }, { selectDOM: { cssSelector: ['.x'] } }]) {
            validateSnapshot(snapshot(options));
            const messages = (validateSnapshot.errors ?? []).map((e) => e.message).join(' | ');
            expect(messages).not.toMatch(/ignoreDOM|selectDOM/);
        }
    });

    it('rejects an unknown snapshot option', () => {
        expect(validateSnapshot(snapshot({ ignoreColours: { cssSelector: ['.x'] } }))).toBe(false);
    });
});
