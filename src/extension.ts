
import { window, commands, ExtensionContext } from 'vscode';
import { generateBloc, BlocOpts } from './bloc';

import * as flutter from './flutter';
import * as service from './server';

export function activate(context: ExtensionContext) {
    flutter.setup(context);
	service.setup(context);
}

// this method is called when your extension is deactivated
export function deactivate() {}
