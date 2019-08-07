
import { window, workspace } from "vscode";

const fs = require("fs");
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
