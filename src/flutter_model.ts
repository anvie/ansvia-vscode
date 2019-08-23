
import { window } from 'vscode';
import { getFlutterInfo, FlutterInfo, openAndFormatFile, openFile } from './util';

var snakeCase = require('snake-case');
var camelCase = require('camel-case');
var pascalCase = require('pascal-case');

var fs = require('fs');

export class GenModelOpts {
  fields: string[];

  constructor() {
    this.fields = [];
  }
}

export async function generateModel(opts: GenModelOpts) {
  const flutter = getFlutterInfo();

  if (!flutter) {
    return;
  }

  // get component name
  const name = await window.showInputBox({
    value: '',
    placeHolder: 'Model name, eg: Todo'
  }) || "";

  const fieldsStr = await window.showInputBox({
    value: '',
    placeHolder: 'Fields names, eg: name:z,age:i,phone:z,email:z,active:b'
  }) || "";

  if (fieldsStr === "") {
    return;
  }

  var fields: string[] = fieldsStr.split(',');
  opts.fields = fields;

  var libDir = `${flutter.projectDir}/lib`;
  var modelDir = `${libDir}/models`;

  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir);
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir);
    }
  }
  var nameSnake = snakeCase(name);

  var modelFilePath = `${modelDir}/${nameSnake}.dart`;

  if (fs.existsSync(modelFilePath)) {
    window.showWarningMessage(`File already exists: ${modelFilePath}`);
  } else {
    fs.writeFileSync(modelFilePath, genCode(name, flutter, opts));
    openAndFormatFile(modelFilePath);
  }
}

class Field {
  name:String;
  ty:String;
  constructor(name:String, ty:String){
    this.name = name;
    this.ty = ty;
  }
}

export async function generateModelFromApiType(): Promise<void> {
  const flutter = getFlutterInfo();

  if (!flutter) {
    window.showWarningMessage("No flutter project");
    return;
  }
  const reName = new RegExp("pub struct (\\w*) {");
  const reField = new RegExp("pub (\\w*): *([a-zA-Z0-9_<>:]*),?");

  const editor = window.activeTextEditor!;
  const text = editor.document.getText(editor.selection);

  let name = "";
  let fields = [];


  let lines = text.split('\n');
  // let newLines = [];

  for (let line of lines) {
    var s = reName.exec(line);
    if (s && s[1]) {
      if (name !== "") {
        window.showWarningMessage("Name already defined: " + name);
        return;
      }
      name = s[1].trim();
      continue;
    }
    if (name.length > 0) {
      s = reField.exec(line);
      if (s === null) {
        continue;
      }
      console.log("s: " + s);
      console.log("s[2]: " + s[2]);
      if (s[1] === 'id'){
        // ignore id
        continue;
      }
      if (s[1]) {
        switch (s[2].trim()){
          case "String": {
            fields.push(`${s[1]}:z`);
            break;
          }
          case "ID": 
          case "i16": 
          case "u16": 
          case "i32": 
          case "u32": 
          case "i64": 
          case "u64": 
          case "u32": {
            fields.push(`${s[1]}:i`);
            break;
          }
          case "f32": 
          case "f64": {
            fields.push(`${s[1]}:d`);
            break;
          }
          case "Vec<String>": {
            fields.push(`${s[1]}:z[]`);
            break;
          }
          case "Vec<ID>":
          case "Vec<i32>":
          case "Vec<u32>":
          case "Vec<i16>":
          case "Vec<u16>":
          case "Vec<i64>":
          case "Vec<u64>": {
            fields.push(`${s[1]}:i[]`);
            break;
          }
          case "NaiveDateTime": {
            fields.push(`${s[1]}:dt`);
            break;
          }
          default: {
            let isPlural = s[2].startsWith('Vec<');
            if (isPlural){
              if (s[2].endsWith('>')){
                s[2] = s[2].substring(0, s[2].length - 1);
              }
              fields.push(`${s[1]}:${s[2]}[]`);
            }else{
              fields.push(`${s[1]}:${s[2].trim()}`);
            }
            break;
          }
        }
      }
    }
  }


  if (name === "") {
    window.showWarningMessage("Cannot get model name");
  }

  const nameSnake = snakeCase(name);

  let opts = new GenModelOpts();
  opts.fields = fields;

  const generatedCode = genCode(name, flutter, opts);

  var modelFilePath = `${flutter.projectDir}/lib/models/${nameSnake}.dart`;

  fs.writeFileSync(modelFilePath, generatedCode + '\n');
  openAndFormatFile(modelFilePath);
}

