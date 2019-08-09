
import { window, workspace } from "vscode";

const fs = require("fs");
var yaml = require('js-yaml');

var snakeCase = require('snake-case');

export enum ProjectType {
  Server,
  Mobile,
  Web
}

export function getRootDir(type: ProjectType): String | null {
  if (!workspace.workspaceFolders) {
    window.showInformationMessage("No project opened, please open project first.");
    return null;
  }
  var rootDir = workspace.workspaceFolders![0].uri.path;

  var s = rootDir.split('/');
  var projectName = s[s.length - 1];

  console.log("type: " + type);

  switch (type) {
    case ProjectType.Mobile:
      if (!fs.existsSync(`${rootDir}/pubspec.yaml`)) {
        rootDir = `${rootDir}/frontends/${projectName}_mobile`;
      }
      return rootDir;
    case ProjectType.Web:
      return `${rootDir}/frontends/${snakeCase(projectName)}_web`;
    case ProjectType.Server:
      return rootDir;
    default:
      return rootDir;
  }
}

export class FlutterInfo {
  project: any;
  projectName: String;
  projectDir: String;

  constructor(project: any, projectName: String, projectDir: String) {
    this.project = project;
    this.projectName = projectName;
    this.projectDir = projectDir;
  }
}

export function getFlutterInfo(): FlutterInfo | null {
  const rootDir = getRootDir(ProjectType.Mobile);

  if (!rootDir) {
    return null;
  }

  console.log("rootDir: " + rootDir);

  // get project name
  var project = yaml.safeLoad(fs.readFileSync(`${rootDir}/pubspec.yaml`));

  console.log(project);
  console.log("project.name: " + project['name']);

  var projectName = project['name'];

  if (projectName.endsWith("_mobile")) {
    projectName = projectName.substring(0, projectName.length - 7);
  }

  return new FlutterInfo(project, projectName, rootDir);
}