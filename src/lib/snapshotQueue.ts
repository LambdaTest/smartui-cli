import { Snapshot, Context} from "../types.js";
import constants from "./constants.js";
import processSnapshot from "./processSnapshot.js"
import { v4 as uuidv4 } from 'uuid';

export default class Queue {
    private snapshots: Array<Snapshot> = [];
    private processedSnapshots: Array<Record<string, any>> = [];
    private processing: boolean = false;
    private processingSnapshot: string = '';
    private ctx: Context;
    private snapshotNames: Array<string> = [];
    private variants: Array<string> = [];

    constructor(ctx: Context) {
        this.ctx = ctx;
    }

    enqueue(item: Snapshot): void {
        this.snapshots.push(item);
        if(!this.ctx.config.delayedUpload){
            if (!this.processing) {
                this.processing = true;
                this.processNext();
            }
        }
    }

    startProcessingfunc(): void {
        if (!this.processing) {
            this.processing = true;
            this.processNext();
        }
    }

    private processGenerateVariants(snapshot: Snapshot): void {
        if (snapshot.options) {
            if (snapshot.options.web) {
                this.generateWebVariants(snapshot, snapshot.options.web);
            }
            if (snapshot.options.mobile) {
                this.generateMobileVariants(snapshot, snapshot.options.mobile);
            }
        } 
        
        if (!snapshot.options || (snapshot.options && !snapshot.options.web && !snapshot.options.mobile)) {
            this.generateVariants(snapshot, this.ctx.config);
        }
    }
    

    private generateVariants(snapshot: Snapshot, config: any): void {
        // Process web configurations if they exist
        
        if (config.web) {
            const browsers = config.web.browsers || [];
            const viewports = config.web.viewports || [];
            
            for (const browser of browsers) {
                for (const viewport of viewports) {
                    const width = viewport.width;
                    const height = viewport.height || 0;  // Use 0 if height is not provided
                    const variant = `${snapshot.name}_${browser}_viewport[${width}]_viewport[${height}]`;
                    this.variants.push(variant);
                }
            }
        }
    
        // Process mobile configurations if they exist
        if (config.mobile) {
            const devices = config.mobile.devices || [];
            const orientation = config.mobile.orientation || constants.MOBILE_ORIENTATION_PORTRAIT;
        
            for (const device of devices) {
                const variant = `${snapshot.name}_${device}_${orientation}`;
                this.variants.push(variant);
            }
        }
    }
    

    private generateWebVariants(snapshot: Snapshot, webConfig: any): void {
        const browsers = webConfig.browsers ?? this.ctx.config.web?.browsers ?? [constants.CHROME, constants.EDGE, constants.FIREFOX, constants.SAFARI];
        const viewports = webConfig.viewports || [];
        
        for (const browser of browsers) {
            for (const viewport of viewports) {
                const width = viewport[0];
                const height = viewport[1] || 0;  // Use 0 if height is not provided
                const variant = `${snapshot.name}_${browser}_viewport[${width}]_viewport[${height}]`;
                this.variants.push(variant);
            }
        }
    }

    private generateMobileVariants(snapshot: Snapshot, mobileConfig: any): void {
        const devices = mobileConfig.devices || [];
        const orientation = mobileConfig.orientation ?? this.ctx.config.mobile?.orientation ?? constants.MOBILE_ORIENTATION_PORTRAIT;
        
        for (const device of devices) {
            const variant = `${snapshot.name}_${device}_${orientation}`;
            this.variants.push(variant);
        }
    }
    

    private filterExistingVariants(snapshot: Snapshot, config: any): boolean {

        let drop = true;

        if (snapshot.options && snapshot.options.web) {
            const webDrop = this.filterWebVariants(snapshot, snapshot.options.web);
            if (!webDrop) drop = false;
        }
        
        if (snapshot.options && snapshot.options.mobile) {
            const mobileDrop = this.filterMobileVariants(snapshot, snapshot.options.mobile);
            if (!mobileDrop) drop = false;
        }
        
        // Fallback to the global config if neither web nor mobile options are present in snapshot.options
        if (!snapshot.options || (snapshot.options && !snapshot.options.web && !snapshot.options.mobile)) {
            const configDrop = this.filterVariants(snapshot, config);
            if (!configDrop) drop = false;
        }
        return drop;
    }

