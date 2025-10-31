import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js';
import chalk from 'chalk';
import { updateLogContext } from '../lib/logger.js';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory> => {
    return {
        title: 'Uploading PDFs',
        task: async (ctx, task): Promise<void> => {
            try {
                ctx.task = task;
                updateLogContext({ task: 'upload-pdf' });

                await uploadPdfs(ctx, ctx.uploadFilePath);

                task.title = 'PDFs uploaded successfully';
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.red(`${error.message}`);
                throw new Error('PDF upload failed');
            }
        },
        rendererOptions: { persistentOutput: true },
        exitOnError: false
    };
};

async function uploadPdfs(ctx: Context, pdfPath: string): Promise<void> {
    const formData = new FormData();

    if (pdfPath.endsWith('.pdf')) {
        formData.append('pathToFiles', fs.createReadStream(pdfPath));
    } else {
        const files = fs.readdirSync(pdfPath);
        const pdfFiles = files.filter(file => file.endsWith('.pdf'));

        pdfFiles.forEach(pdf => {
            const filePath = path.join(pdfPath, pdf);
            formData.append('pathToFiles', fs.createReadStream(filePath));
        })
    }

    const buildName = ctx.options.buildName;

    if (buildName) {
        ctx.build.name = buildName;
    }

    try {
        const response = await ctx.client.uploadPdf(ctx, formData, buildName);
        if (response && response.buildId) {
            ctx.build.id = response.buildId;
            ctx.log.debug(`PDF upload successful. Build ID: ${ctx.build.id}`);
        }
        if (response && response.projectId) {
            ctx.build.projectId = response.projectId;
        }
    } catch (error : any) {
        throw new Error(error.message);
    }
}