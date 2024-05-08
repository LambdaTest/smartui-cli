import { Context } from "../types.js";
import chalk from "chalk";
import FormData from "form-data";
import { mapIdToName } from "./utils.js";
import constants from "./constants.js";

export default async (ctx: Context): Promise<Record<string, any>> => {
  const formData = new FormData();
  const figmaConfigs = ctx.figmaDesignConfig.figma_config;
  const results = {};

  let uploadSmartUIResponse = {};

  for (const config of figmaConfigs) {
    const figmaToken = process.env.FIGMA_TOKEN;

    let queryParams = `?depth=2`;
    if (config.figma_ids && config.figma_ids.length > 0) {
      const fileIds = config.figma_ids.join(",");
      queryParams += `&ids=${fileIds}`;
    }

    const url = `${constants.FIGMA_API}files/${config.figma_file_token}${queryParams}`;

    // API call to figma to fetch the desing files
    const figmaFilesResponse = await ctx.client.getFigmaFilesAndImages(url, figmaToken || '', ctx.log);

    const results: Record<string, any> = {};

    const idNameMap = mapIdToName(figmaFilesResponse.document.children);
    results[config.figma_file_token] = idNameMap;

    // Collecting all IDs from idNameMap
    const allIds = Object.keys(idNameMap).join(",");

    // API call to fetch images for all these IDs
    const imagesUrl = `${constants.FIGMA_API}images/${config.figma_file_token}?ids=${allIds}`;

    // API call to fetch image urls for all ids
    const imagesResponse = await ctx.client.getFigmaFilesAndImages(imagesUrl, figmaToken || '', ctx.log)

    await uploadImagesToSmartUI(imagesResponse.images, idNameMap);
  }

  async function uploadImagesToSmartUI(images : any, screenshotNames : any) {
    const filesToUpload: Record<string, any> = {};

    for (const [imageId, imageUrl] of Object.entries(images)) {
      if (!imageUrl) {
        continue;
      }

      // get image files from figma urls
      const response = await ctx.client.getImageFromFigmaURLs(imageUrl as string, ctx.log);

      const name = screenshotNames[imageId] || `image_${imageId}`;
      filesToUpload[`${name}.png`] = response;
    }

    if (Object.keys(filesToUpload).length > 0) {
      const formData = new FormData();

      for (const [filename, fileData] of Object.entries(filesToUpload)) {
        formData.append("files", fileData, {
          filename: filename,
          contentType: `image/png`,
        });
      }

      formData.append("projectToken", ctx.env.PROJECT_TOKEN);

      // uploading images to smartUI
      uploadSmartUIResponse = await ctx.client.uploadImagesToSmartUI(formData, ctx.log);

    } else {
      ctx.log.debug("No files to upload");
    }
  }
  return uploadSmartUIResponse;
};