export async function generateModelFromSQLDef(opts: GenModelOpts){
  const flutter = getFlutterInfo();

  if (!flutter) {
    window.showWarningMessage("No flutter project");
    return;
  }

  const reTableName = new RegExp('CREATE TABLE ([\\w_]+?) \\(');
  const reField = new RegExp('\\"?([\\w_]*?)\\"? (BIGSERIAL|BIGINT|INT|INTEGER|DECIMAL|SMALLINT|SERIAL|VARCHAR|TEXT|FLOAT|DOUBLE|BOOLEAN|TIMESTAMP)(\\[\\])?');

  const editor = window.activeTextEditor!;

  const text = editor.document.getText(editor.selection);

  var name = "";

  let lines = text.split('\n');
  //   let newLines = [];
  let fields = [];

  //   newLines.push(`// this code is autogenerated using ansvia-vscode extension.
  //   import 'package:equatable/equatable.dart';
  // `);

  for (let line of lines) {
    var s;

    if (name === "") {
      s = reTableName.exec(line);
      if (s === null) {
        continue;
      }

      if (s[1]) {
        name = s[1].trim();
        if (name.endsWith('s')) { // plural
          name = name.substring(0, name.length - 1);
        }
        // const namePascal = pascalCase(name);
        // newLines.push(`/// Model for ${namePascal}`);
        // newLines.push(`class ${namePascal} extends Equatable {`);
      }
    }

    s = reField.exec(line);

    // print(s);

    if (s === null) {
      continue;
    }

    const field = s[1].trim();
    const sqlTy = s[2].toLowerCase();
    const isPlural = s[3] ? true : false;

    if (field === "id"){
      // ignore id
      continue;
    }


    switch (sqlTy) {
      case "bigserial":
      case "bigint":
      case "int":
      case "smallint":
      case "integer":
      case "numeric":
      case "decimal":
      case "serial": {
        if (isPlural) {
          // newLines.push(`final List<int> ${fieldCamel}[];`);
          fields.push(`${field}:i[]`);
        } else {
          fields.push(`${field}:i`);
          // newLines.push(`final int ${fieldCamel};`);
        }
        break;
      }
      case "float":
      case "double": {
        if (isPlural) {
          fields.push(`${field}:d[]`);
          // newLines.push(`final double ${fieldCamel};`);
        } else {
          // newLines.push(`final double ${fieldCamel};`);
          fields.push(`${field}:d`);
        }
        break;
      }
      case "varchar":
      case "text": {
        // newLines.push(`final String ${fieldCamel};`);
        if (isPlural){
          fields.push(`${field}:z[]`);
        }else{
          fields.push(`${field}:z`);
        }
        break;
      }
      case "boolean": {
        // newLines.push(`final bool ${fieldCamel};`);
        if (isPlural){
          fields.push(`${field}:b[]`);
        }else{
          fields.push(`${field}:b`);
        }
        break;
      }
      case "timestamp": {
        fields.push(`${field}:dt`);
      }
    }
  }

  if (name === ""){
    window.showWarningMessage("Cannot get model name");
  }

  const nameSnake = snakeCase(name);

  var opts = new GenModelOpts();
  opts.fields = fields;

  var libDir = `${flutter.projectDir}/lib`;
  var modelDir = `${libDir}/models`;

  var modelFilePath = `${modelDir}/${nameSnake}.dart`;

  if (fs.existsSync(modelFilePath)) {
    window.showWarningMessage(`File already exists: ${modelFilePath}`);
  } else {
    fs.writeFileSync(modelFilePath, genCode(name, flutter, opts));
    openAndFormatFile(modelFilePath);
  }
}

