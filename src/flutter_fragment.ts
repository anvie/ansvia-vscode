
import { window, Selection, Position, Range, TextEditorEdit, WorkspaceEdit, TextEdit, Uri, workspace } from 'vscode';
import { getFlutterInfo, FlutterInfo } from './util';
import { openAndFormatFile, reformatDocument } from './flutter_util';
import { print } from 'util';

var snakeCase = require('snake-case');
var camelCase = require('camel-case');
var pascalCase = require('pascal-case');

var fs = require('fs');

export enum FragmentKind {
  FormAutocompleteField = 1,
}

export class GenFragmentOpts {
  kind: FragmentKind;
  oneStep: boolean;
  constructor(kind: FragmentKind, oneStep: boolean = false) {
    this.kind = kind;
    this.oneStep = oneStep;
  }
}

export async function generateFragment(opts: GenFragmentOpts) {
  const flutter = getFlutterInfo();

  if (!flutter) {
    return;
  }

  // get component name
  const name = opts.oneStep === true ? "" : await window.showInputBox({
    value: '',
    valueSelection: [0, 11],
    placeHolder: 'Widget list item name, eg: Todo'
  }) || "";

  var libDir = `${flutter.projectDir}/lib`;
  var widgetDir = `${libDir}/widgets`;

  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir);
    if (!fs.existsSync(widgetDir)) {
      fs.mkdirSync(widgetDir);
    }
  }
  var nameSnake = snakeCase(name);

  var widgetNameDir = nameSnake.split('_')[0];

  if (!fs.existsSync(`${widgetDir}/${widgetNameDir}`)) {
    fs.mkdirSync(`${widgetDir}/${widgetNameDir}`);
  }

  var filePath = "";
  if (window.activeTextEditor !== null) {
    filePath = window.activeTextEditor!.document.fileName;
  }

  const editor = window.activeTextEditor!;

  if (filePath !== "") {
    switch (opts.kind) {
      case FragmentKind.FormAutocompleteField: {
        editor.edit(builder =>
          _patchCode(filePath, name, flutter, builder)
        );
      }
    }
  } else {
    window.showErrorMessage("No active opened code");
  }

  //   switch (opts.kind) {
  //     case FragmentKind.FormAutocompleteField: {
  //       filePath = `${widgetDir}/${widgetNameDir}/${nameSnake}_list.dart`;
  //       break;
  //     }
  //     default: {
  //       window.showErrorMessage("Unknown kind");
  //       return;
  //     }
  //   }

}


async function _patchCode(filePath: string, name:String, flutter: FlutterInfo, builder: TextEditorEdit) {

  let nameSnake = snakeCase(name);
  let nameCamel = camelCase(name);
  let namePascal = pascalCase(name);

  const importCode = `import 'package:flutter_typeahead/flutter_typeahead.dart';`;

  const controllerCode = `
  final _${nameCamel}Controller = TextEditingController();
`;

  const suggestionCode = `
  Future<List<dynamic>> get${namePascal}Suggestions(String query){
    return PublicApi.get("/${nameSnake}/v1/search?query=$query&offset=0&limit=10").then((data){
      List<dynamic> entries = data["result"]["entries"] as List;
      return entries.map((d) => d["name"]).toList();
    });
  }
`;

const fieldCode = `
// @TODO(you): please place this field code into your desired location
// TypeAheadFormField(
//   textFieldConfiguration: TextFieldConfiguration(
//       controller: this._${nameCamel}Controller,
//       decoration: InputDecoration(labelText: '${namePascal}')),
//   suggestionsCallback: (query) {
//     return getSuggestions(query);
//   },
//   itemBuilder: (context, suggestion) {
//     return ListTile(
//       title: Text(suggestion),
//     );
//   },
//   transitionBuilder: (context, suggestionsBox, controller) {
//     return suggestionsBox;
//   },
//   onSuggestionSelected: (suggestion) {
//     this._${nameCamel}Controller.text = suggestion;
//   },
//   validator: (value) {
//     if (value.isEmpty) {
//       return 'Please select a ${name}';
//     }else{
//       return '';
//     }
//   },
//   onSaved: (value){},
// )
`;


  var data = fs.readFileSync(filePath);
  var lines = data.toString().split(/\r?\n/);
  var linet = "";

  var newLines = [];
  var inImport = false;
  var alreadyInserted = false;

  for (let [i, line] of lines.entries()) {
    linet = line.trim();
    if (!alreadyInserted) {
      if (linet.startsWith("import")) {
        inImport = true;
        if (linet.includes('flutter_typeahead/flutter_typeahead')) {
          alreadyInserted = true;
        }
      }
      else if (inImport && !linet.startsWith("import")) {
        builder.replace(new Range(new Position(i, 0), new Position(i, 0)), importCode);
        newLines.push(importCode);
        alreadyInserted = true;
      }
    }
    newLines.push(line);
  }

  lines = newLines;
  newLines = [];

  let reStateClassMatch = new RegExp("class .*? extends State<.*?> *?{");
  let reBuildMethod = new RegExp(".*?Widget *?build\(.*?context\).*?");
  var inStateClass = false;
  var lastEmptyLine = 0;

  for (let [i, line] of lines.entries()) {
    // find for stateful widget state class
    linet = line.trim();
    if (linet.length === 0) {
      lastEmptyLine = i;
    }
    console.log(`lastEmptyLine: ${lastEmptyLine}`);
    if (reStateClassMatch.test(linet)) {
      inStateClass = true;
      
      builder.replace(new Range(new Position(i+1, 0), new Position(i+1, 0)), 
        controllerCode);

    } else if (inStateClass && reBuildMethod.test(linet)) {
      console.log("want to change!!");

      builder.replace(new Range(new Position(lastEmptyLine, 0), new Position(lastEmptyLine, 0)), 
        suggestionCode + fieldCode);

      break;
    }
    // newLines.push(line);
  }

  // fs.writeFileSync(filePath, newLines.join('\n'));

  let formatEdit = new WorkspaceEdit();
  workspace.applyEdit(formatEdit);

}