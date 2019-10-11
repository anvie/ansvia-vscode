
import fs = require('fs');
import { workspace } from 'vscode';
let yaml = require('js-yaml');

export function parse() {
  const rootDir = workspace.workspaceFolders![0].uri.path;

  if (!rootDir) {
    return;
  }

  let ansviaVsCodeConfFile = `${rootDir}/ansvia-vscode.yaml`;
  if (!fs.existsSync(ansviaVsCodeConfFile)){
      return;
  }
  var config = yaml.safeLoad(fs.readFileSync(ansviaVsCodeConfFile));
  console.log(config);

  if (!config) {
    return;
  }

  return config;
}