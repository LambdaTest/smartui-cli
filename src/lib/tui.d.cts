// Type surface for the terminal UI helpers.
//
// tui.cjs is CommonJS so that esbuild bundles it as CJS under the CLI's
// "type": "module", and so that it degrades gracefully when its optional
// pretty-printing dependencies are unavailable. Every function here is
// best-effort: none of them throw, and all of them no-op sensibly without a TTY.

export interface RunHeaderInput {
    target: string;
    mode: 'url' | 'dir';
    buildName?: string;
    env?: string;
    configPath?: string;
    browsers?: string;
    viewports?: string;
    storyHint?: string;
}

export interface BoxOptions {
    /** Short label rendered into the box border, e.g. ' done '. */
    tag?: string;
    /** Border colour name understood by the underlying box renderer. */
    color?: string;
}

export interface ResultBoxInput {
    buildUrl?: string;
    message?: string;
}

/** Gradient figlet banner. No-ops when there is no TTY. */
export declare function banner(): void;
/** Render a titled box around `lines`. */
export declare function box(title: string, lines: string[], opts?: BoxOptions): void;
/** Format label/value pairs, skipping any pair whose value is null, undefined or empty. */
export declare function kv(pairs: Array<[string, string | number | null | undefined]>): string[];
/** Boxed summary of what this run is about to do. */
export declare function runHeader(input: RunHeaderInput): void;
/** Terminal success/failure box. */
export declare function resultBox(ok: boolean, input?: ResultBoxInput): void;
/** Apply the SmartUI gradient to a string, returning it unchanged on failure. */
export declare function paint(s: string): string;
/** Dim a string, returning it unchanged on failure. */
export declare function dim(s: string): string;
/** Bold a string, returning it unchanged on failure. */
export declare function bold(s: string): string;

declare const _default: {
    banner: typeof banner;
    box: typeof box;
    kv: typeof kv;
    runHeader: typeof runHeader;
    resultBox: typeof resultBox;
    paint: typeof paint;
    dim: typeof dim;
    bold: typeof bold;
};
export default _default;
