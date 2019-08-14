import { getRootDir, ProjectType } from "./util";
import { window, ExtensionContext, commands, TextEditorEdit, Position } from "vscode";
import { fstat } from "fs";
import { Cmd } from "./cmd";

const snakeCase = require('snake-case');
const camelCase = require('camel-case');
const pascalCase = require('pascal-case');
const fs = require('fs');

export enum ServerKind {
  Model,
  Dao,
  ModelToApiType
}

export class ServerOpts {
  kind: ServerKind;
  constructor(kind: ServerKind) {
    this.kind = kind;
  }
}

export async function generateModel(opts: ServerOpts) {
  const rootDir = getRootDir(ProjectType.Server);

  if (!rootDir) {
    return;
  }

  console.log("rootDir: " + rootDir);

  var name = "";

  if (opts.kind !== ServerKind.ModelToApiType){
    name = await window.showInputBox({
      value: '',
      placeHolder: 'Service name, example: Account'
    }) || "";

    if (name.length === 0) {
      window.showInformationMessage("No name");
      return;
    }
  }

  const editor = window.activeTextEditor!;

  switch (opts.kind) {
    case ServerKind.Model: {
      const fieldsStr = await window.showInputBox({
        value: '',
        placeHolder: 'Fields, eg: id:id,name:z,active:b,timestamp:dt,num:i,num:i64,keywords:z[]'
      }) || "";
      let fields = fieldsStr.split(',').map((a) => a.trim());
      editor.edit(builder => {
        let result = generateModelCode(name, fields, opts, builder);
        builder.replace(editor.selection.anchor, result);
      });
      break;
    }
    case ServerKind.Dao: {
      const fieldsStr = await window.showInputBox({
        value: '',
        placeHolder: 'Fields, eg: id:id,name:z,active:b,timestamp:dt,num:i,num:i64,keywords:z[]'
      }) || "";
      let fields = fieldsStr.split(',').map((a) => a.trim()).filter((a) => a.length > 0);
      editor.edit(builder => {
        let result = generateDaoCode(name, fields, opts, builder);
        builder.replace(editor.selection.anchor, result);
      });
      break;
    }
    case ServerKind.ModelToApiType: {
      editor.edit(builder => {
        let result = generateModelToApiConverter(opts, builder);
        let nextPos = editor.selection.end.line + 1;
        builder.replace(new Position(nextPos, 0), '\n' + result + '\n');
      });
      break;
    }
  }
}

function generateModelToApiConverter(opts: ServerOpts, builder: TextEditorEdit): string {
  const editor = window.activeTextEditor!;

  const text = editor.document.getText(editor.selection);
  console.log("selected text: " + text);

  const reName = new RegExp("pub struct (\\w*) {");
  const reField = new RegExp("pub (\\w*): *(\\w*),?");

  var name = "";

  let lines = text.split('\n');
  let newLines = [];
  let fields = [];

  for (let line of lines){
    var s = reName.exec(line);
    if (s && s[1]){
      if (name !== ""){
        window.showWarningMessage("Name already defined: " + name);
        return "";
      }
      name = s[1].trim();
      const namePascal = pascalCase(name);
      newLines.push(`impl ToApiType<${namePascal}> for models::${namePascal} {`);
      newLines.push(`    fn to_api_type(&self, conn: &PgConnection) -> ${namePascal} {`);
      newLines.push(`        ${namePascal} {`);
      continue;
    }
    if (name.length > 0){
      s = reField.exec(line);
      if (s === null){
        continue;
      }
      console.log("s: " + s);
      console.log("s[2]: " + s[2]);
      if (s[1]){
        if (s[2].trim() === "String"){
          newLines.push(`            ${s[1]}: self.${s[1]}.to_owned(),`);
        }else if (s[2].startsWith("Vec")){
          newLines.push(`            ${s[1]}: self.${s[1]}.clone(),`);
        }else{
          newLines.push(`            ${s[1]}: self.${s[1]},`);
        }
      }
    }
  }
  newLines.push('        }');
  newLines.push('    }');
  newLines.push('}');

  return newLines.join('\n');
}

