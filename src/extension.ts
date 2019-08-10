
import { window, commands, ExtensionContext } from 'vscode';
import { generateBloc, BlocOpts } from './bloc';
import { generateFlutter, FlutterOpts, setup as setupFlutterGen } from './flutter';
import * as service from './server';

import { Cmd } from './cmd';

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
	
    setupFlutterGen(context);
	service.setup(context);
}

// this method is called when your extension is deactivated
export function deactivate() {}
