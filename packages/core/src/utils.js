import cp from 'child_process';

export function generateId(str) {
  const lowercaseStr = str.toLowerCase();
  const noSpacesStr = lowercaseStr.replace(/\s/g, '-');
  return noSpacesStr;
}

function executeCommand(command, options) {
  let dst = process.cwd()

  if (!!options && options.dst) {
    dst = options.dst
  }

  try {
    return cp.execSync(command, {
      cwd: dst,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8'
    });
  } catch (error) {
    return '';
  }
}

export async function getLastCommit(options) {
  const splitCharacter = '<##>';
  const prettyFormat = ["%h", "%H", "%s", "%f", "%b", "%at", "%ct", "%an", "%ae", "%cn", "%ce", "%N", ""];
  const command = 'git log -1 --pretty=format:"' + prettyFormat.join(splitCharacter) + '"' +
    ' && git rev-parse --abbrev-ref HEAD' +
    ' && git tag --contains HEAD'

  let res = executeCommand(command, options);
  res = res.split(splitCharacter);

  // e.g. master\n or master\nv1.1\n or master\nv1.1\nv1.2\n
  var branchAndTags = res[res.length - 1].split('\n').filter(n => n);
  var branch = branchAndTags[0];
  var tags = branchAndTags.slice(1);

  return {
    shortHash: res[0] || '',
    hash: res[1] || '',
    subject: res[2] || '',
    sanitizedSubject: res[3] || '',
    body: res[4] || '',
    authoredOn: res[5] || '',
    committedOn: res[6] || '',
    author: {
      name: res[7] || '',
      email: res[8] || '',
    },
    committer: {
      name: res[9] || '',
      email: res[10] || ''
    },
    notes: res[11] || '',
    branch: branch || '',
    tags: tags || []
  };
}



