
import { ExtensionContext, QuickPickItem } from 'vscode';

export class Cmd implements QuickPickItem {

    label: string;
    code_action: (context: ExtensionContext) => Promise<void>;

    constructor(label: string, code_action: (context: ExtensionContext) => Promise<void>) {
        this.label = label;
        this.code_action = code_action;
    }
}

