
import { ExtensionContext, workspace, TextDocument } from 'vscode';

import * as flutter from './flutter';
import * as service from './server';
import * as web from './web';
import { setupSyncGen } from './syncgen';

export function activate(context: ExtensionContext){
    flutter.setup(context);
	service.setup(context);
	web.setup(context);

	setupSyncGen();
}

// this method is called when your extension is deactivated
export function deactivate() {}

