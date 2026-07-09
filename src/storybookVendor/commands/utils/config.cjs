const defaultSmartUIConfig = {
    storybook: {
        browsers: [
            'chrome',
            'firefox',
            'safari',
            'edge'
        ],
        viewports: [
            [1920, 1080]
        ],
        waitForTimeout: 0,
        include: [],
        exclude: [],
        customViewports: []
    }
};

module.exports = { defaultSmartUIConfig }