    private filterVariants(snapshot: Snapshot, config: any): boolean {
        let allVariantsDropped = true;
    
        // Process web configurations if they exist in config
        if (config.web) {
            const browsers = config.web.browsers || [];
            const viewports = config.web.viewports || [];
    
            for (const browser of browsers) {
                for (const viewport of viewports) {
                    const width = viewport.width;
                    const height = viewport.height || 0;
                    const variant = `${snapshot.name}_${browser}_viewport[${width}]_viewport[${height}]`;
    
                    if (!this.variants.includes(variant)) {
                        allVariantsDropped = false; // Found a variant that needs processing
                        if (!snapshot.options) snapshot.options = {};
                        if (!snapshot.options.web) snapshot.options.web = { browsers: [], viewports: [] };
                        
                        if (!snapshot.options.web.browsers.includes(browser)) {
                            snapshot.options.web.browsers.push(browser);
                        }
    
                        // Check for unique viewports to avoid duplicates
                        const viewportExists = snapshot.options.web.viewports.some(existingViewport => 
                            existingViewport[0] === width &&
                            (existingViewport.length < 2 || existingViewport[1] === height)
                        );
    
                        if (!viewportExists) {
                            if (height > 0) {
                                snapshot.options.web.viewports.push([width, height]);
                            } else {
                                snapshot.options.web.viewports.push([width]);
                            }
                        }
                    }
                }
            }
        }
    
        // Process mobile configurations if they exist in config
        if (config.mobile) {
            const devices = config.mobile.devices || [];
            const orientation = config.mobile.orientation || constants.MOBILE_ORIENTATION_PORTRAIT;
            const fullPage = config.mobile.fullPage ?? true;
        
            for (const device of devices) {
                const variant = `${snapshot.name}_${device}_${orientation}`;
        
                if (!this.variants.includes(variant)) {
                    allVariantsDropped = false; // Found a variant that needs processing
                    if (!snapshot.options) snapshot.options = {};
                    if (!snapshot.options.mobile) snapshot.options.mobile = { devices: [], orientation: constants.MOBILE_ORIENTATION_PORTRAIT, fullPage: fullPage };
                    
                    if (!snapshot.options.mobile.devices.includes(device)) {
                        snapshot.options.mobile.devices.push(device);
                    }
                    snapshot.options.mobile.orientation = orientation;
                }
            }
        }
        
    
        return allVariantsDropped;
    }    
    
    private filterWebVariants(snapshot: Snapshot, webConfig: any): boolean {
        const browsers = webConfig.browsers ?? this.ctx.config.web?.browsers ?? [constants.CHROME, constants.EDGE, constants.FIREFOX, constants.SAFARI];
        const viewports = webConfig.viewports || [];
        let allVariantsDropped = true;
    
        if (!snapshot.options) {
            snapshot.options = {};
        }
    
        snapshot.options.web = { browsers: [], viewports: [] };
        
        for (const browser of browsers) {
            for (const viewport of viewports) {
                const width = viewport[0];
                const height = viewport[1] || 0;
                const variant = `${snapshot.name}_${browser}_viewport[${width}]_viewport[${height}]`;
    
                if (!this.variants.includes(variant)) {
                    allVariantsDropped = false; // Found a variant that needs processing
                    if (!snapshot.options.web.browsers.includes(browser)) {
                        snapshot.options.web.browsers.push(browser);
                    }
                    // Only add unique viewports to avoid duplicates
                    const viewportExists = snapshot.options.web.viewports.some(existingViewport => 
                        existingViewport[0] === width &&
                        (existingViewport.length < 2 || existingViewport[1] === height)
                    );                 
                    if (!viewportExists) {
                        if (height > 0) {
                            snapshot.options.web.viewports.push([width, height]);
                        } else {
                            snapshot.options.web.viewports.push([width]);
                        }
                    }
                }
            }
        }
        return allVariantsDropped;
    }
    
    
    private filterMobileVariants(snapshot: Snapshot, mobileConfig: any): boolean {
        if (!snapshot.options) {
            snapshot.options = {};
        }
    
        const devices = mobileConfig.devices || [];
        const orientation = mobileConfig.orientation ?? this.ctx.config.mobile?.orientation ?? constants.MOBILE_ORIENTATION_PORTRAIT;
        const fullPage = mobileConfig.fullPage ?? this.ctx.config.mobile?.fullPage ?? true;
        let allVariantsDropped = true;

        snapshot.options.mobile = { devices: [], orientation: constants.MOBILE_ORIENTATION_PORTRAIT, fullPage: fullPage };
        
        for (const device of devices) {
            const variant = `${snapshot.name}_${device}_${orientation}`;
    
            if (!this.variants.includes(variant)) {
                allVariantsDropped = false; // Found a variant that needs processing
                snapshot.options.mobile.devices.push(device);
                snapshot.options.mobile.orientation = orientation;
            }
        }
        return allVariantsDropped;
    }

