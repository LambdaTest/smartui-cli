import { Context } from "../types.js";

export default async (ctx: Context): Promise<string> => {
  const figmaConfig = ctx.config && ctx.config?.figma || {};
  const webConfig = ctx.config && ctx.config?.web || {};
  let results = "";
  const buildName = ctx.options.buildName;

  if (figmaConfig && figmaConfig.configs && figmaConfig.configs.length > 0) {

    const authToken = `Basic ${Buffer.from(`${ctx.env.LT_USERNAME}:${ctx.env.LT_ACCESS_KEY}`).toString("base64")}`

    const requestBody = {
      figma_token: ctx.env.FIGMA_TOKEN,
      auth: authToken,
      build_name: buildName,
      web: webConfig,
      figma: figmaConfig,
      smartIgnore: ctx.config.smartIgnore,
      git: ctx.git,
    };

    const responseData = await ctx.client.processWebFigma(requestBody, ctx.log);
    ctx.log.debug("responseData : "+  JSON.stringify(responseData));

    if (responseData.data.message == "success") {
      results = responseData.data.message;
      ctx.build = {
        id: responseData.data.buildId,
        url: responseData.data.buildURL || "https://smartui.lambdatestinternal.com",
        baseline: responseData.data.baseline? responseData.data.baseline : false,
      }
    }
  } else {
    throw new Error("No Figma configuration found in config file");
  }

  return results;
};