export const environment = {
    stage: {
        SMARTUI_CLIENT_API_URL: "https://stage-api.lambdatestinternal.com",
    },
    prod: {
        SMARTUI_CLIENT_API_URL: "https://api.lambdatest.com",
    }
};

export const constants = {
    //API paths
    VALIDATE_PATH: 'visualui/1.0/token/verify',
    BUILD_PATH: "visualui/1.0/build",
    SCREENSHOT_PATH: "visualui/1.0/screenshot",


    //exit codes
    ABNORMAL_EXIT: 1,
    BUILD_NOT_APPROVED_EXIT: 4,


    EDGE_CHANNEL: 'msedge',
    CHROME: 'chrome',
    SAFARI: 'safari',
    FIREFOX: 'firefox',
    EDGE: 'edge',

    CHROMIUM: 'chromium',
    WEBKIT: 'webkit',

}
