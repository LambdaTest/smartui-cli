import { Snapshot, WebStaticConfig, FigmaDesignConfig } from '../types.js'
import Ajv, { JSONSchemaType } from 'ajv'
import addErrors from 'ajv-errors'
import constants from './constants.js'

const ajv = new Ajv({ allErrors: true });
ajv.addFormat('web-url', {
    type: 'string',
    validate: (url: string) => {
        try {
            new URL(url.trim());
            return true;
        } catch (error) {
            return false;
        }
    }
});
addErrors(ajv);

const ConfigSchema = {
    type: "object",
    properties: {
        web: {
            type: "object",
            properties: {
                browsers: {
                    type: "array",
                    items: { type: "string", enum: [constants.CHROME, constants.FIREFOX, constants.SAFARI, constants.EDGE] },
                    uniqueItems: true,
                    minItems: 1,
                    maxItems: 4,
                    errorMessage: {
                        minItems: "Invalid config; browsers must have at least one entry",
                        _: `Invalid config; allowed browsers - ${constants.CHROME}, ${constants.FIREFOX}, ${constants.SAFARI}, ${constants.EDGE}`
                    }
                },
                viewports: {
                    type: "array",
                    minItems: 1,
                    items: {
                        type: "array",
                        oneOf: [
                            {
                                items: [{ type: "number", minimum: 320, maximum: 7680 }],
                                minItems: 1,
                                maxItems: 1
                            },
                            {
                                items: [
                                    { type: "number", minimum: 320, maximum: 7680 },
                                    { type: "number", minimum: 320, maximum: 7680 }
                                ],
                                minItems: 2,
                                maxItems: 2
                            }
                        ],
                        errorMessage: "Invalid config; width/height must be >= 320 and <= 7680"
                    },
                    uniqueItems: true,
                    maxItems: 5,
                    errorMessage: {
                        minItems: "Invalid config; viewports must have at least one entry",
                        maxItems: "Invalid config; max unique viewports allowed - 5"
                    }
                },
                customViewports: {
                    type: "array",
                    minItems: 1,
                    items: {
                        type: "object",
                        properties: {
                            browser: {
                                type: "string",
                                enum: [constants.CHROME, constants.FIREFOX, constants.SAFARI, constants.EDGE],
                                errorMessage: `Invalid config; allowed browsers - ${constants.CHROME}, ${constants.FIREFOX}, ${constants.SAFARI}, ${constants.EDGE}`
                            },
                            viewport: {
                                type: "array",
                                oneOf: [
                                    {
                                        items: [{ type: "number", minimum: 320, maximum: 7680 }],
                                        minItems: 1,
                                        maxItems: 1
                                    },
                                    {
                                        items: [
                                            { type: "number", minimum: 320, maximum: 7680 },
                                            { type: "number", minimum: 320, maximum: 7680 }
                                        ],
                                        minItems: 2,
                                        maxItems: 2
                                    }
                                ],
                                errorMessage: "Invalid config; customViewports viewport width/height must be >= 320 and <= 7680"
                            }
                        },
                        required: ["browser", "viewport"],
                        additionalProperties: false
                    },
                    errorMessage: {
                        minItems: "Invalid config; customViewports must have at least one entry",
                        _: "Invalid config; customViewports must be an array of {browser, viewport} objects"
                    }
                }
            }
        },
        mobile: {
            type: "object",
            properties: {
                devices: {
                    type: "array",
                    items: {
                        type: "string",
                        enum: Object.keys(constants.SUPPORTED_MOBILE_DEVICES),
                        minLength: 1,
                        errorMessage: {
                            enum: "Invalid config; unsupported mobile devices",
                            minLength: "Invalid config; mobile device cannot be empty"
                        }
                    },
                    uniqueItems: true,
                    maxItems: 20,
                    errorMessage: {
                        uniqueItems: "Invalid config; duplicate mobile devices",
                        maxItems: "Invalid config; max mobile devices allowed - 20"
                    }
                },
                fullPage: {
                    type: "boolean",
                    errorMessage: "Invalid config; fullPage must be true/false"
                },
                orientation: {
                    type: "string",
                    enum: [constants.MOBILE_ORIENTATION_PORTRAIT, constants.MOBILE_ORIENTATION_LANDSCAPE],
                    errorMessage: `Invalid config; orientation must be ${constants.MOBILE_ORIENTATION_PORTRAIT}/${constants.MOBILE_ORIENTATION_LANDSCAPE}`
                }
            },
            required: ["devices"],
            additionalProperties: false
        },
        waitForPageRender: {
            type: "number",
            minimum: 0,
            maximum: 300000,
            errorMessage: "Invalid config; waitForPageRender must be > 0 and <= 300000"
        },
        waitForTimeout: {
            type: "number",
            minimum: 0,
            maximum: 30000,
            errorMessage: "Invalid config; waitForTimeout must be > 0 and <= 30000"
        },
        waitForDiscovery: {
            type: "number",
            minimum: 0,
            maximum: 1800000,
            errorMessage: "Invalid config; waitForDiscovery must be > 0 and <= 1800000"
        },
        enableJavaScript: {
            type: "boolean",
            errorMessage: "Invalid config; enableJavaScript must be true/false"
        },
        cliEnableJavaScript: {
            type: "boolean",
            errorMessage: "Invalid config; cliEnableJavaScript must be true/false"
        },
        smartIgnore: {
            type: "boolean",
            errorMessage: "Invalid config; smartIgnore must be true/false"
        },
        ignoreHTTPSErrors: {
            type : "boolean",
            errorMessage: "Invalid config; ignoreHttpsError must be true/false"
        },
        scrollTime: {
            type: "number",
            minimum: 1,
            maximum: 1000,
            errorMessage: "Invalid config; scrollTime must be > 1 and <= 1000"
        },
        allowedHostnames: {
            type: "array",
            items: {
                type: "string",
                minLength: 1,
                errorMessage: {
                    minLength: "Invalid config; allowed hostname cannot be empty"
                }
            },
            uniqueItems: true,
            errorMessage: {
                uniqueItems: "Invalid config; duplicates in allowedHostnames"
            }

        },
        allowedAssets: {
            type: "array",
            items: {
                type: "string",
                minLength: 1,
                errorMessage: {
                    minLength: "Invalid config; allowedAssets cannot be empty"
                }
            },
            uniqueItems: true,
            errorMessage: {
                uniqueItems: "Invalid config; duplicates in allowedAssets"
            }
        },
        basicAuthorization: {
            type: "object",
            properties: {
                username: {
                    type: "string",
                    errorMessage: "Invalid config; username is mandatory"
                },
                password: {
                    type: "string",
                    errorMessage: "Invalid config; password is mandatory"
                },
            }
        },
        lazyLoadConfiguration: {
            type: "object",
            properties: {
                enabled: {
                    type: "boolean",
                    errorMessage: "Invalid config; lazyLoad enabled must be true/false"
                },
                scrollStep: {
                    type: "number",
                    minimum: 50,
                    maximum: 2000,
                    errorMessage: "Invalid config; lazyLoad scrollStep must be > 50 and <= 2000"
                },
                scrollDelay: {
                    type: "number",
                    minimum: 100,
                    maximum: 5000,
                    errorMessage: "Invalid config; lazyLoad scrollDelay must be > 100 and <= 5000"
                },
                maxScrolls: {
                    type: "number",
                    minimum: 1,
                    maximum: 100,
                    errorMessage: "Invalid config; lazyLoad maxScrolls must be > 1 and <= 100"
                },
                jumpBackToTop: {
                    type: "boolean",    
                    errorMessage: "Invalid config; lazyLoad jumpBackToTop must be true/false"
                }
            },
            required: ["enabled"],
            additionalProperties: false
        },
        delayedUpload: {
            type: "boolean",
            errorMessage: "Invalid config; delayedUpload must be true/false"
        },
        useGlobalCache: {
            type: "boolean",
            errorMessage: "Invalid config; useGlobalCache must be true/false"
        },
        skipBuildCreation: {
            type: "boolean",
            errorMessage: "Invalid config; skipBuildCreation must be true/false"
        },
        tunnel: {
            type: "object",
            properties: {
                type: {
                    type: "string", 
                    enum: ["auto", "manual"],
                    errorMessage: "Invalid config; tunnel type is mandatory parameter of type string having value auto or manual",
                },
                tunnelName: {
                    type: "string",
                    errorMessage: "Invalid config; tunnelName should be a string value"
                },
                user: {
                    type: "string",
                    errorMessage: "Invalid config; user should be a string value"
                },
                key: {
                    type: "string",
                    errorMessage: "Invalid config; key should be a string value"
                },
                port: {
                    type: "string",
                    errorMessage: "Invalid config; port should be a string value"
                },
                proxyHost: {
                    type: "string",
                    errorMessage: "Invalid config; proxyHost should be a string value"
                },
                proxyPort: {
                    type: "number",
                    errorMessage: "Invalid config; proxyPort should be an int value"
                },
                proxyUser: {
                    type: "string",
                    errorMessage: "Invalid config; proxyUser should be a string value"
                },
                proxyPass: {
                    type: "string",
                    errorMessage: "Invalid config; proxyPass should be a string value"
                },
                dir: {
                    type: "string",
                    errorMessage: "Invalid config; dir should be a string value"
                },
                v: {
                    type: "boolean",
                    errorMessage: "Invalid config; v should be a boolean value"
                },
                logFile: {
                    type: "string",
                    errorMessage: "Invalid config; logFile should be a string value"
                },
                environment: {
                    type: "string",
                    enum: ["stage", "prod"],
                    errorMessage: "Invalid config; environment should be a string value either stage or prod"
                }
            },
            required: ["type"],
            additionalProperties: false
        },
        userAgent: {
            type: "string",
            errorMessage: "User Agent value must be a valid string"
        },
        requestHeaders: {
            type: "array",
            items: {
                type: "object",
                minProperties: 1,
                additionalProperties: { type: "string" }
            },
            uniqueItems: true,
            errorMessage: {
                uniqueItems: "Invalid config; duplicates in requestHeaders"
            }
        },
        dedicatedProxyURL: {
            type: "string",
            errorMessage: "Invalid config; dedicatedProxyURL must be a string"
        },
        geolocation: {
            type: "string",
            errorMessage: "Invalid config; geolocation must be a string like 'lat,lon'"
        },
        allowDuplicateSnapshotNames: {
            type: "boolean",
            errorMessage: "Invalid config; allowDuplicateSnapshotNames must be true/false"
        },
        useLambdaInternal: {
            type: "boolean",
            errorMessage: "Invalid config; useLambdaInternal must be true/false"
        },
        useRemoteDiscovery: {
            type: "boolean",
            errorMessage: "Invalid config; useRemoteDiscovery must be true/false"
        },
        useExtendedViewport: {
            type: "boolean",
            errorMessage: "Invalid config; useExtendedViewport must be true/false"
        },
        loadDomContent: {
            type: "boolean",
            errorMessage: "Invalid config; loadDomContent must be true/false"
        },
        customCSS: {
            type: "string",
            errorMessage: "Invalid config; customCSS must be a string"
        },
        approvalThreshold: {
            type: "number",
            minimum: 0,
            maximum: 100,
            errorMessage: "Invalid config; approvalThreshold must be a number"
        },
        rejectionThreshold: {
            type: "number",
            minimum: 0,
            maximum: 100,
            errorMessage: "Invalid config; rejectionThreshold must be a number"
        },
        showRenderErrors: {
            type: "boolean",
            errorMessage: "Invalid config; showRenderErrors must be true/false"
        }
    },
    anyOf: [
        { required: ["web"] },
        { required: ["mobile"] }
    ],
    additionalProperties: false
}

