import { Uri, window, workspace, commands, WorkspaceEdit, TextEdit } from "vscode";



export function openAndFormatFile(filePath: string) {
    var fileUri = Uri.file(filePath);
    workspace.openTextDocument(fileUri).then(doc => {
        window.showTextDocument(doc);
        commands.executeCommand("vscode.executeFormatDocumentProvider", fileUri,
            { tabSize: 2, insertSpaces: true, insertFinalNewline: true })
            .then((edits) => {
                if (edits !== undefined) {
                    let formatEdit = new WorkspaceEdit();
                    formatEdit.set(fileUri, edits as TextEdit[]);
                    workspace.applyEdit(formatEdit);
                    workspace.saveAll();
                }
            },
                (error) => console.error(error));
    });
}


