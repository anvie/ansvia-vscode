
import { ExtensionContext } from 'vscode';

import * as flutter from './flutter';
import * as service from './server';
import * as web from './web';

export function activate(context: ExtensionContext) {
    flutter.setup(context);
	service.setup(context);
	web.setup(context);
}

// this method is called when your extension is deactivated
export function deactivate() {}
