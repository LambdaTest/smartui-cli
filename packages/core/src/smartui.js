import { cleanupDir } from './cleanup.js';
import {screenshot} from './screenshot.js'
import SmartUIClient from './client.js'
import {fetchBuildStatus} from './build.js'

export class SmartUI {
  build = {};
  client = null;

  constructor() {

  }

  async createBuild(options, log) {
    log.debug("smartui.createBuild function called in core package");
    log.info("Validating Project Token");
    let client = new SmartUIClient(options.env, log)
    this.client = client
    let data = await client.validateToken();
    log.debug(data)
    log.info('Project Token Validated');
    log.info("Create SmartUI Build");
    this.build = await client.createBuild();
    log.debug(this.build)
    return
  }


  async capture(options, log) {
    log.debug("SmartUI.capture function called in core package");
    log.debug(options)
    await cleanupDir(log, 'screenshots')
    log.debug("Get build data")
    log.debug(this.build)
    let client = new SmartUIClient(options.env, log)
    await screenshot(this.client, this.build.data, options, log)
    log.info('Build URL: ' + this.build.buildURL);
    log.info('Build in progress...');
    await fetchBuildStatus(this.client, this.build.data, log);
    return 1;
  }

  async cleanup(force, log) {
    log.debug("SmartUI.cleanup function called in core package");
    return 1;
  }
}

export default SmartUI;
