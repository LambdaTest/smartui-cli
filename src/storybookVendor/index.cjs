// Vendored, faithful relocation of @lambdatest/smartui-storybook v1.1.32.
// This preserves the PROVEN, shipping Storybook engine and its /storybook/* backend
// flow verbatim — it is only relocated into the unified smartui-cli binary so there
// is one `smartui` binary instead of two colliding ones. Behavior is unchanged.
//
// The action bodies below mirror the original package's index.js command actions
// (minus the standalone version banner / update check, which the host CLI owns).
//
// NOTE: modules are required lazily inside the functions and accessed via the module
// object (not top-level destructuring) so the bundled graph is fully initialized
// before any binding is read — this avoids esbuild capturing an export too early.

// Mirrors index.js `storybook` action.
async function runStorybook(serve, options) {
  const { storybook } = require('./commands/storybook.cjs');
  const validate = require('./commands/utils/validate.cjs');

  options.env = options.env || 'prod';

  // Reject an explicitly-empty --buildName, exactly as the original did.
  if (options.buildName === '') {
    const error = {
      error: 'MISSING_BUILD_NAME',
      message: 'The --buildName flag requires a value.',
    };
    console.log(JSON.stringify(error, null, 2));
    process.exit(1);
  }

  if (options.config) {
    options.tunnel = validate.validateTunnel(options.config);
    options.config = validate.validateConfig(options.config);
  }

  await validate.validateProjectToken(options);
  if (!options.forceRebuild) await validate.validateLatestBuild(options);
  await storybook(serve, options);
}

// Mirrors index.js `config create` action.
function createStorybookConfig(filepath) {
  const { createConfig } = require('./commands/config.cjs');
  createConfig(filepath);
}

module.exports = { runStorybook, createStorybookConfig };
