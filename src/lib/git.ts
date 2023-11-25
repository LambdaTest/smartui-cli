import { execSync } from 'child_process'
import { Git } from '../types.js'

function executeCommand(command: string): string {
	let dst = process.cwd()

	try {
		return execSync(command, {
			cwd: dst,
			stdio: ['ignore'],
			encoding: 'utf-8'
		});
	} catch (error: any) {
		throw new Error(error.message)
	}
}

export function isGitRepo(): boolean {
	try {
		executeCommand('git status')
		return true
	} catch (error) {
		return false
	}
}

export default (): Git => {
	const splitCharacter = '<##>';
	const prettyFormat = ["%h", "%H", "%s", "%f", "%b", "%at", "%ct", "%an", "%ae", "%cn", "%ce", "%N", ""];
	const command = 'git log -1 --pretty=format:"' + prettyFormat.join(splitCharacter) + '"' +
		' && git rev-parse --abbrev-ref HEAD' +
		' && git tag --contains HEAD'

  	let res = executeCommand(command).split(splitCharacter);

	// e.g. master\n or master\nv1.1\n or master\nv1.1\nv1.2\n
	var branchAndTags = res[res.length-1].split('\n').filter(n => n);
	var branch = branchAndTags[0];
	var tags = branchAndTags.slice(1);

 	return {
        branch: branch,
		commitId: res[0] || '',
		commitMessage: res[2] || '',
		commitAuthor: res[7] || ''
    };
}
