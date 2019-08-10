
import { window, Selection, Position, Range, TextEditorEdit, WorkspaceEdit, TextEdit, Uri, workspace } from 'vscode';
import { getFlutterInfo, FlutterInfo } from './util';
import { openAndFormatFile, reformatDocument } from './flutter_util';
import * as flutter_model from './flutter_model';

var snakeCase = require('snake-case');
var camelCase = require('camel-case');
var pascalCase = require('pascal-case');

var fs = require('fs');

export enum FragmentKind {
  FormAutocompleteField = 1,
  ModelAddField
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
    placeHolder: 'Widget list item name, eg: name'
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
        break;
      }
      case FragmentKind.ModelAddField: {
        editor.edit(builder => {
          _patchCodeAddModelField(filePath, name, flutter, builder);
        });
        reformatDocument(Uri.file(filePath));
        break;
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

class Param {
  name:string;
  ty:string;
  constructor(name:string, ty:string){
    this.name = name;
    this.ty = ty;
  }
}

async function _patchCodeAddModelField(filePath: string, fieldsStr: string, flutter: FlutterInfo, builder: TextEditorEdit) {
  let reClass = new RegExp('class (\\w*)');
  let reFieldDecl = new RegExp('final (\\w+) (\\w+);');
  let reConstructor = new RegExp('\\w+\\(this\\.id.*?\\)');
  // let reConstructorParams = new RegExp();
  let reToMap = new RegExp('data\\["\\w*"\\] = this.\\w*;');

  let lines = window.activeTextEditor!.document.getText().split('\n');

  let fieldsStrList = fieldsStr.split(',');

  var className = "";
  let params:Param[] = [];

  // get class name and parse params
  for (let _line of lines){
    let linet = _line.trim();
    console.log(linet);
    let r = reClass.exec(linet);
    if (r){
      className = r[1];
    }
    r = null;
    r = reFieldDecl.exec(linet);
    if (r){
      // ignore `id` field
      if (r[2] === 'id'){
        continue;
      }
      // collect
      params.push(new Param(r[2], r[1]));
    }
    if (reConstructor.test(linet)){
      break;
    }
  }
  // console.log(`params: ${params}`);

  let opts = new flutter_model.GenModelOpts();
  opts.fields = params.map((p) => {
    switch(p.ty.toLowerCase()){
      case "int": {
        return p.name + 'i';
      }
      case "string": {
        return p.name + 'z';
      }
      case "double": {
        return p.name + 'd';
      }
      case "bool": {
        return p.name + 'b';
      }
      default:
        return p.name + 'z';
    }
  });
  opts.fields.push(fieldsStr);

  let newContent = flutter_model.genCode(className, flutter, opts);

  builder.replace(new Range(new Position(0,0), new Position(lines.length-1,0)), newContent);

}

async function _patchCode(filePath: string, name: String, flutter: FlutterInfo, builder: TextEditorEdit) {

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
//     return get${namePascal}Suggestions(query);
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
    // console.log(`lastEmptyLine: ${lastEmptyLine}`);
    if (reStateClassMatch.test(linet)) {
      inStateClass = true;

      builder.replace(new Range(new Position(i + 1, 0), new Position(i + 1, 0)),
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