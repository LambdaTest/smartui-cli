export default {
    // default configs
    DEFAULT_CONFIG: {
        web: {
            browsers: [
                'chrome',
                'firefox',
                'safari',
                'edge'
            ],
            viewports: [
                [1920],
                [1366],
                [1028],
            ],
        },
        mobile: {
            devices: [
                'iPhone 14',
                'Galaxy S24',
            ],
            fullPage: true,
            orientation: 'portrait'
        },
        waitForTimeout: 1000,
        enableJavaScript: false,
        allowedHostnames: [],
        smartIgnore: false
    },
    DEFAULT_WEB_STATIC_CONFIG: [
        {
            "name": "lambdatest-home-page",
            "url": "https://www.lambdatest.com",
            "waitForTimeout": 1000
        },
        {
            "name": "example-page",
            "url": "https://example.com/"
        }
    ],

    // browsers
    CHROME: 'chrome',
    SAFARI: 'safari',
    FIREFOX: 'firefox',
    EDGE: 'edge',
    EDGE_CHANNEL: 'msedge',
    WEBKIT: 'webkit',

    // discovery browser launch arguments
    LAUNCH_ARGS: [
        // disable the translate popup and optimization downloads
        '--disable-features=Translate,OptimizationGuideModelDownloading',
        // disable several subsystems which run network requests in the background
        '--disable-background-networking',
        // disable task throttling of timer tasks from background pages
        '--disable-background-timer-throttling',
        // disable backgrounding renderer processes
        '--disable-renderer-backgrounding',
        // disable backgrounding renderers for occluded windows (reduce nondeterminism)
        '--disable-backgrounding-occluded-windows',
        // disable crash reporting
        '--disable-breakpad',
        // disable client side phishing detection
        '--disable-client-side-phishing-detection',
        // disable default component extensions with background pages for performance
        '--disable-component-extensions-with-background-pages',
        // disable installation of default apps on first run
        '--disable-default-apps',
        // work-around for environments where a small /dev/shm partition causes crashes
        '--disable-dev-shm-usage',
        // disable extensions
        '--disable-extensions',
        // disable hang monitor dialogs in renderer processes
        '--disable-hang-monitor',
        // disable inter-process communication flooding protection for javascript
        '--disable-ipc-flooding-protection',
        // disable web notifications and the push API
        '--disable-notifications',
        // disable the prompt when a POST request causes page navigation
        '--disable-prompt-on-repost',
        // disable syncing browser data with google accounts
        '--disable-sync',
        // disable site-isolation to make network requests easier to intercept
        '--disable-site-isolation-trials',
        // disable the first run tasks, whether or not it's actually the first run
        '--no-first-run',
        // disable the sandbox for all process types that are normally sandboxed
        '--no-sandbox',
        // specify a consistent encryption backend across platforms
        '--password-store=basic',
        // use a mock keychain on Mac to prevent blocking permissions dialogs
        '--use-mock-keychain',
        // enable remote debugging on the first available port
        '--remote-debugging-port=0',
        // sets navigator.webdriver to false
        '--disable-blink-features=AutomationControlled',
        // disable UA-CH feature
		`--disable-features=UserAgentClientHint`,
    ],

    // discovery request headers
    REQUEST_HEADERS: {
        // `HeadlessChrome` is added to sec-ch-ua, `--disable-features=UserAgentClientHint` doesn't seem to work
        'sec-ch-ua':'"Chromium";v="129", "Not=A?Brand";v="8"',
        'sec-ch-ua-mobile': '"?0"',
        'sec-ch-ua-platform': '"Windows"'
    },

    // user agents
    CHROME_USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.107 Safari/537.3',
    FIREFOX_USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:112.0) Gecko/20100101 Firefox/112.0',
    SAFARI_USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
    EDGE_USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.35',

    // viewports
    MIN_VIEWPORT_HEIGHT: 1080,

    // mobile
    MOBILE_OS_ANDROID: 'android',
    MOBILE_OS_IOS: 'ios',
    MOBILE_ORIENTATION_PORTRAIT: 'portrait',
    MOBILE_ORIENTATION_LANDSCAPE: 'landscape',

    // build status
    BUILD_COMPLETE: 'completed',
    BUILD_ERROR: 'error',

    // CI
    GITHUB_API_HOST: 'https://api.github.com',

    // log file path
    LOG_FILE_PATH: '.smartui.log',

    // Disallowed file extension
    FILE_EXTENSION_ZIP: '.zip',
    FILE_EXTENSION_GIFS: 'gif',

    // Default scrollTime
    DEFAULT_SCROLL_TIME: 8,

    // Magic Numbers 
    MAGIC_NUMBERS: [
        { ext: 'jpg', magic: Buffer.from([0xFF, 0xD8, 0xFF]) },
        { ext: 'jpeg', magic: Buffer.from([0xFF, 0xD8, 0xFF]) },
        { ext: 'png', magic: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) },
        { ext: 'gif', magic: Buffer.from([0x47, 0x49, 0x46, 0x38]) },
    ],

    SUPPORTED_MOBILE_DEVICES: {
        'Blackberry KEY2 LE': { os: 'android', viewport: { width: 412, height: 618 } },
        'Galaxy A12': { os: 'android', viewport: { width: 360, height: 800 } },
        'Galaxy A21s': { os: 'android', viewport: { width: 412, height: 915 } },
        'Galaxy A22': { os: 'android', viewport: { width: 358, height: 857 } },
        'Galaxy A31': { os: 'android', viewport: { width: 412, height: 915 } },
        'Galaxy A32': { os: 'android', viewport: { width: 412, height: 915 } },
        'Galaxy A51': { os: 'android', viewport: { width: 412, height: 915 } },
        'Galaxy A7': { os: 'android', viewport: { width: 412, height: 846 } },
        'Galaxy A70': { os: 'android', viewport: { width: 412, height: 915 } },
        'Galaxy A8': { os: 'android', viewport: { width: 360, height: 740 } },
        'Galaxy A8 Plus': { os: 'android', viewport: { width: 412, height: 846 } },
        'Galaxy J7 Prime': { os: 'android', viewport: { width: 360, height: 640 } },
        'Galaxy M12': { os: 'android', viewport: { width: 412, height: 915 } },
        'Galaxy M31': { os: 'android', viewport: { width: 412, height: 892 } },
        'Galaxy Note10': { os: 'android', viewport: { width: 412, height: 869 } },
        'Galaxy Note10 Plus': { os: 'android', viewport: { width: 412, height: 869 } },
        'Galaxy Note20': { os: 'android', viewport: { width: 412, height: 915 } },
        'Galaxy Note20 Ultra': { os: 'android', viewport: { width: 412, height: 869 } },
        'Galaxy S10': { os: 'android', viewport: { width: 360, height: 760 } },
        'Galaxy S10 Plus': { os: 'android', viewport: { width: 412, height: 869 } },
        'Galaxy S10e': { os: 'android', viewport: { width: 412, height: 740 } },
        'Galaxy S20': { os: 'android', viewport: { width: 360, height: 800 } },
        'Galaxy S20 FE': { os: 'android', viewport: { width: 412, height: 914 } },
        'Galaxy S20 Ultra': { os: 'android', viewport: { width: 412, height: 915 } },
        'Galaxy S20 Plus': { os: 'android', viewport: { width: 384, height: 854 } },
        'Galaxy S21': { os: 'android', viewport: { width: 360, height: 800 } },
        'Galaxy S21 FE': { os: 'android', viewport: { width: 360, height: 780 } },
        'Galaxy S21 Ultra': { os: 'android', viewport: { width: 384, height: 854 } },
        'Galaxy S21 Plus': { os: 'android', viewport: { width: 360, height: 800 } },
        'Galaxy S22': { os: 'android', viewport: { width: 360, height: 780 } },
        'Galaxy S22 Ultra': { os: 'android', viewport: { width: 384, height: 854 } },
        'Galaxy S23': { os: 'android', viewport: { width: 360, height: 645 } },
        'Galaxy S23 Plus': { os: 'android', viewport: { width: 360, height: 648 } },
        'Galaxy S23 Ultra': { os: 'android', viewport: { width: 384, height: 689 } },
        'Galaxy S24': { os: 'android', viewport: { width: 360, height: 780 } },
        'Galaxy S24 Plus': { os: 'android', viewport: { width: 384, height: 832 } },
        'Galaxy S24 Ultra': { os: 'android', viewport: { width: 384, height: 832 } },
        'Galaxy S7': { os: 'android', viewport: { width: 360, height: 640 } },
        'Galaxy S7 Edge': { os: 'android', viewport: { width: 360, height: 640 } },
        'Galaxy S8': { os: 'android', viewport: { width: 360, height: 740 } },
        'Galaxy S8 Plus': { os: 'android', viewport: { width: 360, height: 740 } },
        'Galaxy S9': { os: 'android', viewport: { width: 360, height: 740 } },
        'Galaxy S9 Plus': { os: 'android', viewport: { width: 360, height: 740 } },
        'Galaxy Tab A7 Lite': { os: 'android', viewport: { width: 534, height: 894 } },
        'Galaxy Tab A8': { os: 'android', viewport: { width: 800, height: 1280 } },
        'Galaxy Tab S3': { os: 'android', viewport: { width: 1024, height: 768 } },
        'Galaxy Tab S4': { os: 'android', viewport: { width: 712, height: 1138 } },
        'Galaxy Tab S7': { os: 'android', viewport: { width: 800, height: 1192 } },
        'Galaxy Tab S8': { os: 'android', viewport: { width: 753, height: 1205 } },
        'Galaxy Tab S8 Plus': { os: 'android', viewport: { width: 825, height: 1318 } },
        'Huawei Mate 20 Pro': { os: 'android', viewport: { width: 360, height: 780 } },
        'Huawei P20 Pro': { os: 'android', viewport: { width: 360, height: 747 } },
        'Huawei P30': { os: 'android', viewport: { width: 360, height: 780 } },
        'Huawei P30 Pro': { os: 'android', viewport: { width: 360, height: 780 } },
        'Microsoft Surface Duo': { os: 'android', viewport: { width: 1114, height: 705 } },
        'Moto G7 Play': { os: 'android', viewport: { width: 360, height: 760 } },
        'Moto G9 Play': { os: 'android', viewport: { width: 393, height: 786 } },
        'Moto G Stylus (2022)': { os: 'android', viewport: { width: 432, height: 984 } },
        'Nexus 5': { os: 'android', viewport: { width: 360, height: 640 } },
        'Nexus 5X': { os: 'android', viewport: { width: 412, height: 732 } },
        'Nokia 5': { os: 'android', viewport: { width: 360, height: 640 } },
        'Nothing Phone (1)': { os: 'android', viewport: { width: 412, height: 915 } },
        'OnePlus 10 Pro': { os: 'android', viewport: { width: 412, height: 919 } },
        'OnePlus 11': { os: 'android', viewport: { width: 360, height: 804 } },
        'OnePlus 6': { os: 'android', viewport: { width: 412, height: 869 } },
        'OnePlus 6T': { os: 'android', viewport: { width: 412, height: 892 } },
        'OnePlus 7': { os: 'android', viewport: { width: 412, height: 892 } },
        'OnePlus 7T': { os: 'android', viewport: { width: 412, height: 914 } },
        'OnePlus 8': { os: 'android', viewport: { width: 412, height: 915 } },
        'OnePlus 9': { os: 'android', viewport: { width: 411, height: 915 } },
        'OnePlus 9 Pro': { os: 'android', viewport: { width: 412, height: 919 } },
        'OnePlus Nord': { os: 'android', viewport: { width: 412, height: 914 } },
        'OnePlus Nord 2': { os: 'android', viewport: { width: 412, height: 915 } },
        'OnePlus Nord CE': { os: 'android', viewport: { width: 412, height: 915 } },
        'Oppo A12': { os: 'android', viewport: { width: 360, height: 760 } },
        'Oppo A15': { os: 'android', viewport: { width: 360, height: 800 } },
        'Oppo A54': { os: 'android', viewport: { width: 360, height: 800 } },
        'Oppo A5s': { os: 'android', viewport: { width: 360, height: 760 } },
        'Oppo F17': { os: 'android', viewport: { width: 360, height: 800 } },
        'Oppo K10': { os: 'android', viewport: { width: 360, height: 804 } },
        'Pixel 3': { os: 'android', viewport: { width: 412, height: 823 } },
        'Pixel 3 XL': { os: 'android', viewport: { width: 412, height: 846 } },
        'Pixel 3a': { os: 'android', viewport: { width: 412, height: 823 } },
        'Pixel 4': { os: 'android', viewport: { width: 392, height: 830 } },
        'Pixel 4 XL': { os: 'android', viewport: { width: 412, height: 823 } },
        'Pixel 4a': { os: 'android', viewport: { width: 393, height: 851 } },
        'Pixel 5': { os: 'android', viewport: { width: 393, height: 851 } },
        'Pixel 6': { os: 'android', viewport: { width: 393, height: 786 } },
        'Pixel 6 Pro': { os: 'android', viewport: { width: 412, height: 892 } },
        'Pixel 7': { os: 'android', viewport: { width: 412, height: 915 } },
        'Pixel 7 Pro': { os: 'android', viewport: { width: 412, height: 892 } },
        'Pixel 8': { os: 'android', viewport: { width: 412, height: 915 } },
        'Pixel 8 Pro': { os: 'android', viewport: { width: 448, height: 998 } },
        'Poco M2 Pro': { os: 'android', viewport: { width: 393, height: 873 } },
        'POCO X3 Pro': { os: 'android', viewport: { width: 393, height: 873 } },
        'Realme 5i': { os: 'android', viewport: { width: 360, height: 800 } },
        'Realme 7i': { os: 'android', viewport: { width: 360, height: 800 } },
        'Realme 8i': { os: 'android', viewport: { width: 360, height: 804 } },
        'Realme C21Y': { os: 'android', viewport: { width: 360, height: 800 } },
        'Realme C21': { os: 'android', viewport: { width: 360, height: 800 } },
        'Realme GT2 Pro': { os: 'android', viewport: { width: 360, height: 804 } },
        'Redmi 8': { os: 'android', viewport: { width: 360, height: 760 } },
        'Redmi 9': { os: 'android', viewport: { width: 360, height: 800 } },
        'Redmi 9C': { os: 'android', viewport: { width: 360, height: 800 } },
        'Redmi Note 10 Pro': { os: 'android', viewport: { width: 393, height: 873 } },
        'Redmi Note 8': { os: 'android', viewport: { width: 393, height: 851 } },
        'Redmi Note 8 Pro': { os: 'android', viewport: { width: 393, height: 851 } },
        'Redmi Note 9': { os: 'android', viewport: { width: 393, height: 851 } },
        'Redmi Note 9 Pro Max': { os: 'android', viewport: { width: 393, height: 873 } },
        'Redmi Y2': { os: 'android', viewport: { width: 360, height: 720 } },
        'Tecno Spark 7': { os: 'android', viewport: { width: 360, height: 800 } },
        'Vivo Y22': { os: 'android', viewport: { width: 385, height: 860 } },
        'Vivo T1': { os: 'android', viewport: { width: 393, height: 873 } },
        'Vivo V7': { os: 'android', viewport: { width: 360, height: 720 } },
        'Vivo Y11': { os: 'android', viewport: { width: 360, height: 722 } },
        'Vivo Y12': { os: 'android', viewport: { width: 360, height: 722 } },
        'Vivo Y20g': { os: 'android', viewport: { width: 385, height: 854 } },
        'Vivo Y50': { os: 'android', viewport: { width: 393, height: 786 } },
        'Xiaomi 12 Pro': { os: 'android', viewport: { width: 412, height: 915 } },
        'Xperia Z5': { os: 'android', viewport: { width: 360, height: 640 } },
        'Xperia Z5 Dual': { os: 'android', viewport: { width: 360, height: 640 } },
        'Zenfone 6': { os: 'android', viewport: { width: 412, height: 892 } },
        'iPad 10.2 (2019)': { os: 'ios', viewport: { width: 810, height: 1080 } },
        'iPad 10.2 (2020)': { os: 'ios', viewport: { width: 834, height: 1194 } },
        'iPad 10.2 (2021)': { os: 'ios', viewport: { width: 810, height: 1080 } },
        'iPad 9.7 (2017)': { os: 'ios', viewport: { width: 768, height: 1024 } },
        'iPad Air (2019)': { os: 'ios', viewport: { width: 834, height: 1112 } },
        'iPad Air (2020)': { os: 'ios', viewport: { width: 820, height: 1180 } },
        'iPad Air (2022)': { os: 'ios', viewport: { width: 820, height: 1180 } },
        'iPad mini (2019)': { os: 'ios', viewport: { width: 768, height: 1024 } },
        'iPad mini (2021)': { os: 'ios', viewport: { width: 744, height: 1133 } },
        'iPad Pro 11 (2021)': { os: 'ios', viewport: { width: 834, height: 1194 } },
        'iPad Pro 11 (2022)': { os: 'ios', viewport: { width: 834, height: 1194 } },
        'iPad Pro 12.9 (2018)': { os: 'ios', viewport: { width: 1024, height: 1366 } },
        'iPad Pro 12.9 (2020)': { os: 'ios', viewport: { width: 1024, height: 1366 } },
        'iPad Pro 12.9 (2021)': { os: 'ios', viewport: { width: 1024, height: 1366 } },
        'iPad Pro 12.9 (2022)': { os: 'ios', viewport: { width: 1024, height: 1366 } },
        'iPhone 11': { os: 'ios', viewport: { width: 375, height: 812 } },
        'iPhone 11 Pro': { os: 'ios', viewport: { width: 375, height: 812 } },
        'iPhone 11 Pro Max': { os: 'ios', viewport: { width: 414, height: 896 } },
        'iPhone 12': { os: 'ios', viewport: { width: 390, height: 844 } },
        'iPhone 12 Mini': { os: 'ios', viewport: { width: 375, height: 812 } },
        'iPhone 12 Pro': { os: 'ios', viewport: { width: 390, height: 844 } },
        'iPhone 12 Pro Max': { os: 'ios', viewport: { width: 428, height: 926 } },
        'iPhone 13': { os: 'ios', viewport: { width: 390, height: 844 } },
        'iPhone 13 Mini': { os: 'ios', viewport: { width: 390, height: 844 } },
        'iPhone 13 Pro': { os: 'ios', viewport: { width: 390, height: 844 } },
        'iPhone 13 Pro Max': { os: 'ios', viewport: { width: 428, height: 926 } },
        'iPhone 14': { os: 'ios', viewport: { width: 390, height: 844 } },
        'iPhone 14 Plus': { os: 'ios', viewport: { width: 428, height: 926 } },
        'iPhone 14 Pro': { os: 'ios', viewport: { width: 390, height: 844 } },
        'iPhone 14 Pro Max': { os: 'ios', viewport: { width: 428, height: 928 } },
        'iPhone 15': { os: 'ios', viewport: { width: 393, height: 852 } },
        'iPhone 15 Plus': { os: 'ios', viewport: { width: 430, height: 932 } },
        'iPhone 15 Pro': { os: 'ios', viewport: { width: 393, height: 852 } },
        'iPhone 15 Pro Max': { os: 'ios', viewport: { width: 430, height: 932 } },
        'iPhone 6': { os: 'ios', viewport: { width: 375, height: 667 } },
        'iPhone 6s': { os: 'ios', viewport: { width: 375, height: 667 } },
        'iPhone 6s Plus': { os: 'ios', viewport: { width: 414, height: 736 } },
        'iPhone 7': { os: 'ios', viewport: { width: 375, height: 667 } },
        'iPhone 7 Plus': { os: 'ios', viewport: { width: 414, height: 736 } },
        'iPhone 8': { os: 'ios', viewport: { width: 375, height: 667 } },
        'iPhone 8 Plus': { os: 'ios', viewport: { width: 414, height: 736 } },
        'iPhone SE (2016)': { os: 'ios', viewport: { width: 320, height: 568 } },
        'iPhone SE (2020)': { os: 'ios', viewport: { width: 375, height: 667 } },
        'iPhone SE (2022)': { os: 'ios', viewport: { width: 375, height: 667 } },
        'iPhone X': { os: 'ios', viewport: { width: 375, height: 812 } },
        'iPhone XR': { os: 'ios', viewport: { width: 414, height: 896 } },
        'iPhone XS': { os: 'ios', viewport: { width: 375, height: 812 } },
        'iPhone XS Max': { os: 'ios', viewport: { width: 414, height: 896 } },
    },

    FIGMA_API: 'https://api.figma.com/v1/',
    DEFAULT_FIGMA_CONFIG: {
        "depth": 2,
        "figma_config": [
            {
                "figma_file_token": "token_for_first_figma_file",
                "figma_ids": [
                    "id1",
                    "id2"
                ]
            }
        ]
    }
}