const WebStaticConfigSchema: JSONSchemaType<WebStaticConfig> = {
    type: "array",
    items: {
        type: "object",
        properties: {
            name: {
                type: "string",
                minLength: 1,
                errorMessage: "name is mandatory and cannot be empty"
            },
            url: {
                type: "string",
                format: "web-url",
                errorMessage: "url is mandatory and must be a valid web URL"
            },
            waitForTimeout: {
                type: "number",
                nullable: true,
                minimum: 0,
                maximum: 30000,
                errorMessage: "waitForTimeout must be > 0 and <= 30000"
            },
            userAgent: {
                type: "string",
                errorMessage: "User Agent value must be a valid string"
            },
            execute: {
                type: "object",
                properties: {
                    beforeNavigation: {
                        type: "string",
                    },
                    afterNavigation : {
                        type: "string",
                    },
                    beforeSnapshot: {
                        type: "string",
                    }
                }
            },
            pageEvent: {
                type: "string",
                enum: ['load', 'domcontentloaded'],
                errorMessage: "pageEvent can be load, domcontentloaded"
            },
            requestHeaders: {
                type: "array",
                items: {
                    type: "object",
                    minProperties: 1,
                    additionalProperties: { type: "string" }
                },
                uniqueItems: true,
                errorMessage: {
                    uniqueItems: "Invalid config; duplicates in requestHeaders"
                }
            },
        },
        required: ["name", "url"],
        additionalProperties: false
    },
    uniqueItems: true
}

