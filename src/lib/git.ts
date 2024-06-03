import { execSync } from 'child_process'
import { Git, Context } from '../types.js'
import constants from './constants.js'
import fs from 'fs'

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

export default (ctx: Context): Git => {
	if (ctx.env.SMARTUI_GIT_INFO_FILEPATH) {
		let gitInfo = JSON.parse(fs.readFileSync(ctx.env.SMARTUI_GIT_INFO_FILEPATH, 'utf-8'));

		return {
			branch: ctx.env.CURRENT_BRANCH || gitInfo.branch || '',
			commitId: gitInfo.commit_id.slice(0,6) || '',
			commitMessage: gitInfo.commit_body || '',
			commitAuthor: gitInfo.commit_author || '',
			githubURL: (ctx.env.GITHUB_ACTIONS) ? `${constants.GITHUB_API_HOST}/repos/${process.env.GITHUB_REPOSITORY}/statuses/${gitInfo.commit_id}` : '',
			baselineBranch: ctx.env.BASELINE_BRANCH || ''
		}
	} else {
		const splitCharacter = '<##>';
		const prettyFormat = ["%h", "%H", "%s", "%f", "%b", "%at", "%ct", "%an", "%ae", "%cn", "%ce", "%N", ""];
		const command = 'git log -1 --pretty=format:"' + prettyFormat.join(splitCharacter) + '"' +
			' && git rev-parse --abbrev-ref HEAD' +
			' && git tag --contains HEAD'

		let res = executeCommand(command).split(splitCharacter);

		// e.g. master\n or master\nv1.1\n or master\nv1.1\nv1.2\n
		var branchAndTags = res[res.length-1].split('\n').filter(n => n);
		var branch = ctx.env.CURRENT_BRANCH || branchAndTags[0];
		var tags = branchAndTags.slice(1);

		return {
			branch: branch || '',
			commitId: res[0] || '',
			commitMessage: res[2] || '',
			commitAuthor: res[7] || '',
			githubURL: (ctx.env.GITHUB_ACTIONS) ? `${constants.GITHUB_API_HOST}/repos/${process.env.GITHUB_REPOSITORY}/statuses/${res[1]}` : '',
			baselineBranch: ctx.env.BASELINE_BRANCH || ''
		};
	}
}
