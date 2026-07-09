var constants = {}

constants.stage = {
    AUTH_URL: "https://stage-api.lambdatestinternal.com/storybook/auth",
    RENDER_API_URL: "https://stage-api.lambdatestinternal.com/storybook/render",
    BUILD_STATUS_URL: "https://stage-api.lambdatestinternal.com/storybook/status",
    BASE_URL: "https://stage-api.lambdatestinternal.com",
    SB_BUILD_VALIDATE_PATH: "/storybook/validate",
    CHECK_UPDATE_PATH: "storybook/packageinfo",
    GET_SIGNED_URL_PATH: "/storybook/url",
    STATIC_RENDER_PATH: "/storybook/staticrender"
};
constants.prod = {
    AUTH_URL: "https://api.lambdatest.com/storybook/auth",
    RENDER_API_URL: "https://api.lambdatest.com/storybook/render",
    BUILD_STATUS_URL: "https://api.lambdatest.com/storybook/status",
    BASE_URL: "https://api.lambdatest.com",
    SB_BUILD_VALIDATE_PATH: "/storybook/validate",
    CHECK_UPDATE_PATH: "storybook/packageinfo",
    GET_SIGNED_URL_PATH: "/storybook/url",
    STATIC_RENDER_PATH: "/storybook/staticrender"
};
constants.VALID_BROWSERS = ['chrome', 'safari', 'firefox', 'edge'];

// Error codes
constants.ERROR_CATCHALL = 1
constants.ERROR_BUILD_ALREADY_EXISTS = 3
constants.ERROR_CHANGES_FOUND_OR_REJECTED = 4

module.exports = { constants };