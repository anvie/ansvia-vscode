import { window, ExtensionContext, commands } from "vscode";

import clipboardy = require('clipboardy');
import { Cmd } from "./cmd";


export function setup(context: ExtensionContext) {
  context.subscriptions.push(commands.registerCommand('extension.code_utils', async () => {
    const quickPick = window.createQuickPick();
    quickPick.items = [
      new Cmd("Generate snippet code and copy to clipboard", generateSnippetCodeAndCopyToClipboard),
    ];
    quickPick.onDidChangeSelection(selection => {
      if (selection[0]) {
        (selection[0] as Cmd).code_action(context).catch(console.error)
          .then((result) => {
            console.log(result);
            quickPick.dispose();
          });
      }
    });
    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  }));
}


export async function generateSnippetCodeAndCopyToClipboard() {

  const editor = window.activeTextEditor!;

  const text = editor.document.getText(editor.selection);

  const lines = text.split('\n');

  var result = [];

  const lang = editor.document.languageId;
  const prefix = await window.showInputBox({
    value: '',
    placeHolder: 'Prefix'
  }) || "";


  result.push(`"": {`);
  result.push(`    "scope": "${lang}",`);
  result.push(`    "prefix": "${prefix}",`);
  result.push(`    "body": [`);

  var codeLines = [];

  for (let line of lines) {
    codeLines.push(`"${line.replace(/"/gi, `\\"`)}"`);
  }

  result.push(codeLines.join(',\n'));

  result.push("    ]");
  result.push("}");

  clipboardy.writeSync(result.join('\n'));

  window.showInformationMessage("Generated code copied into clipboard!");
}