function generateDaoCode(name: String, fields: String[], opts: ServerOpts, builder: TextEditorEdit) {
  // const editor = window.activeTextEditor!;
  const namePascal = pascalCase(name);
  const nameSnake = snakeCase(name);

  var newFields = [];

  for (let _field of fields) {
    var newFieldName = _field.trim();
    var tyIsPlural = false;
    var ty = "&'a str";

    let s = _field.split(':');

    if (s.length === 1) {
      s.push('z');
    }
    newFieldName = s[0];

    switch (s[1]) {
      case 'id': {
        ty = "ID";
        break;
      }
      case 'z': {
        ty = "&'a str";
        break;
      }
      case 'b': {
        ty = "bool";
        break;
      }
      case 'dt': {
        ty = "NaiveDateTime";
        break;
      }
      case 'i':
      case 'i32': {
        ty = "i32";
        break;
      }
      case 'i64': {
        ty = "i64";
        break;
      }
      case 'z[]': {
        tyIsPlural = true;
        ty = "&'a Vec<String>";
        break;
      }
      case 'i[]':
      case 'i32[]': {
        tyIsPlural = true;
        ty = "Vec<i32>";
        break;
      }
      case 'i[]':
      case 'i64[]': {
        tyIsPlural = true;
        ty = "Vec<i64>";
        break;
      }
    }

    console.log("newFieldName: " + newFieldName);

    const newFieldNameSnake = snakeCase(newFieldName);

    newFields.push([newFieldNameSnake, ty]);
  }

  var newLines = [];
  newLines.push(`
/// Data Access Object for ${name}
#[derive(Dao)]
pub struct ${namePascal}Dao<'a> {
    db: &'a PgConnection,
}

#[derive(Insertable)]
#[table_name = "${nameSnake}s"]
struct New${namePascal}<'a> {
    `.trim());

  for (let fld of newFields) {
    newLines.push(`    pub ${fld[0]}: ${fld[1]},`);
  }

  newLines.push('}\n');

  newLines.push(`
impl<'a> ${namePascal}Dao<'a> {
  /// Create new ${namePascal}
  pub fn create(&self,
`.trim());

  for (let fld of newFields) {
    newLines.push(`      ${fld[0]}: ${fld[1]},`);
  }
  newLines.push(`    ) -> Result<${namePascal}> {`);
  newLines.push(`    use crate::schema::${nameSnake}s::{self, dsl};`);

  newLines.push(`
    diesel::insert_into(${nameSnake}s::table)
        .values(&New${namePascal} {
`);

  for (let fld of newFields) {
    newLines.push(`            ${fld[0]},`);
  }

  newLines.push(`        })
        .get_result(self.db)
        .map_err(From::from)
  }
}`);

  return newLines.join('\n');
}

function generateModelCode(name: String, fields: String[], opts: ServerOpts, builder: TextEditorEdit) {
  const editor = window.activeTextEditor!;
  const namePascal = pascalCase(name);
  const nameSnake = snakeCase(name);

  var newFields = [];

  for (let _field of fields) {
    var newFieldName = _field.trim();
    var tyIsPlural = false;
    var ty = "String";

    let s = _field.split(':');

    if (s.length === 1) {
      s.push('z');
    }
    newFieldName = s[0];

    switch (s[1]) {
      case 'id': {
        ty = "ID";
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
        ty = "NaiveDateTime";
        break;
      }
      case 'i':
      case 'i32': {
        ty = "i32";
        break;
      }
      case 'i64': {
        ty = "i64";
        break;
      }
      case 'z[]': {
        tyIsPlural = true;
        ty = "Vec<String>";
        break;
      }
      case 'i[]':
      case 'i32[]': {
        tyIsPlural = true;
        ty = "Vec<i32>";
        break;
      }
      case 'i[]':
      case 'i64[]': {
        tyIsPlural = true;
        ty = "Vec<i64>";
        break;
      }
    }

    console.log("newFieldName: " + newFieldName);

    const newFieldNameSnake = snakeCase(newFieldName);

    newFields.push([newFieldNameSnake, ty]);
  }

  var newLines = [];
  newLines.push(`
#[doc(hidden)]
#[derive(Queryable, Serialize)]
pub struct ${namePascal} {
    `.trim());

  for (let fld of newFields) {
    newLines.push(`    pub ${fld[0]}: ${fld[1]},`);
  }
  newLines.push('}');

  return newLines.join('\n');
}
