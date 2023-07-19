import fs from 'fs';

export function cleanupDir(log, dir) {
    log.debug("cleanupDir initiated")
    // Skip if dir doesnot exists
    if (!fs.existsSync(dir)) {
        log.debug(`skipping as ${dir} directory doesn't exists`);
        return
    }
    fs.rm(dir, { recursive: true }, (err) => {
        if (err) {
            return log.error(err);
        }
    });
    return true
}

export function cleanFile(log, filePath) {
    log.debug("cleanFile filePath :" + filePath)
    fs.rm(filePath, (err) => {
        if (err) {
            return log.error(err);
        }
    });
    return true
}