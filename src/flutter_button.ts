
import { window, workspace, ExtensionContext, commands, TextEditorEdit } from 'vscode';
import { getRootDir, ProjectType, getFlutterInfo, FlutterInfo } from './util';
import { doGenerateBlocCode, BlocOpts } from './bloc';
import { Cmd } from './cmd';

var snakeCase = require('snake-case');
var camelCase = require('camel-case');
var pascalCase = require('pascal-case');

var fs = require('fs');

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
          var result = _patchCode(name, flutter, builder);
          builder.replace(editor.selection.anchor, result);
        });
        break;
      }
    }
  } else {
    window.showErrorMessage("No active opened code");
  }
}

function _patchCode(fieldsStr:String, flutter: FlutterInfo, builder: TextEditorEdit) {
  const projectNameSnake = snakeCase(flutter.projectName);
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

//   const code = `
// PopupMenuButton<Choice>(
//   onSelected: (Choice choice){
//     print("selected: \${choice.title}");
//     if (choice.title == "Step Manager"){
//       Navigator.of(context).pushNamed("/stepman");
//     }else if (choice.title == "Edit"){
//       setState(() {
//           _editMode = !_editMode;
//       });
//     }
//   },
//   itemBuilder: (BuildContext build){
//     return [
//       PopupMenuItem(key: RactaKeys.editProjects, value: Choice("Edit", Icons.edit),child: Text("Edit"),),
//       PopupMenuItem(value: Choice("Step Manager", Icons.format_list_numbered), child: Text("Step Manager"))
//     ];
//   },
// )
//   `;
  
  return newLines.join("\n");
}
