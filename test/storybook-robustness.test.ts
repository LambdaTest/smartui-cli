// Adversarial cases: malformed story indexes and Storybook URLs that are not at the origin root.
// Everything here failed before the fixes it guards: raw TypeErrors on a truncated index, a
// string index silently yielding stories named "0".."3", and sub-path deployments resolving
// every URL against the wrong base.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { normalizeStoryEntries, skipStory } = require('../src/storybookVendor/commands/utils/story.cjs');
const { filterStories } = require('../src/storybookVendor/commands/utils/static.cjs');
const { storybookBase, fetchStoryIndex } = require('../src/storybookVendor/commands/storybook.cjs');
const { httpClient } = require('../src/storybookVendor/commands/utils/httpClient.cjs');

describe('storybookBase', () => {
    // `new URL('index.json', 'http://h/sb')` resolves to 'http://h/index.json': without a
    // trailing slash the last segment is a filename and gets replaced.
    it('adds a trailing slash so relative paths resolve under the base', () => {
        expect(new URL('index.json', storybookBase('http://h/sb')).href).toBe('http://h/sb/index.json');
        expect(new URL('index.json', storybookBase('http://h/sb/')).href).toBe('http://h/sb/index.json');
    });

    it('leaves an origin-root URL alone', () => {
        expect(new URL('index.json', storybookBase('http://h')).href).toBe('http://h/index.json');
        expect(new URL('index.json', storybookBase('http://h/')).href).toBe('http://h/index.json');
    });

    it('keeps story URLs under a sub-path instead of at the origin root', () => {
        const base = storybookBase('http://h/team/storybook');
        expect(new URL('iframe.html?id=btn--x&viewMode=story', base).href)
            .toBe('http://h/team/storybook/iframe.html?id=btn--x&viewMode=story');
    });

    it('preserves port and deep paths', () => {
        expect(new URL('index.json', storybookBase('http://h:6006/a/b/c')).href)
            .toBe('http://h:6006/a/b/c/index.json');
    });
});

describe('fetchStoryIndex against a sub-path', () => {
    afterEach(() => vi.restoreAllMocks());

    it('requests the index under the sub-path, not at the root', async () => {
        const seen: string[] = [];
        vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
            seen.push(url);
            if (url === 'http://h/team/sb/index.json') {
                return { data: { v: 5, entries: { 'a--b': { type: 'story', name: 'B' } } } };
            }
            throw new Error('404');
        });
        const index = await fetchStoryIndex('http://h/team/sb');
        expect(index.source).toBe('index.json');
        expect(seen[0]).toBe('http://h/team/sb/index.json');
    });

    it('rejects a non-index payload rather than iterating it by character', async () => {
        // A proxy error page served as JSON at index.json used to yield stories "0".."3".
        vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
            if (url.endsWith('index.json')) return { data: { entries: 'nope' } };
            throw new Error('404');
        });
        await expect(fetchStoryIndex('http://h/')).rejects.toThrow();
    });
});

describe('normalizeStoryEntries', () => {
    it.each([
        ['null', null],
        ['undefined', undefined],
        ['a string', 'nope'],
        ['a number', 7],
        ['an array', [{ type: 'story' }]],
    ])('rejects %s', (_label, input) => {
        expect(normalizeStoryEntries(input)).toBeNull();
    });

    it('keeps object entries and drops junk ones', () => {
        const out = normalizeStoryEntries({
            good: { type: 'story', name: 'Good' },
            nullish: null,
            str: 'x',
            arr: [1, 2],
        });
        expect(Object.keys(out)).toEqual(['good']);
    });

    it('returns an empty object for an empty index rather than null', () => {
        expect(normalizeStoryEntries({})).toEqual({});
    });
});

describe('skipStory is null-safe', () => {
    it.each([[null], [undefined], ['a string'], [42]])('skips %s instead of throwing', (input) => {
        expect(skipStory(input, {})).toBe(true);
    });
});

describe('filterStories on malformed indexes', () => {
    let dir: string;
    let logs: string[];
    let exitCode: number | undefined;
    let realExit: typeof process.exit;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartui-fuzz-'));
        logs = [];
        exitCode = undefined;
        vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(' ')); });
        realExit = process.exit;
        // @ts-expect-error deliberately replacing process.exit for the duration of the test
        process.exit = (code?: number) => { exitCode = code; throw new Error('__EXIT__'); };
    });
    afterEach(() => {
        process.exit = realExit;
        vi.restoreAllMocks();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    const write = (content: string) => fs.writeFileSync(path.join(dir, 'index.json'), content);
    const run = () => {
        try { return { ids: filterStories(dir, {}) }; }
        catch (e) { return { exited: exitCode, log: logs.join('\n') }; }
    };

    it('reports a truncated index instead of throwing a SyntaxError', () => {
        write('{"entries": {"a":');
        const r = run();
        expect(r.exited).toBe(1);
        expect(r.log).toMatch(/Could not parse/);
    });

    it.each([
        ['entries: null', '{"v":5,"entries":null}'],
        ['no entries key', '{"v":5}'],
        ['entries as a string', '{"v":5,"entries":"nope"}'],
        ['entries as an array', '{"v":5,"entries":[]}'],
    ])('reports %s instead of throwing a TypeError', (_label, content) => {
        write(content);
        const r = run();
        expect(r.exited).toBe(1);
        expect(r.log).toMatch(/does not contain a story index/);
    });

    it('reports an empty index through the No stories found path', () => {
        write('{"v":5,"entries":{}}');
        const r = run();
        expect(r.exited).toBe(1);
        expect(r.log).toMatch(/No stories found/);
    });

    it('drops junk entries but keeps the real ones', () => {
        write(JSON.stringify({ v: 5, entries: { bad: null, worse: 'x', good: { type: 'story', name: 'G' } } }));
        expect(run().ids).toEqual(['good']);
    });
});
