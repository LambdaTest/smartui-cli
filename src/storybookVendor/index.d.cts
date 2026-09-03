// Type surface for the vendored Storybook engine.
//
// The engine itself stays untouched JavaScript on purpose: it is a faithful
// relocation of the shipping @lambdatest/smartui-storybook package, and
// rewriting it in TypeScript would defeat the point of vendoring something
// already proven in production. Declaring its public surface here is what lets
// src/commander/storybook.ts drop its `@ts-nocheck`.

/** Options accepted by the `smartui storybook` command action. */
export interface StorybookRunOptions {
    /** Path to a SmartUI config file carrying a `storybook` block. */
    config?: string;
    /** Skip the duplicate-build check and re-run against an existing build. */
    forceRebuild?: boolean;
    /** Build name to report to the dashboard. */
    buildName?: string;
    /** Runtime environment. Defaults to 'prod' when unset. */
    env?: 'prod' | 'stage';
    /** Populated by the engine from the config file when a tunnel is configured. */
    tunnel?: unknown;
    /** Any additional flags merged in from the root command's global options. */
    [key: string]: unknown;
}

/**
 * Snapshot a Storybook, either a live server URL or a static build directory.
 * Resolves once the build has been created and submitted.
 */
export declare function runStorybook(
    serve: string,
    options: StorybookRunOptions,
): Promise<void>;

/** Write a starter config containing a `storybook` block to `filepath`. */
export declare function createStorybookConfig(filepath: string): void;

/**
 * Replace credentials in a string with [REDACTED]. Non-strings are returned unchanged.
 * The backend echoes the caller's access key in at least one error message, so anything
 * derived from a server response is scrubbed before being printed.
 */
export declare function redactSecrets<T>(value: T): T;

declare const _default: {
    runStorybook: typeof runStorybook;
    createStorybookConfig: typeof createStorybookConfig;
    redactSecrets: typeof redactSecrets;
};
export default _default;
