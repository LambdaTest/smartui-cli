import SmartUI from "@smartui/core"
import { parse } from './validate.js';

async function capture(file, options, log) {
  let screenshots = parse(file);
  log.debug(screenshots);
  options.screenshots = screenshots
  const smartui = new SmartUI();
  await smartui.createBuild(options, log);
  await smartui.capture(options, log);
  await smartui.cleanup(true, log);

}

export { capture };