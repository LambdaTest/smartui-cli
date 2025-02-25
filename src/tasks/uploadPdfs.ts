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

                // Get all PDF files from the directory
                const pdfs = await getPdfsFromDirectory(ctx.uploadFilePath);
                if (pdfs.length === 0) {
                    throw new Error('No PDF files found in the specified directory');
                }

                // Upload each PDF
                for (const pdf of pdfs) {
                    task.output = `Uploading ${path.basename(pdf)}...`;
                    await uploadPdf(ctx, pdf);
                }

                task.title = 'PDFs uploaded successfully';
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(`${error.message}`);
                throw new Error('Uploading PDFs failed');
            }
        },
        rendererOptions: { persistentOutput: true },
        exitOnError: false
    };
};

async function getPdfsFromDirectory(directory: string): Promise<string[]> {
    const files = await fs.promises.readdir(directory);
    return files
        .filter(file => path.extname(file).toLowerCase() === '.pdf')
        .map(file => path.join(directory, file));
}

async function uploadPdf(ctx: Context, pdfPath: string): Promise<void> {
    const formData = new FormData();
    formData.append('pathToFiles', fs.createReadStream(pdfPath));
    formData.append('name', path.basename(pdfPath, '.pdf'));
    formData.append('type', 'pdf');
    
    // Use buildName from options instead of ctx.build.name
    const buildName = ctx.options.buildName || `pdf-build-${Date.now()}`;
    
    // Store the build name in context for polling
    ctx.pdfBuildName = buildName;
    
    // Upload PDF and store response
    const response = await ctx.client.uploadPdf(formData, buildName, ctx.log);
    
    // Store buildId from response for fetching results
    if (response && response.data && response.data.buildId) {
        ctx.pdfBuildId = response.data.buildId;
        ctx.log.debug(`PDF upload successful. Build ID: ${ctx.pdfBuildId}`);
    }
} 