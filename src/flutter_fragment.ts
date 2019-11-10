
import { window, Position, Range, TextEditorEdit, WorkspaceEdit, Uri, workspace } from 'vscode';
import { getFlutterInfo, FlutterInfo, reformatDocument } from './util';
import * as flutter_model from './flutter_model';

var snakeCase = require('snake-case');
var camelCase = require('camel-case');
var pascalCase = require('pascal-case');

var fs = require('fs');

export enum FragmentKind {
  FormAutocompleteField = 1,
  ModelAddField,
  ModelEditField
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

  // Get component name
  const name = opts.oneStep === true ? "" : await window.showInputBox({
    value: '',
    valueSelection: [0, 11],
    placeHolder: 'Name, eg: Todo'
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
          _patchCodeAddModelField(name, flutter, builder);
        });
        reformatDocument(Uri.file(filePath));
        break;
      }
      case FragmentKind.ModelEditField: {
        _patchCodeEditModelField(flutter);
        reformatDocument(Uri.file(filePath));
        break;
      }
    }
  } else {
    window.showErrorMessage("No active opened code");
  }
}

class Param {
  name: string;
  ty: string;
  constructor(name: string, ty: string) {
    this.name = name;
    this.ty = ty;
  }
}

class NameAndOpts {
  name: String;
  opts: flutter_model.GenModelOpts;
  constructor(name: String, opts: flutter_model.GenModelOpts) {
    this.name = name;
    this.opts = opts;
  }
}

function getModelGeneratorOptsFromText(text: String): NameAndOpts {
  let reClass = new RegExp('class (\\w*)');
  let reFieldDecl = new RegExp('final (\\w+|List<\\w+>) (\\w+);');
  let reConstructor = new RegExp('\\w+\\(this\\.id.*?\\)');

  let lines = text.split('\n');

  var className = "";
  let params: Param[] = [];

  // get class name and parse params
  for (let _line of lines) {
    let linet = _line.trim();
    console.log(linet);
    let r = reClass.exec(linet);
    if (r) {
      className = r[1];
    }
    r = null;
    r = reFieldDecl.exec(linet);
    if (r) {
      // ignore `id` field
      if (r[2] === 'id') {
        continue;
      }
      // collect
      params.push(new Param(r[2], r[1]));
    }
    if (reConstructor.test(linet)) {
      break;
    }
  }
  // console.log(`params: ${params}`);

  let opts = new flutter_model.GenModelOpts();
  opts.fields = params.map((p) => {
    switch (p.ty.toLowerCase()) {
      case "int": {
        return p.name + ':i';
      }
      case "string": {
        return p.name + ':z';
      }
      case "double": {
        return p.name + ':d';
      }
      case "bool": {
        return p.name + ':b';
      }
      case "list<string>": {
        return p.name + ":z[]";
      }
      case "list<double>": {
        return p.name + ":d[]";
      }
      case "list<bool>": {
        return p.name + ":b[]";
      }
      case "list<int>": {
        return p.name + ":i[]";
      }
      default:
        return p.name + ':z';
    }
  });
  return new NameAndOpts(className, opts);
}

async function _patchCodeEditModelField(flutter: FlutterInfo) {
  let text = window.activeTextEditor!.document.getText();
  let lines = text.split('\n');

  let nameAndOpts = getModelGeneratorOptsFromText(text);
  let fieldsStr = await window.showInputBox({
    value: nameAndOpts.opts.fields.join(','),
    valueSelection: [0, 11],
    placeHolder: 'Fields, eg: name:z,active:b,categories:z[]'
  });
  if (fieldsStr === undefined) {
    return;
  }
  let newOpts = nameAndOpts.opts;
  newOpts.fields = fieldsStr.split(',').map((a) => a.trim()).filter((a) => a.length > 0);
  let newContent = flutter_model.genCode(nameAndOpts.name, flutter, newOpts);
  // console.log("newContent generated: " + newContent);

  const editor = window.activeTextEditor!;
  editor.edit(builder => {
    builder.replace(new Range(new Position(0, 0), new Position(lines.length, 0)), newContent);
  });
}

async function _patchCodeAddModelField(fieldsStr: string, flutter: FlutterInfo, builder: TextEditorEdit) {
  // let reClass = new RegExp('class (\\w*)');
  // let reFieldDecl = new RegExp('final (\\w+|List<\\w+>) (\\w+);');
  // let reConstructor = new RegExp('\\w+\\(this\\.id.*?\\)');
  // // let reConstructorParams = new RegExp();
  // let reToMap = new RegExp('data\\["\\w*"\\] = this.\\w*;');

  let text = window.activeTextEditor!.document.getText();
  let lines = text.split('\n');

  let fieldsStrList = fieldsStr.split(',').map((a) => a.trim());

  let nameAndOpts = getModelGeneratorOptsFromText(text);

  // var className = "";
  // let params:Param[] = [];

  // // get class name and parse params
  // for (let _line of lines){
  //   let linet = _line.trim();
  //   console.log(linet);
  //   let r = reClass.exec(linet);
  //   if (r){
  //     className = r[1];
  //   }
  //   r = null;
  //   r = reFieldDecl.exec(linet);
  //   if (r){
  //     // ignore `id` field
  //     if (r[2] === 'id'){
  //       continue;
  //     }
  //     // collect
  //     params.push(new Param(r[2], r[1]));
  //   }
  //   if (reConstructor.test(linet)){
  //     break;
  //   }
  // }
  // // console.log(`params: ${params}`);

  // let opts = new flutter_model.GenModelOpts();
  // opts.fields = params.map((p) => {
  //   switch(p.ty.toLowerCase()){
  //     case "int": {
  //       return p.name + ':i';
  //     }
  //     case "string": {
  //       return p.name + ':z';
  //     }
  //     case "double": {
  //       return p.name + ':d';
  //     }
  //     case "bool": {
  //       return p.name + ':b';
  //     }
  //     case "list<string>": {
  //       return p.name + ":z[]";
  //     }
  //     case "list<double>": {
  //       return p.name + ":d[]";
  //     }
  //     case "list<bool>": {
  //       return p.name + ":b[]";
  //     }
  //     case "list<int>": {
  //       return p.name + ":i[]";
  //     }
  //     default:
  //       return p.name + ':z';
  //   }
  // });

  // console.log(`fieldsStrList: ${fieldsStrList}`);
  nameAndOpts.opts.fields = nameAndOpts.opts.fields.concat(fieldsStrList);

  // console.log("opts.fields:");
  // console.log(opts.fields);


  let newContent = flutter_model.genCode(nameAndOpts.name, flutter, nameAndOpts.opts);

  builder.replace(new Range(new Position(0, 0), new Position(lines.length, 0)), newContent);

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
      if (data != null) {
        List<dynamic> entries = data["result"]["entries"] as List;
        return entries.map((d) => d["name"]).toList();
      } else {
        throw ${pascalCase(flutter.projectName)}Exception(
            "Cannot contact API server for getting suggestions");
      }
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