
import { window, workspace } from "vscode";
const fs = require("fs");


export function getRootDir(): String | null {
    if (!workspace.workspaceFolders){
        window.showInformationMessage("No project opened, please open project first.");
        return null;
    }
    var rootDir = workspace.workspaceFolders![0].uri.path;
    var s = rootDir.split('/');
    var projectName = s[s.length-1];

    if (!fs.existsSync(`${rootDir}/pubspec.yaml`)){
        rootDir = `${rootDir}/frontends/${projectName}_mobile`;
    }
    return rootDir;
}
