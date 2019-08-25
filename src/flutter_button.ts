
import { window } from 'vscode';
import { getFlutterInfo, FlutterInfo } from './util';

var camelCase = require('camel-case');
var pascalCase = require('pascal-case');


export enum ButtonKind {
  PopupMenu = 1,
}

export class GenButtonOpts {
  kind: ButtonKind;
  constructor(kind: ButtonKind) {
    this.kind = kind;
  }
}

export async function generateButton(opts: GenButtonOpts) {
  const flutter = getFlutterInfo();

  if (!flutter) {
    return;
  }

  // get component name
  const name = await window.showInputBox({
    value: '',
    valueSelection: [0, 11],
    placeHolder: 'Menu items, eg: About, Logout'
  }) || "";

//   var nameSnake = snakeCase(name);


  var filePath = "";
  if (window.activeTextEditor !== null) {
    filePath = window.activeTextEditor!.document.fileName;
  }

  const editor = window.activeTextEditor!;

  if (filePath !== "") {
    switch (opts.kind) {
      case ButtonKind.PopupMenu: {
        editor.edit(builder => {
          var result = _patchCode(name, flutter);
          builder.replace(editor.selection.anchor, result);
        });
        break;
      }
    }
  } else {
    window.showErrorMessage("No active opened code");
  }
}

function _patchCode(fieldsStr:String, flutter: FlutterInfo) {
  const projectNamePascal = pascalCase(flutter.projectName);
  // const nameSnake = snakeCase(name);
  // const nameCamel = camelCase(name);
  // const namePascal = pascalCase(name);

  var fields = fieldsStr.split(',').map((a) => a.trim());

  var newLines = [];

  newLines.push(`
PopupMenuButton<Choice>(
  onSelected: (Choice choice){
    print("selected: \${choice.title}");
  `);

  var ifs = [];

  for (let field of fields){
    var fieldCamel = camelCase(field);
    ifs.push(`
      if (choice.title == "${field}"){
        Navigator.of(context).pushNamed("/${fieldCamel}");
      }`);
  }
  newLines.push(ifs.join(' else '));
  newLines.push('  },');
  newLines.push(`
  itemBuilder: (BuildContext build){
    return [
  `);

  var items = [];
  for (let field of fields){
    fieldCamel = camelCase(field);
    var fieldPascal = pascalCase(field);
    items.push(`      PopupMenuItem(key: ${projectNamePascal}Keys.menu${fieldPascal}, value: Choice("${field}", Icons.edit),child: Text("${field}"),)`);
  }
  newLines.push(items.join(',\n      '));
  newLines.push('    ];');
  newLines.push('  }');
  newLines.push(')');

  return newLines.join("\n");
}
