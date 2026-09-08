import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js';
import chalk from 'chalk';
import { updateLogContext } from '../lib/logger.js';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';
import { randomUUID } from 'node:crypto';
import { resolvePdfThresholds, readPdfThresholdInput } from '../lib/pdfThresholds.js';

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
    const uploadedFileNames: string[] = [];

    if (pdfPath.endsWith('.pdf')) {
        formData.append('pathToFiles', fs.createReadStream(pdfPath));
        uploadedFileNames.push(path.basename(pdfPath));
    } else {
        const files = fs.readdirSync(pdfPath);
        const pdfFiles = files.filter(file => file.endsWith('.pdf')).sort();

        pdfFiles.forEach(pdf => {
            const filePath = path.join(pdfPath, pdf);
            formData.append('pathToFiles', fs.createReadStream(filePath));
            uploadedFileNames.push(pdf);
        })
    }

    const buildName = ctx.options.buildName;
    const pdfNames = ctx.options.pdfNames;

    // The backend names each document from pdfNames when given, else the uploaded file name.
    // Sync polling asks by that same name, so resolve it here rather than guessing later.
    const providedNames = pdfNames ? pdfNames.split(',').map(name => name.trim()) : [];
    const documentNames = uploadedFileNames.map((fileName, index) => providedNames[index] ?? fileName);

    // resolved per pdf here, as the web path does per snapshot, so the backend gets one final
    // value per file: per-file entry, else the build-level value (flag > pdf block > top-level)
    const thresholds = resolvePdfThresholds(
        documentNames,
        readPdfThresholdInput(ctx.options.thresholds),
        ctx.options.approvalThreshold,
        ctx.options.rejectionThreshold
    );

    let snapshotUuids = '';
    if (ctx.options.sync) {
        const syncTargets = documentNames.map(name => ({ name, uuid: randomUUID() as string }));
        ctx.pdfSyncTargets = syncTargets;
        snapshotUuids = syncTargets.map(target => target.uuid).join(',');
    }

    if (buildName) {
        ctx.build.name = buildName;
    }

    try {
        const response = await ctx.client.uploadPdf(ctx, formData, buildName, pdfNames, snapshotUuids, thresholds);
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