    private async processNext(): Promise<void> {
        if (!this.isEmpty()) {
            let snapshot;
            if (this.ctx.config.delayedUpload){
                snapshot = this.snapshots.pop();
            } else {
                snapshot = this.snapshots.shift();
            }
            try {
                this.processingSnapshot = snapshot?.name;
                let drop = false;

                if (!this.ctx.config.delayedUpload && snapshot && snapshot.name && this.snapshotNames.includes(snapshot.name)) {
                    drop = true;
                    this.ctx.log.info(`Skipping duplicate SmartUI snapshot '${snapshot.name}'. To capture duplicate screenshots, please set the 'delayedUpload' configuration as true in your config file.`);
                }

                if (this.ctx.config.delayedUpload && snapshot && snapshot.name && this.snapshotNames.includes(snapshot.name)) {
                    drop = this.filterExistingVariants(snapshot, this.ctx.config);
                }

                if (snapshot && snapshot.name && !this.snapshotNames.includes(snapshot.name) && !drop) {
                    this.snapshotNames.push(snapshot.name);
                }

                if (this.ctx.config.delayedUpload && snapshot && !drop) {
                    this.processGenerateVariants(snapshot);
                }

                if (!drop) {
                    let { processedSnapshot, warnings } = await processSnapshot(snapshot, this.ctx);

                    if(this.ctx.build && this.ctx.build.useKafkaFlow) {
                        const snapshotUuid = uuidv4();
                        const presignedResponse = await this.ctx.client.getS3PresignedURLForSnapshotUpload(this.ctx, processedSnapshot.name, snapshotUuid);
                        const uploadUrl = presignedResponse.data.url;
                        
                        await this.ctx.client.uploadSnapshotToS3(this.ctx, uploadUrl, processedSnapshot)
                        await this.ctx.client.processSnapshot(this.ctx, processedSnapshot, snapshotUuid);
                    } else {
                        await this.ctx.client.uploadSnapshot(this.ctx, processedSnapshot);
                    }

                    this.ctx.totalSnapshots++;
                    this.processedSnapshots.push({ name: snapshot.name, warnings });
                }
            } catch (error: any) {
                this.ctx.log.debug(`snapshot failed; ${error}`);
                this.processedSnapshots.push({ name: snapshot.name, error: error.message });
            }
            // Close open browser contexts and pages
            if (this.ctx.browser) {
                for (let context of this.ctx.browser.contexts()) {
                    for (let page of context.pages()) {
                        await page.close();
                        this.ctx.log.debug(`Closed browser page for snapshot ${snapshot.name}`);
                    }
                    await context.close();
                    this.ctx.log.debug(`Closed browser context for snapshot ${snapshot.name}`);
                }
            }
            this.processNext();
        } else {
            this.processing = false;
        }
    }

    isProcessing(): boolean {
        return this.processing;
    }

    getProcessingSnapshot(): string {
        return this.processingSnapshot;
    }

    getProcessedSnapshots(): Array<Record<string, any>> {
        return this.processedSnapshots;
    }

    isEmpty(): boolean {
        return this.snapshots && this.snapshots.length ? false : true;
    }
}