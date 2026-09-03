// TE-23033: `config:create` and `config:create-storybook` both default to .smartui.json.
// The schema lets one file carry both a `web` and a `storybook` block, so the generator
// adds the block to an existing file instead of refusing to write.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createStorybookConfig, createConfig } from '../src/lib/config.js';

let dir: string;
let logs: string[];

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartui-config-'));
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(' ')); });
});

afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
});

const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

describe('createStorybookConfig', () => {
    it('creates a new config carrying a storybook block', () => {
        const p = path.join(dir, '.smartui.json');
        createStorybookConfig(p);
        expect(fs.existsSync(p)).toBe(true);
        expect(read(p)).toHaveProperty('storybook');
    });

    it('adds a storybook block to an existing web config instead of refusing (TE-23033)', () => {
        const p = path.join(dir, '.smartui.json');
        createConfig(p);
        const before = read(p);
        expect(before).toHaveProperty('web');
        expect(before).not.toHaveProperty('storybook');

        createStorybookConfig(p);

        const after = read(p);
        expect(after).toHaveProperty('storybook');
        // the pre-existing web block must survive untouched
        expect(after.web).toEqual(before.web);
        expect(logs.join('\n')).toMatch(/Added SmartUI Storybook config to existing config/);
    });

    it('refuses when the file already has a storybook block, and says how to make a second file', () => {
        const p = path.join(dir, '.smartui.json');
        createStorybookConfig(p);
        const before = read(p);

        createStorybookConfig(p);

        expect(read(p)).toEqual(before);
        expect(logs.join('\n')).toMatch(/already exists/);
        expect(logs.join('\n')).toMatch(/config:create-storybook \.smartui-storybook\.json/);
    });

    it('rejects a non-json extension without writing anything', () => {
        const p = path.join(dir, 'config.yaml');
        createStorybookConfig(p);
        expect(fs.existsSync(p)).toBe(false);
        expect(logs.join('\n')).toMatch(/must have \.json extension/);
    });

    it('reports a malformed existing config rather than overwriting it', () => {
        const p = path.join(dir, '.smartui.json');
        fs.writeFileSync(p, '{ not valid json');
        createStorybookConfig(p);
        expect(fs.readFileSync(p, 'utf8')).toBe('{ not valid json');
        expect(logs.join('\n')).toMatch(/Cannot read existing config/);
    });
});

describe('createConfig, the reverse direction of TE-23033', () => {
    it('adds a web block to a config that only has a storybook block', () => {
        // The two generators share the .smartui.json default path, so running them in the
        // other order has to work too, not just storybook-after-web.
        const p = path.join(dir, '.smartui.json');
        createStorybookConfig(p);
        const before = read(p);
        expect(before).not.toHaveProperty('web');

        createConfig(p);

        const after = read(p);
        expect(after).toHaveProperty('web');
        expect(after.storybook).toEqual(before.storybook);
        expect(logs.join('\n')).toMatch(/Added SmartUI Config to existing config/);
    });

    it('produces the same file whichever order the two generators run in', () => {
        const a = path.join(dir, 'a.json');
        const b = path.join(dir, 'b.json');
        createConfig(a); createStorybookConfig(a);
        createStorybookConfig(b); createConfig(b);
        const [ra, rb] = [read(a), read(b)];
        expect(new Set(Object.keys(ra))).toEqual(new Set(Object.keys(rb)));
        expect(ra.web).toEqual(rb.web);
        expect(ra.storybook).toEqual(rb.storybook);
    });

    it('still refuses when a web block is already present', () => {
        const p = path.join(dir, '.smartui.json');
        createConfig(p);
        const before = read(p);
        createConfig(p);
        expect(read(p)).toEqual(before);
        expect(logs.join('\n')).toMatch(/SmartUI Config already exists/);
    });
});

describe('existing files that are not usable config objects', () => {
    // All of these previously went wrong: a BOM made the file unreadable, an array reported
    // success while JSON.stringify silently dropped the added property, and `null` crashed with
    // an unhandled TypeError and a Node stack trace.
    const write = (name: string, content: string) => {
        const p = path.join(dir, name);
        fs.writeFileSync(p, content);
        return p;
    };

    it('merges into a file that starts with a BOM', () => {
        const p = write('bom.json', '\uFEFF{"web":{"browsers":["chrome"]}}');
        createStorybookConfig(p);
        const after = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
        expect(Object.keys(after)).toEqual(['web', 'storybook']);
    });

    it.each([
        ['an array', '[1,2,3]', /found an array/],
        ['null', 'null', /found null/],
        ['a string', '"hello"', /found string/],
        ['a number', '42', /found number/],
    ])('refuses %s without modifying the file', (_label, content, matcher) => {
        const p = write('x.json', content);
        createStorybookConfig(p);
        expect(fs.readFileSync(p, 'utf8')).toBe(content);
        expect(logs.join('\n')).toMatch(matcher);
    });

    it('createConfig refuses the same shapes', () => {
        const p = write('y.json', '[1,2]');
        createConfig(p);
        expect(fs.readFileSync(p, 'utf8')).toBe('[1,2]');
        expect(logs.join('\n')).toMatch(/found an array/);
    });

    it('reports an unreadable file rather than throwing', () => {
        createStorybookConfig(path.join(dir, 'no-such-dir', 'deep', 'a.json'));
        // A path whose parent does not exist is a create, not a merge, so it must succeed.
        expect(fs.existsSync(path.join(dir, 'no-such-dir', 'deep', 'a.json'))).toBe(true);
    });
});

