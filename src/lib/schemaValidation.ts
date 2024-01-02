import { WebStaticConfig } from '../types.js'
import Ajv, { JSONSchemaType } from 'ajv'
import addErrors from 'ajv-errors'

const ajv = new Ajv({ allErrors: true });
ajv.addFormat('web-url', {
    type: 'string',
    validate: (url: string) => {
        const urlPattern = new RegExp('^(https?:\\/\\/)?' + // protocol
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
            '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
            '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
            '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
        return urlPattern.test(url);
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
						items: [
							{ type: "number", minimum: 320, maximum: 7680 },
							{ type: "number", minimum: 320, maximum: 7680 } 
						],
						additionalItems: false,
						minItems: 2,
						maxItems: 2
					},
					uniqueItems: true,
					maxItems: 5,
                    errorMessage: "Invalid config; width/height must be >= 320 and <= 7680; max viewports allowed - 5"
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

export const validateConfig = ajv.compile(ConfigSchema);
export const validateWebStaticConfig = ajv.compile(WebStaticConfigSchema);