const SnapshotSchema: JSONSchemaType<Snapshot> = {
    type: "object",
    properties: {
        name: {
            type: "string",
            minLength: 1,
            maxLength:255,
            pattern: "^.*\\S.*$",
            errorMessage: "Invalid snapshot: name is mandatory, cannot be empty, and must not exceed 255 characters."
        },
        url: {
            type: "string",
            format: "web-url",
            errorMessage: "Invalid snapshot; url is mandatory and must be a valid web URL"
        },
        dom: {
            type: "object",
        },
        options: {
            type: "object",
            properties: {
                element: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            pattern: "^[^;]*$",
                            errorMessage: "Invalid snapshot options; element id cannot be empty or have semicolon"
                        },
                        class: {
                            type: "string",
                            pattern: "^[^;]*$",
                            errorMessage: "Invalid snapshot options; element class cannot be empty or have semicolon"
                        },
                        cssSelector: {
                            type: "string",
                            pattern: "^[^;]*$",
                            errorMessage: "Invalid snapshot options; element cssSelector cannot be empty or have semicolon"
                        },
                        xpath: {
                            type: "string",
                            errorMessage: "Invalid snapshot options; element xpath cannot be empty"
                        },

                    }
                },
                ignoreDOM: {
                    type: "object",
                    properties: {
                        id: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; ignoreDOM id cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; ignoreDOM id array must have unique items"
                        },
                        class: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; ignoreDOM class cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; ignoreDOM class array must have unique items"
                        },
                        cssSelector: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; ignoreDOM cssSelector cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; ignoreDOM cssSelector array must have unique items"
                        },
                        xpath: {
                            type: "array",
                            items: { type: "string", minLength: 1 },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; ignoreDOM xpath array must have unique and non-empty items"
                        },
                        coordinates: {
                            type: "array",
                            items: { type: "string", minLength: 1 },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; ignoreDOM coordinates array must have unique and non-empty items"
                        }
                    }
                },
                selectDOM: {
                    type: "object",
                    properties: {
                        id: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; selectDOM id cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; selectDOM id array must have unique items"
                        },
                        class: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; selectDOM class cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; selectDOM class array must have unique items"
                        },
                        cssSelector: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; selectDOM cssSelector cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; selectDOM cssSelector array must have unique items"
                        },
                        xpath: {
                            type: "array",
                            items: { type: "string", minLength: 1 },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; selectDOM xpath array must have unique and non-empty items"
                        },
                        coordinates: {
                            type: "array",
                            items: { type: "string", minLength: 1 },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; selectDOM coordinates array must have unique and non-empty items"
                        }
                    }
                },
                ignoreColors: {
                    type: "object",
                    properties: {
                        id: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; ignoreColors id cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; ignoreColors id array must have unique items"
                        },
                        class: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; ignoreColors class cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; ignoreColors class array must have unique items"
                        },
                        cssSelector: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; ignoreColors cssSelector cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; ignoreColors cssSelector array must have unique items"
                        },
                        xpath: {
                            type: "array",
                            items: { type: "string", minLength: 1 },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; ignoreColors xpath array must have unique and non-empty items"
                        },
                        coordinates: {
                            type: "array",
                            items: { type: "string", minLength: 1 },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; ignoreColors coordinates array must have unique and non-empty items"
                        },
                        entireScreenshot: {
                            type: "boolean",
                            errorMessage: "Invalid snapshot options; ignoreColors entireScreenshot must be a boolean"
                        }
                    }
                },
                ignoreType: {
                    type: "array",
                    items: {
                        type: "string", minLength: 1,
                        enum: ["default", "layout", "images", "text", "colors", "dimensions", "position", "structure"],
                        errorMessage: "Invalid snapshot options;ignoreType cannot be empty"
                    },
                    uniqueItems: true,
                    errorMessage: "Invalid snapshot options; ignoreType must be an array of unique values from default, layout, images, text, colors, dimensions, position, structure"
                },
                web: {
                    type: "object",
                    properties: {
                        browsers: {
                            type: "array",
                            items: {
                                type: "string",
                                enum: [constants.CHROME, constants.FIREFOX, constants.SAFARI, constants.EDGE],
                                minLength: 1
                            },
                            uniqueItems: true,
                            errorMessage: `Invalid snapshot options; allowed browsers - ${constants.CHROME}, ${constants.FIREFOX}, ${constants.SAFARI}, ${constants.EDGE}`
                        },
                        viewports: {
                            type: "array",
                            items: {
                                type: "array",
                                items: {
                                    type: "number",
                                    minimum: 1
                                },
                                minItems: 1,
                                maxItems: 2,
                                errorMessage: "Invalid snapshot options; each viewport array must contain either a single width or a width and height tuple with positive values."
                            },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; viewports must be an array of unique arrays."
                        },
                        customViewports: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    browser: {
                                        type: "string",
                                        enum: [constants.CHROME, constants.FIREFOX, constants.SAFARI, constants.EDGE],
                                    },
                                    viewport: {
                                        type: "array",
                                        items: { type: "number", minimum: 1 },
                                        minItems: 1,
                                        maxItems: 2,
                                    }
                                },
                                required: ["browser", "viewport"],
                                additionalProperties: false
                            },
                            errorMessage: "Invalid snapshot options; customViewports must be an array of {browser, viewport} objects"
                        }
                    },
                    errorMessage: "Invalid snapshot options; web must include viewports or customViewports property."
                },
                mobile: {
                    type: "object",
                    properties: {
                        devices: {
                            type: "array",
                            items: {
                                type: "string",
                                enum: Object.keys(constants.SUPPORTED_MOBILE_DEVICES),
                                minLength: 1
                            },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; devices must be an array of unique supported mobile devices."
                        },
                        fullPage: {
                            type: "boolean",
                            errorMessage: "Invalid snapshot options; fullPage must be a boolean."
                        },
                        orientation: {
                            type: "string",
                            enum: [constants.MOBILE_ORIENTATION_PORTRAIT, constants.MOBILE_ORIENTATION_LANDSCAPE],
                            errorMessage: "Invalid snapshot options; orientation must be either 'portrait' or 'landscape'."
                        }
                    },
                    required: ["devices"],
                    errorMessage: "Invalid snapshot options; mobile must include devices property."
                },
                loadDomContent: {
                    type: "boolean",
                    errorMessage: "Invalid snapshot options; loadDomContent must be a boolean"
                },
                sessionId: {
                    type: "string",
                    errorMessage: "Invalid snapshot options; sessionId must be a string"
                },
                contextId: {
                    type: "string",
                    errorMessage: "Invalid snapshot options; contextId must be a string"
                },
                sync: {
                    type: "boolean",
                    errorMessage: "Invalid snapshot options; sync must be a boolean"
                },
                timeout: {
                    type: "number",
                    errorMessage: "Invalid snapshot options; timeout must be a number"
                },
                useExtendedViewport: {
                    type: "boolean",
                    errorMessage: "Invalid snapshot options; useExtendedViewport must be a boolean"
                },
                pageCustomScroll: {
                    type: "boolean",
                    errorMessage: "Invalid snapshot options; pageCustomScroll must be a boolean"
                },
                elementsCustomScroll: {
                    type: "boolean",
                    errorMessage: "Invalid snapshot options; elementsCustomScroll must be a boolean"
                },
                approvalThreshold: {
                    type: "number",
                    minimum: 0,
                    maximum: 100,
                    errorMessage: "Invalid snapshot options; approvalThreshold must be a number between 0 and 100"
                },
                rejectionThreshold: {
                    type: "number",
                    minimum: 0,
                    maximum: 100,
                    errorMessage: "Invalid snapshot options; rejectionThreshold must be a number between 0 and 100"
                },
                customCookies: {
                    type: "array",
                    items: {
                        type: "object",
                        minProperties: 1,
                    },
                    errorMessage: "Invalid snapshot options; customCookies must be an array of objects with string properties"
                },
                customCSS: {
                    type: "string",
                    errorMessage: "Invalid snapshot options; customCSS must be a string"
                }
            },
            additionalProperties: false
        }
    },
    required: ["name", "url", "dom"],
    additionalProperties: false,
    errorMessage: "Invalid snapshot"
}

