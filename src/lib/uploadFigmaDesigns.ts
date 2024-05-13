import { Context } from "../types.js";

export default async (ctx: Context): Promise<string> => {
  const figmaConfigs = ctx.figmaDesignConfig.figma_config;
  let results = "";
  let figmaFileToken = '';

  for (const config of figmaConfigs) {

    figmaFileToken = config.figma_file_token;
    let queryParams = "";
    if (config.figma_ids && config.figma_ids.length > 0) {
      const fileIds = config.figma_ids.join(",");
      queryParams += `&ids=${fileIds}`;
    }
    
    const authToken = `Basic ${Buffer.from(`${ctx.env.LT_USERNAME}:${ctx.env.LT_ACCESS_KEY}`).toString("base64")}`

    const responseData = await ctx.client.getFigmaFilesAndImages(figmaFileToken, ctx.env.FIGMA_TOKEN, queryParams, authToken, ctx.log)

    if (responseData.data.message == "success") {
      results = responseData.data.message; 
    }
  }

  return results;
};