export function genCode(name: String, flutter: FlutterInfo, opts: GenModelOpts) {
  const namePascal = pascalCase(name);

  var fields = [];
  var params = [];
  var supers = [];
  var fromMaps = [];
  var toMaps = [];
  var copiesParams = [];
  var copiesAssigns = [];

  for (let _field of opts.fields) {
    var newFieldName = _field.trim();
    var tyIsPlural = false;
    var ty = "String";
    var customType = "";

    let s = _field.split(':');

    if (s.length === 1) {
      s.push('z');
    }
    if (s.length > 2) {
      s = [s[0], s[s.length - 1]];
    }
    newFieldName = s[0];

    switch (s[1]) {
      case 'id': {
        ty = "int";
        break;
      }
      case 'z': {
        ty = "String";
        break;
      }
      case 'b': {
        ty = "bool";
        break;
      }
      case 'dt': {
        ty = "String";
        break;
      }
      case 'i':
      case 'i32': {
        ty = "int";
        break;
      }
      case 'i64': {
        ty = "int";
        break;
      }
      case 'd': {
        ty = "double";
        break;
      }
      case 'z[]': {
        tyIsPlural = true;
        ty = "List<String>";
        break;
      }
      case 'i[]':
      case 'i32[]': {
        tyIsPlural = true;
        ty = "List<int>";
        break;
      }
      case 'i[]':
      case 'i64[]': {
        tyIsPlural = true;
        ty = "List<int>";
        break;
      }
      case 'b[]': {
        tyIsPlural = true;
        ty = "List<bool>";
        break;
      }
      default: {
        tyIsPlural = s[1].endsWith('[]');
        customType = s[1].trim();
        if (tyIsPlural){
          customType = s[1].substring(0, s[1].length - 2).trim();
          ty = `List<${customType}>`;
        }else{
          ty = `${customType}`;
        }
        break;
      }
    }

    console.log("paramName: " + newFieldName);

    const newFieldNameSnake = snakeCase(newFieldName);
    const newFieldNameCamel = camelCase(newFieldName);

    params.push(`this.${newFieldNameCamel}`);
    supers.push(newFieldNameCamel);

    fields.push(`  final ${ty} ${newFieldNameCamel};`);
    if (customType.length === 0){
      toMaps.push(`    data["${newFieldNameSnake}"] = this.${newFieldNameCamel};`);
    }else{
      if (tyIsPlural){
        toMaps.push(`    data["${newFieldNameSnake}"] = this.${newFieldNameCamel}.map((a) => a.toMap()).toList();`);
      }else{
        toMaps.push(`    data["${newFieldNameSnake}"] = this.${newFieldNameCamel}.toMap();`);
      }
    }
    if (tyIsPlural) {
      if (customType.length === 0){
        fromMaps.push(`List.from(data['${newFieldNameSnake}'])`);
      }else{
        fromMaps.push(`List.from(data['${newFieldNameSnake}'].map((a) => ${customType}.fromMap(a)).toList())`);
      }
    } else {
      if (customType.length === 0){
        fromMaps.push(`data['${newFieldNameSnake}'] as ${ty}`);
      }else{
        fromMaps.push(`${customType}.fromMap(data['${newFieldNameSnake}'])`);
      }
    }
    copiesParams.push(`${ty} ${newFieldNameCamel}`);
    copiesAssigns.push(`${newFieldNameCamel} ?? this.${newFieldNameCamel}`);
  }
  var paramsAdd = "";
  if (params.length > 0) {
    paramsAdd = `, ${params.join(',')}`;
  }
  var supersAdd = "";
  if (supers.length > 0) {
    supersAdd = ", " + supers.join(',');
  }
  var fromMapsAdd = "";
  if (fromMaps.length > 0) {
    fromMapsAdd = ", " + fromMaps.join(',');
  }
  var copiesAssignsAdd = "";
  if (copiesAssigns.length > 0) {
    copiesAssignsAdd = ", " + copiesAssigns.join(", ");
  }

  return `// this code is autogenerated using ansvia-vscode extension.
import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';

/// Model for ${name}
@immutable
class ${namePascal} extends Equatable {
  final int id;
  ${fields.join('\n').trim()}

  ${namePascal}(this.id${paramsAdd})
      : super([id${supersAdd}]);

  Map<String, dynamic> toMap() {
    Map<String, dynamic> data = Map();
    data["id"] = this.id;
    ${toMaps.join('\n').trim()}
    return data;
  }

  static ${namePascal} fromMap(Map<String, dynamic> data) {
    return ${namePascal}(
        data['id'] as int${fromMapsAdd});
  }

  ${namePascal} copy({${copiesParams.join(', ')}}) {
    return ${namePascal}(this.id${copiesAssignsAdd});
  }
}`;
}
