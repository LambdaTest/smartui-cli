import { ListrTask, ListrRendererFactory } from 'listr2';
import { execSync } from 'child_process';
import { Context } from '../types.js'
import getGitInfo, { isGitRepo } from '../lib/git.js'
import chalk from 'chalk';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Fetching git repo details`,
        skip: (ctx): string => {
            return (!isGitRepo()) ? '[SKIPPED] Fetching git repo details; not a git repo' : '';
        },
        task: async (ctx, task): Promise<void> => {
            try {
                ctx.git = getGitInfo();
                task.output = chalk.gray(`branch: ${ctx.git.branch}, commit: ${ctx.git.commitId}, author: ${ctx.git.commitAuthor}`);
                task.title = 'Fetched git information'
            } catch (error: any) {
                task.output = chalk.gray(`${error.message}`)
                throw new Error('Error fetching git repo details')
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}