const FigmaDesignConfigSchema: JSONSchemaType<FigmaDesignConfig> = {
    type: "object",
    properties: {
        depth: {
            type: "integer",
            minimum: 1,
            errorMessage: "Depth must be an integer and greater than 0"
        },
        figma_config: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    figma_file_token: {
                        type: "string",
                        minLength: 1,
                        errorMessage: "figma_file_token is mandatory and cannot be empty"
                    },
                    figma_ids: {
                        type: "array",
                        items: {
                            type: "string",
                            minLength: 1,
                            errorMessage: "Each ID in figma_ids must be a non-empty string"
                        },
                        minItems: 1,
                        uniqueItems: true,
                        errorMessage: {
                            type: "figma_ids must be an array of strings",
                            minItems: "figma_ids cannot be empty",
                            uniqueItems: "figma_ids must contain unique values"
                        }
                    }
                },
                required: ["figma_file_token"],
                additionalProperties: false
            },
            uniqueItems: true,
            errorMessage: {
                uniqueItems: "Each entry in the Figma design configuration must be unique"
            }
        }
    },
    required: ["figma_config"],
    additionalProperties: false
};

const FigmaWebConfigSchema: JSONSchemaType<Object> = {
    type: "object",
    "properties": {
        "web": {
            "type": "object",
            "properties": {
                browsers: {
                    type: "array",
                    items: { type: "string", enum: [constants.CHROME, constants.FIREFOX, constants.SAFARI, constants.EDGE] },
                    uniqueItems: true,
                    maxItems: 4,
                    errorMessage: `allowed browsers - ${constants.CHROME}, ${constants.FIREFOX}, ${constants.SAFARI}, ${constants.EDGE}`
                },
                "viewports": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "integer",
                            "minimum": 1
                        },
                        "minItems": 1
                    }
                }
            },
            "required": ["browsers"]
        },
        "figma": {
            "type": "object",
            "properties": {
                depth: {
                    type: "integer",
                    minimum: 1,
                    errorMessage: "Depth must be an integer and greater than 0"
                },
                "configs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "figma_file_token": {
                                "type": "string",
                                minLength: 1,
                                errorMessage: "figma_file_token is mandatory and cannot be empty"

                            },
                            "figma_ids": {
                                "type": "array",
                                "items": {
                                    "type": "string",
                                    minLength: 1,
                                    errorMessage: "Each ID in figma_ids must be a non-empty string"
                                },
                                minItems: 1,
                                uniqueItems: true,
                                errorMessage: {
                                    type: "figma_ids must be an array of strings",
                                    minItems: "figma_ids cannot be empty",
                                    uniqueItems: "figma_ids must contain unique values"
                                }
                            },
                            "screenshot_names": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                uniqueItems: false
                            },
                            "screenshot_viewports": {
                                "type": "array",
                                "items": {
                                    "type": "array",
                                    "items": {
                                        "type": "integer",
                                        "minimum": 1
                                    },
                                    "minItems": 1,
                                    "maxItems": 2
                                }
                            }
                        },
                        "required": ["figma_file_token", "figma_ids"]
                    },
                    uniqueItems: true,
                    errorMessage: {
                        uniqueItems: "Each entry in the figma configs must be unique"
                    }
                }
            },
            "required": ["configs"]
        },
        smartIgnore: {
            type: "boolean",
            errorMessage: "Invalid config; smartIgnore must be true/false"
        }
    },
    "required": ["web", "figma"],
    additionalProperties: false,
};

