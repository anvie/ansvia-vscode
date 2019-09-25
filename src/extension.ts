
import { ExtensionContext, workspace, TextDocument } from 'vscode';

import * as flutter from './flutter';
import * as service from './server';
import * as web from './web';
import { setupSyncGen } from './syncgen';
import config = require('./config');
import fs = require('fs');
import { getRootDir, ProjectType } from './util';

class ExtensionConfig {
  yamlData: any;
  serverRootDir: string;

  constructor(yamlData: any) {
    this.yamlData = yamlData;

    if (!this.yamlData["server"]) {
      this.yamlData["server"] = {};
    }
    // console.log("this.yamlData:");
    // console.log(this.yamlData);

    this.serverRootDir = getRootDir(ProjectType.Server) || "";
  }

  serverModelDir(): string {
    let path = `${this.serverRootDir}/src/${this.yamlData["server"]["model_dir"]}`;
    console.log("path: " + path);

    if (fs.existsSync(path)) {
      return path;
    }
    return `${this.serverRootDir}/src`;
  }

  serverModelFile(): string {
    return `${this.serverModelDir()}/${this.yamlData["server"]["model_file"] || 'models.rs'}`;
  }
}

var EXTENSION_CONFIG = new ExtensionConfig({});

export function getExtensionConfig() {
  return EXTENSION_CONFIG;
}

export function activate(context: ExtensionContext) {
  setupSyncGen();

  flutter.setup(context);
  service.setup(context);
  web.setup(context);

  let conf = config.parse();
  console.log("conf:");
  console.log(conf);

  if (!conf) {
    console.log("Cannot load extensions config");
    return;
  }

  EXTENSION_CONFIG = new ExtensionConfig(conf);
}

// this method is called when your extension is deactivated
export function deactivate() { }

