
import { window, commands, ExtensionContext, QuickPickItem, Extension } from 'vscode';
import { generateBloc, BlocOpts } from './bloc';
import { generateFlutter, FlutterOpts } from './flutter';

var pascalCase = require('pascal-case');

class Cmd implements QuickPickItem {
    
    label: string;
    code_action: (context: ExtensionContext) => Promise<void>;

    constructor(label: string, code_action: (context: ExtensionContext) => Promise<void>){
        this.label = label;
        this.code_action = code_action;
    }
}

export function activate(context: ExtensionContext) {
	context.subscriptions.push(commands.registerCommand('extension.ansbloc', async () => {
		const quickPick = window.createQuickPick();
		quickPick.items = [
            new Cmd("Generate BloC code (+model)", () => generateBloc({withModel: true, commentCode: false}) ),
            new Cmd("Generate BloC code (-model)", () => generateBloc({withModel: false, commentCode: false}) )
        ];
		quickPick.onDidChangeSelection(selection => {
			if (selection[0]) {
                (selection[0] as Cmd).code_action(context).catch(console.error);
			}
		});
		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.show();
	}));
	context.subscriptions.push(commands.registerCommand('extension.flutter', async () => {
		const quickPick = window.createQuickPick();
		quickPick.items = [
            new Cmd("Generate new CRUD flow", () => generateFlutter({statefulScreenPage: true}) ),
            // new Cmd("Generate CRUD Screen Page (stateless)", () => generateFlutter({statefulScreenPage: false}) ),
        ];
		quickPick.onDidChangeSelection(selection => {
			if (selection[0]) {
                (selection[0] as Cmd).code_action(context).catch(console.error);
			}
		});
		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.show();
	}));
}

// this method is called when your extension is deactivated
export function deactivate() {}
