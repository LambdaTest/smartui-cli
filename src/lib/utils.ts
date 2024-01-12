import fs from 'fs';

const HTTP_SCHEME = 'https:';
const HTTP_SCHEME_PREFIX = 'https://';
const WWW = 'www.';

export function delDir(dir: string): void {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
    }
}

// Function to ensure URL uses HTTPS scheme
export function ensureHttps(urlString: string) {
    try {
        if (urlString && urlString.startsWith(WWW)) {
            urlString = HTTP_SCHEME_PREFIX + urlString
        }
        let url = new URL(urlString);
        if (url.protocol !== HTTP_SCHEME) {
            url.protocol = HTTP_SCHEME;
        }
        return url.toString();
    } catch (error) {
        console.error('Invalid URL: '+urlString, error);
        return null;
    }
}