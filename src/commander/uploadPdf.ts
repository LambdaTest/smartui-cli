import {Command} from "commander";
import { Context } from '../types.js';
import ctxInit from '../lib/ctx.js';
import { color, Listr, ListrDefaultRendererLogLevels, LoggerFormat } from 'listr2';
import fs from 'fs';
import auth from '../tasks/auth.js';
import uploadPdfs from '../tasks/uploadPdfs.js';
import getGitInfo from '../tasks/getGitInfo.js';
import {startPdfPolling, fetchPdfSyncResults} from "../lib/utils.js";
import constants from '../lib/constants.js';
const command = new Command();

command
    .name('upload-pdf')
    .description('Upload PDFs for visual comparison')
    .argument('<directory>', 'Path of the directory containing PDFs')
    .option('--fetch-results [filename]', 'Fetch results and optionally specify an output file, e.g., <filename>.json')
    .option('--buildName <string>', 'Specify the build name')
    .option('--markBaseline', 'Mark this build baseline')
    .option('--pdfNames <string>', 'Specify PDF names for the upload')
    .option('--sync', 'Wait for the uploaded PDFs to be compared and return the results')
    .action(async function(directory, _, command) {
        const options = command.optsWithGlobals();
        if (options.buildName === '') {
            console.log(`Error: The '--buildName' option cannot be an empty string.`);
            process.exit(1);
        }
        let opts = command.optsWithGlobals();
        opts.commandType = constants.COMMAND_TYPE_UPLOAD_PDF;
        let ctx: Context = ctxInit(opts);

        if (!fs.existsSync(directory)) {
            console.log(`Error: The provided directory ${directory} not found.`);
            process.exit(1);
        }

        ctx.uploadFilePath = directory;

        let tasks = new Listr<Context>(
            [
                auth(ctx),
                getGitInfo(ctx),
                uploadPdfs(ctx)
            ],
            {
                rendererOptions: {
                    icon: {
                        [ListrDefaultRendererLogLevels.OUTPUT]: `→`
                    },
                    color: {
                        [ListrDefaultRendererLogLevels.OUTPUT]: color.gray as LoggerFormat
                    }
                }
            }
        );

        try {
            await tasks.run(ctx);

            if (ctx.options.sync && ctx.build && ctx.build.id) {
                // sync already waits for every page, so the background poller would only duplicate it
                await fetchPdfSyncResults(ctx);
            } else if (ctx.options.fetchResults && ctx.build && ctx.build.id) {
                startPdfPolling(ctx);
            }
        } catch (error) {
            console.log('\nRefer docs: https://www.lambdatest.com/support/docs/smart-visual-regression-testing/');
            process.exit(1);
        }
    });

export default command;