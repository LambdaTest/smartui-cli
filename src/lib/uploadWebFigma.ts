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

    };

    const responseData = await ctx.client.getWebFigma(requestBody, ctx.log);
    ctx.log.debug("responseData : "+  responseData);

    if (responseData.data.message == "success") {
      results = responseData.data.message;
    }
  } else {
    throw new Error("No Figma configuration found in config file");
  }

  return results;
};