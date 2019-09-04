
import { window, ExtensionContext, commands } from 'vscode';
// import { doGenerateBlocCode } from './bloc';
import { generateListingCrudPage } from './web_page'; 
import { generateModalPage } from './web_modal';
import { Cmd } from './cmd';

export enum PageKind {
  Basic,
  Detail,
  FormAdd,
  FormUpdate,
  CRUDPage
}

export enum ModalKind {
  Basic,
}

class GenWebOpts {
  kind: PageKind;
  constructor(kind: PageKind) {
    this.kind = kind;
  }
}

class GenWebModalOpts {
  kind: ModalKind;
  constructor(kind: ModalKind) {
    this.kind = kind;
  }
}

export function setup(context: ExtensionContext) {
  context.subscriptions.push(commands.registerCommand('extension.web', async () => {
    const quickPick = window.createQuickPick();
    quickPick.items = [
      new Cmd("Generate listing CRUD page", () => generateListingCrudPage(new GenWebOpts(PageKind.CRUDPage))),
      new Cmd("Generate basic modal page", () => generateModalPage(new GenWebModalOpts(ModalKind.Basic))),
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


