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

export function isGitRepo(ctx: Context): boolean {
	try {
		executeCommand('git status')
		return true
	} catch (error) {
		setNonGitInfo(ctx)
		return false
	}
}

export default (ctx: Context): Git => {
	if (ctx.env.SMART_GIT) {
		ctx.env.BASELINE_BRANCH = ''
		if (ctx.options.baselineBranch !== '') {
			ctx.env.SMART_GIT = false
		}
	}
	let githubURL;
	if (ctx.options.githubURL && ctx.options.githubURL.startsWith('https://')) {
		githubURL = ctx.options.githubURL;
	}
	if (ctx.env.SMARTUI_GIT_INFO_FILEPATH) {
		let gitInfo = JSON.parse(fs.readFileSync(ctx.env.SMARTUI_GIT_INFO_FILEPATH, 'utf-8'));

		if (ctx.options.markBaseline) {
			ctx.env.BASELINE_BRANCH = ctx.env.CURRENT_BRANCH || gitInfo.branch || ''
			ctx.env.SMART_GIT = false
		}

		return {
			branch: ctx.env.CURRENT_BRANCH || gitInfo.branch || '',
			commitId: gitInfo.commit_id.slice(0,6) || '',
			commitMessage: gitInfo.commit_body || '',
			commitAuthor: gitInfo.commit_author || '',
			githubURL: githubURL ? githubURL : (ctx.env.GITHUB_ACTIONS) ? `${constants.GITHUB_API_HOST}/repos/${process.env.GITHUB_REPOSITORY}/statuses/${gitInfo.commit_id}` : '',
			baselineBranch: ctx.options.baselineBranch || ctx.env.BASELINE_BRANCH || ''
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

		if (ctx.options.markBaseline) {
			ctx.env.BASELINE_BRANCH = branch || ''
			ctx.env.SMART_GIT = false
		}

		return {
			branch: branch || '',
			commitId: res[0] || '',
			commitMessage: res[2] || '',
			commitAuthor: res[7] || '',
			githubURL: githubURL ? githubURL : (ctx.env.GITHUB_ACTIONS) ? `${constants.GITHUB_API_HOST}/repos/${process.env.GITHUB_REPOSITORY}/statuses/${res[1]}` : '',
			baselineBranch: ctx.options.baselineBranch || ctx.env.BASELINE_BRANCH || ''
		};
	}
}


function setNonGitInfo(ctx: Context) {
	let branch = ctx.env.CURRENT_BRANCH || 'unknown-branch'
	if (ctx.options.markBaseline) {
		ctx.env.BASELINE_BRANCH = branch
		ctx.env.SMART_GIT = false
	}
	let githubURL;
	if (ctx.options.githubURL && ctx.options.githubURL.startsWith('https://')) {
		githubURL = ctx.options.githubURL;
	}

	ctx.git = {
		branch: branch,
		commitId: '-',
		commitAuthor: '-',
		commitMessage: '-',
		githubURL: githubURL? githubURL : '',
		baselineBranch: ctx.options.baselineBranch || ctx.env.BASELINE_BRANCH || ''
	}
}	