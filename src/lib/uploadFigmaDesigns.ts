import { Context } from "../types.js";
import chalk from "chalk";
import { mapIdToName } from "./utils.js";
import constants from "./constants.js";

export default async (ctx: Context): Promise<string> => { // Return type changed to string[]
  const figmaConfigs = ctx.figmaDesignConfig.figma_config;
  let results = "";

  for (const config of figmaConfigs) {
    const figmaToken = process.env.FIGMA_TOKEN;

    let queryParams = "";
    if (config.figma_ids && config.figma_ids.length > 0) {
      const fileIds = config.figma_ids.join(",");
      queryParams += `&ids=${fileIds}`;
    }

    let authToken = "";
    if (process.env.LT_USERNAME != null && process.env.LT_ACCESS_KEY != null) {
      authToken = `Basic ${Buffer.from(`${process.env.LT_USERNAME}:${process.env.LT_ACCESS_KEY}`).toString("base64")}`
    }

    // Construct the request body
    const requestBody = {
      figma_file_token: config.figma_file_token,
      figma_token: figmaToken,
      query_params: queryParams,
      auth: authToken,
      project_token: ctx.env.PROJECT_TOKEN
    };

      const responseData = await ctx.client.getFigmaFilesAndImages(requestBody, ctx.log)

      if (responseData.data.message == "success") {
        results = responseData.data.message; 
      }
  }

  return results;
};