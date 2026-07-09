// Pretty terminal-UI helpers for the SmartUI Storybook command.
// Uses figlet (banner), gradient-string (color), boxen (frames), chalk, log-symbols.
// Every helper degrades gracefully to plain text if a lib or a TTY is unavailable,
// so output is never broken in CI / piped contexts.

let figlet, gradient, boxen, chalk, logSymbols;
try { figlet = require('figlet'); } catch (_) {}
try { gradient = require('gradient-string'); } catch (_) {}
try { boxen = require('boxen'); } catch (_) {}
try { chalk = require('chalk'); } catch (_) {}
try { logSymbols = require('log-symbols'); } catch (_) {}

// SmartUI brand ramp — the visual-regression "diff magenta" into violet/cyan.
const RAMP = ['#c0286f', '#7b2ff7', '#2f9e8f'];
const paint = (s) => {
  try { return gradient(RAMP)(s); } catch (_) { return s; }
};
const dim = (s) => { try { return chalk.gray(s); } catch (_) { return s; } };
const bold = (s) => { try { return chalk.bold(s); } catch (_) { return s; } };

function banner() {
  let art;
  try {
    art = figlet.textSync('SmartUI', { font: 'ANSI Shadow', horizontalLayout: 'fitted' });
  } catch (_) {
    art = null;
  }
  if (art) {
    console.log('\n' + paint(art));
  } else {
    console.log('\n' + paint('◆ SmartUI'));
  }
  console.log(dim('  Visual regression for Storybook  ·  LambdaTest\n'));
}

function box(title, lines, opts = {}) {
  const body = lines.join('\n');
  const content = (title ? bold(title) + '\n\n' : '') + body;
  if (!boxen) { console.log('\n' + content + '\n'); return; }
  try {
    console.log(boxen(content, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 1, bottom: 0, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: opts.color || 'magenta',
      title: opts.tag,
      titleAlignment: 'left',
    }));
  } catch (_) {
    console.log('\n' + content + '\n');
  }
}

// key/value rows, aligned.
function kv(pairs) {
  const w = Math.max(...pairs.map(([k]) => k.length));
  return pairs
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${dim((k + ':').padEnd(w + 2))} ${v}`);
}

function runHeader({ target, mode, buildName, env, configPath, browsers, viewports, storyHint }) {
  box('Storybook Visual Test', kv([
    ['Target', target],
    ['Mode', mode === 'url' ? 'URL · live server (client render)' : 'DIR · static build (cloud render)'],
    ['Build', buildName || dim('auto-generated')],
    ['Env', env || 'prod'],
    ['Config', configPath || dim('defaults')],
    ['Browsers', browsers],
    ['Viewports', viewports],
    ['Stories', storyHint],
  ]), { tag: ' launch ', color: 'magenta' });
}

function resultBox(ok, { buildUrl, message } = {}) {
  const sym = logSymbols ? (ok ? logSymbols.success : logSymbols.error) : (ok ? '✔' : '✖');
  const head = ok ? paint('Storybook build submitted') : (chalk ? chalk.red('Storybook run failed') : 'Storybook run failed');
  const lines = [];
  if (buildUrl) lines.push(kv([['Dashboard', buildUrl]])[0]);
  if (message) lines.push(message);
  if (!lines.length) lines.push(dim(ok ? 'Check the SmartUI dashboard for results.' : 'See the log above for details.'));
  box(`${sym} ${head}`, lines, { tag: ok ? ' done ' : ' error ', color: ok ? 'green' : 'red' });
}

module.exports = { banner, box, kv, runHeader, resultBox, paint, dim, bold };
