// TE-24909: Storybook >= 8 dropped stories.json and serves index.json. URL-mode discovery
// read only the legacy file, 404'd, and the run ended with 0 screenshots. These tests pin
// both generations, both payload shapes, and the docs-entry filtering that decides which
// entries actually become screenshots.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const { httpClient } = require('../src/storybookVendor/commands/utils/httpClient.cjs');
const { fetchStoryIndex } = require('../src/storybookVendor/commands/storybook.cjs');
const { skipStory } = require('../src/storybookVendor/commands/utils/story.cjs');
const { filterStories } = require('../src/storybookVendor/commands/utils/static.cjs');

// A Storybook 8 index.json: entries keyed by story id, docs entries carry type 'docs'.
const SB8 = {
    v: 5,
    entries: {
        'button--primary': { id: 'button--primary', title: 'Button', name: 'Primary', type: 'story' },
        'button--secondary': { id: 'button--secondary', title: 'Button', name: 'Secondary', type: 'story' },
        'button--docs': { id: 'button--docs', title: 'Button', name: 'Docs', type: 'docs' },
    },
};

// A Storybook 6/7 stories.json: `stories` rather than `entries`, `kind` rather than `title`,
// docs flagged through parameters.docsOnly.
const SB7 = {
    v: 4,
    stories: {
        'card--default': { id: 'card--default', kind: 'Card', name: 'Default' },
        'card--empty': { id: 'card--empty', kind: 'Card', name: 'Empty' },
        'card--page': { id: 'card--page', kind: 'Card', name: 'Page', parameters: { docsOnly: true } },
    },
};

describe('fetchStoryIndex (URL mode)', () => {
    afterEach(() => vi.restoreAllMocks());

    it('reads index.json on Storybook >= 8', async () => {
        vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
            if (url.endsWith('/index.json')) return { data: SB8 };
            throw new Error('404');
        });
        const index = await fetchStoryIndex('http://localhost:6006/');
        expect(index.source).toBe('index.json');
        expect(Object.keys(index.entries)).toHaveLength(3);
    });

    it('falls back to stories.json when index.json is absent (legacy Storybook)', async () => {
        vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
            if (url.endsWith('/stories.json')) return { data: SB7 };
            throw Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } });
        });
        const index = await fetchStoryIndex('http://localhost:6006/');
        expect(index.source).toBe('stories.json');
        expect(Object.keys(index.entries)).toHaveLength(3);
    });

    it('falls through when index.json exists but is empty, rather than stopping there', async () => {
        // Some setups serve an index.json with no entries. Before the fix this looked like
        // success and produced a zero-story run.
        vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
            if (url.endsWith('/index.json')) return { data: { v: 5, entries: {} } };
            if (url.endsWith('/stories.json')) return { data: SB7 };
            throw new Error('404');
        });
        const index = await fetchStoryIndex('http://localhost:6006/');
        expect(index.source).toBe('stories.json');
    });

    it('throws when neither file can be read', async () => {
        vi.spyOn(httpClient, 'get').mockRejectedValue(new Error('connect ECONNREFUSED'));
        await expect(fetchStoryIndex('http://localhost:6006/')).rejects.toThrow();
    });

    it('resolves the index against a URL carrying a sub-path', async () => {
        const seen: string[] = [];
        vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
            seen.push(url);
            if (url.endsWith('/index.json')) return { data: SB8 };
            throw new Error('404');
        });
        await fetchStoryIndex('http://localhost:6006/storybook/');
        expect(seen[0]).toBe('http://localhost:6006/storybook/index.json');
    });
});

describe('skipStory', () => {
    it('skips Storybook 8 docs entries', () => {
        expect(skipStory({ type: 'docs', name: 'Docs' }, {})).toBe(true);
    });

    it('skips Storybook 7 docsOnly entries', () => {
        expect(skipStory({ parameters: { docsOnly: true }, name: 'Page' }, {})).toBe(true);
    });

    it('keeps a plain story', () => {
        expect(skipStory({ type: 'story', name: 'Primary' }, {})).toBe(false);
    });

    it('honours include as a regex string', () => {
        const config = { include: ['/^Prim/'] };
        expect(skipStory({ name: 'Primary' }, config)).toBe(false);
        expect(skipStory({ name: 'Secondary' }, config)).toBe(true);
    });

    it('honours exclude as a regex string', () => {
        const config = { exclude: ['/Secondary/'] };
        expect(skipStory({ name: 'Primary' }, config)).toBe(false);
        expect(skipStory({ name: 'Secondary' }, config)).toBe(true);
    });
});

describe('filterStories (DIR mode)', () => {
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartui-static-'));
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('reads index.json entries and drops docs (Storybook >= 8 static build)', () => {
        fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(SB8));
        expect(filterStories(dir, {})).toEqual(['button--primary', 'button--secondary']);
    });

    it('reads legacy stories.json and drops docsOnly', () => {
        fs.writeFileSync(path.join(dir, 'stories.json'), JSON.stringify(SB7));
        expect(filterStories(dir, {})).toEqual(['card--default', 'card--empty']);
    });

    it('prefers index.json when both files are present, matching URL mode', () => {
        // A static dir rebuilt from Storybook 7 to 8 can keep a stale stories.json next to
        // the new index.json. Reading the stale one would give DIR mode a different story
        // set from URL mode against the same Storybook.
        fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(SB8));
        fs.writeFileSync(path.join(dir, 'stories.json'), JSON.stringify(SB7));
        expect(filterStories(dir, {})).toEqual(['button--primary', 'button--secondary']);
    });

    it('reads a legacy file that uses entries rather than stories', () => {
        fs.writeFileSync(path.join(dir, 'stories.json'), JSON.stringify({ v: 4, entries: SB7.stories }));
        expect(filterStories(dir, {})).toEqual(['card--default', 'card--empty']);
    });

    it('applies the include filter', () => {
        fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(SB8));
        expect(filterStories(dir, { include: ['/^Primary$/'] })).toEqual(['button--primary']);
    });
});
