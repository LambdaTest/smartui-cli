import { Snapshot, WebStaticConfig } from '../types.js'
import Ajv, { JSONSchemaType } from 'ajv'
import addErrors from 'ajv-errors'

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
					items: { type: "string", enum: ["chrome", "firefox", "edge", "safari"] },
					uniqueItems: true,
					maxItems: 4,
                    errorMessage: "Invalid config; allowed browsers - chrome, firefox, edge, safari"
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
    		},
			required: ["browsers", "viewports"],
			additionalProperties: false
		}
    },
    required: ["web"],
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
                ignoreDOM: {
                    type: "object",
                    properties: {
                        id: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; id cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; id array must have unique items"
                        },
                        class: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; class cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; class array must have unique items"
                        },
                        cssSelector: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; cssSelector cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; cssSelector array must have unique items"
                        },
                        xpath: {
                            type: "array",
                            items: { type: "string", minLength: 1 },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; xpath array must have unique and non-empty items"
                        },   
                    }
                },
                selectDOM: {
                    type: "object",
                    properties: {
                        id: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; id cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; id array must have unique items"
                        },
                        class: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; class cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; class array must have unique items"
                        },
                        cssSelector: {
                            type: "array",
                            items: { type: "string", minLength: 1, pattern: "^[^;]*$", errorMessage: "Invalid snapshot options; cssSelector cannot be empty or have semicolon" },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; cssSelector array must have unique items"
                        },
                        xpath: {
                            type: "array",
                            items: { type: "string", minLength: 1 },
                            uniqueItems: true,
                            errorMessage: "Invalid snapshot options; xpath array must have unique and non-empty items"
                        }, 
                    }
                }
            },
            additionalProperties: false
        }
    },
    required: ["name", "url", "dom"],
    additionalProperties: false,
    errorMessage: "Invalid snapshot"
}

export const validateConfig = ajv.compile(ConfigSchema);
export const validateWebStaticConfig = ajv.compile(WebStaticConfigSchema);
export const validateSnapshot = ajv.compile(SnapshotSchema);