const FigmaAppConfigSchema: JSONSchemaType<Object> = {
    type: "object",
    "properties": {
        "web": {
            "type": "object",
            "properties": {
                browsers: {
                    type: "array",
                    items: { type: "string", enum: [constants.CHROME, constants.FIREFOX, constants.SAFARI, constants.EDGE] },
                    uniqueItems: true,
                    maxItems: 4,
                    errorMessage: `allowed browsers - ${constants.CHROME}, ${constants.FIREFOX}, ${constants.SAFARI}, ${constants.EDGE}`
                },
                "viewports": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "integer",
                            "minimum": 1
                        },
                        "minItems": 1
                    }
                }
            },
            "required": ["browsers"]
        },
        "mobile": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    name: {
                        type: "string",
                        minLength: 1,
                        enum: Object.keys(constants.SUPPORTED_MOBILE_DEVICES),
                        errorMessage: "unsupported mobile device name"
                    },
                    "platform": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        },
                        uniqueItems: true
                    },
                    orientation: {
                        type: "string",
                        enum: [constants.MOBILE_ORIENTATION_PORTRAIT, constants.MOBILE_ORIENTATION_LANDSCAPE],
                        errorMessage: `Invalid config; orientation must be ${constants.MOBILE_ORIENTATION_PORTRAIT}/${constants.MOBILE_ORIENTATION_LANDSCAPE}`
                    }
                },
                "required": ["name"]
            },
            uniqueItems: true,
        },
        "figma": {
            "type": "object",
            "properties": {
                depth: {
                    type: "integer",
                    minimum: 1,
                    errorMessage: "Depth must be an integer and greater than 0"
                },
                "configs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "figma_file_token": {
                                "type": "string",
                                minLength: 1,
                                errorMessage: "figma_file_token is mandatory and cannot be empty"

                            },
                            "figma_ids": {
                                "type": "array",
                                "items": {
                                    "type": "string",
                                    minLength: 1,
                                    errorMessage: "Each ID in figma_ids must be a non-empty string"
                                },
                                minItems: 1,
                                uniqueItems: true,
                                errorMessage: {
                                    type: "figma_ids must be an array of strings",
                                    minItems: "figma_ids cannot be empty",
                                    uniqueItems: "figma_ids must contain unique values"
                                }
                            },
                            "screenshot_names": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                uniqueItems: false
                            }
                        },
                        "required": ["figma_file_token", "figma_ids"]
                    },
                    uniqueItems: true,
                    errorMessage: {
                        uniqueItems: "Each entry in the figma configs must be unique"
                    }
                }
            },
            "required": ["configs"]
        },
        smartIgnore: {
            type: "boolean",
            errorMessage: "Invalid config; smartIgnore must be true/false"
        }
    },
    "required": ["mobile", "figma"],
    additionalProperties: false,
};

