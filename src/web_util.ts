import { getRootDir, ProjectType } from "./util";

import fs = require("fs");

export class WebInfo {
    project: any;
    projectName: String;
    projectDir: String;
  
    constructor(project: any, projectName: String, projectDir: String) {
      this.project = project;
      this.projectName = projectName;
      this.projectDir = projectDir;
    }
  }


export function getWebInfo(): WebInfo | null {
    const rootDir = getRootDir(ProjectType.Web);
  
    if (!rootDir) {
      return null;
    }
  
    console.log("rootDir: " + rootDir);

    let project = rootDir.split('/').shift();

    let cargoContent = fs.readFileSync(`${rootDir}/package.json`, "utf8");
    let pkg = JSON.parse(cargoContent);
    
    let projectName = pkg.name;
  
    return new WebInfo(project, projectName, rootDir);
  }
  
  