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
                    maxItems: 4,
                    errorMessage: `Invalid config; allowed browsers - ${constants.CHROME}, ${constants.FIREFOX}, ${constants.SAFARI}, ${constants.EDGE}`
                },
                viewports: {
                    type: "array",
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
                    errorMessage: "Invalid config; max unique viewports allowed - 5"
                }
            },
            required: ["browsers", "viewports"],
            additionalProperties: false
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
            type: "boolean",
            errorMessage: "Invalid config; tunnel must be true/false"
        },
        tunnelName: {
            type: "string",
            errorMessage: "Invalid config; tunnelName must be string"
        },
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
            execute: {
                type: "object",
                properties: {
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
            errorMessage: "Invalid snapshot; name is mandatory and cannot be empty"
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
                        }
                    },
                    required: ["viewports"],
                    errorMessage: "Invalid snapshot options; web must include viewports property."
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
            minimum: 2,
            errorMessage: "Depth must be an integer and greater than 1"
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
                    minimum: 2,
                    errorMessage: "Depth must be an integer and greater than 1"
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
    "required": ["web", "figma"],
    additionalProperties: false,
};

export const validateConfig = ajv.compile(ConfigSchema);
export const validateWebStaticConfig = ajv.compile(WebStaticConfigSchema);
export const validateSnapshot = ajv.compile(SnapshotSchema);
export const validateFigmaDesignConfig = ajv.compile(FigmaDesignConfigSchema);
export const validateWebFigmaConfig = ajv.compile(FigmaWebConfigSchema);