export const validateConfig = ajv.compile(ConfigSchema);
export const validateWebStaticConfig = ajv.compile(WebStaticConfigSchema);
export const validateSnapshot = ajv.compile(SnapshotSchema);
export const validateFigmaDesignConfig = ajv.compile(FigmaDesignConfigSchema);
export const validateWebFigmaConfig = ajv.compile(FigmaWebConfigSchema);
export const validateAppFigmaConfig = ajv.compile(FigmaAppConfigSchema);

export const validateConfigForScheduled = (config: any) => {
    validateConfigForScheduled.errors = null;
    
    
    if (!validateConfig(config)) {
        
        let errors = validateConfig.errors || [];
        
        errors = errors.filter(error => {
            const message = error.message || '';
            return !message.includes('max unique viewports allowed - 5')
        });
        
        if (config.web && config.web.viewports && Array.isArray(config.web.viewports)) {
            if (config.web.viewports.length > 8) {
                errors.push({
                    message: "Invalid config; max unique viewports allowed - 8 (scheduled build)",
                    keyword: "maxItems",
                    instancePath: "/web/viewports",
                    schemaPath: "#/properties/web/properties/viewports/maxItems"
                } as any);
            }
        }
    
        // If there are any errors remaining, set them and return false
        if (errors.length > 0) {
            validateConfigForScheduled.errors = errors;
            return false;
        }
    }
    
    return true;
};

// Initialize the errors property
validateConfigForScheduled.errors = null;
