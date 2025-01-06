import { Context } from "../types.js";

export default async (ctx: Context): Promise<any> => {
  const buildId = ctx.build.id;
  ctx.log.debug(`Fetching figma results for buildId ${buildId}`);
  const startTime = Date.now(); // Record the start time
  try {
    const results = await callFetchWebFigmaRecursive(startTime, buildId, ctx);
    return results;
  } catch (error) {
    ctx.log.error(`Failed to fetch figma results: ${error}`);
    return { message: "Failed to fetch figma results" };
  }
};


// Recursive function with 5-second interval and 5-minute timeout
async function callFetchWebFigmaRecursive(
  startTime: number,
  buildId: any,
  ctx: Context
): Promise<any> {
  const currentTime = Date.now();
  const elapsedTime = (currentTime - startTime) / 1000; // Elapsed time in seconds

  // Check if total elapsed time exceeds 3 minutes
  if (elapsedTime >= 180) {
    ctx.log.error("Stopping execution after 5 minutes.");
    throw new Error("Timeout: Fetching figma results took more than 5 minutes.");
  }

  try {
    const response = await ctx.client.fetchWebFigma(buildId, ctx.log);
    ctx.log.debug("responseData : " + JSON.stringify(response));

    const message = response?.data?.message || "";
    if (message === "") {
      ctx.log.debug("No results yet. Retrying after 5 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
      return await callFetchWebFigmaRecursive(startTime, buildId, ctx);
    } else {
      return response?.data?.message;
    }
  } catch (error) {
    ctx.log.error("Error in fetchWebFigma:", error);
    ctx.log.debug("Retrying after 5 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
    return await callFetchWebFigmaRecursive(startTime, buildId, ctx);
  }
}