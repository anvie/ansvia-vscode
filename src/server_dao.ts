import { getRootDir, ProjectType, openFile, normalizeName, nameToPlural, parseFieldsStr, shortcutTypeToRustType } from "./util";
import { window, Position } from "vscode";

import { ModelStruct } from "./rust_parser";

import snakeCase = require('snake-case');
import pascalCase = require('pascal-case');
import fs = require('fs');
import clipboardy = require('clipboardy');

export enum DaoKind {
  UpdateMethod
}

export class DaoOpts {
  kind: DaoKind;
  constructor(kind: DaoKind) {
    this.kind = kind;
  }
}

export async function generateDaoUpdateMethod() {
  const name = await window.showInputBox({
    value: '',
    placeHolder: 'Name, eg: status'
  }) || "";
  if (name === ""){
    return;
  }
  const tableName = await window.showInputBox({
    value: '',
    placeHolder: 'Table name, eg: product'
  }) || "";
  if (tableName === ""){
    return;
  }
  let nameSnake = snakeCase(name);
  const fieldsStr = await window.showInputBox({
    value: '',
    placeHolder: 'Fields, eg: id:id,name:z,active:b,timestamp:dt,num:i,num:i64,keywords:z[]'
  }) || "";

  let fields = parseFieldsStr(fieldsStr);

  const editor = window.activeTextEditor!;

  editor.edit(builder => {
    let newLines = [];

    newLines.push(`    /// Update ${name}
    pub fn update_${nameSnake}(
        &self,
        id: ID,`);

    for (let field of fields){
      newLines.push(`        ${field.name}: ${shortcutTypeToRustType(field.ty)},`);
    }
    newLines.push(`        ) -> Result<bool> {`);
    newLines.push(`        use crate::schema::${snakeCase(tableName)}s::{self, dsl};`);
    newLines.push(`        diesel::update(dsl::products.filter(dsl::id.eq(id)))
            .set((`);
    
    for (let field of fields){
      newLines.push(`            dsl::${field.nameSnake}.eq(&${field.nameSnake}),`);
    }

    newLines.push(`            ))`);
    newLines.push(`            .execute(self.db)
            .map(|a| a > 0)
            .map_err(From::from)`);
    newLines.push('    }');
    let result = newLines.join('\n');
    builder.replace(editor.selection.anchor, result);
  });
}

export async function copyDaoUpdateMethod(opts: DaoOpts) {
  const rootDir = getRootDir(ProjectType.Server);

  if (!rootDir) {
    return;
  }
  const editor = window.activeTextEditor!;

  const text = editor.document.getText(editor.selection);

  let model = ModelStruct.parse(text);

  if (model === null){
    return;
  }

  model = model!;

  let newLines = [];

  newLines.push(`    /// Update ${pascalCase(model.name)}`);
  newLines.push(`    pub fn update(&self,id: ID,`);

  for (let field of model.fields){
    if (field.name === "id" || field.name === "ts"){
      continue;
    }
    if (field.ty === "String") {
      newLines.push(`        ${field.name}: &str,`);
    } else if (field.ty.startsWith("Vec")) {
      newLines.push(`        ${field.name}: &${field.ty},`);
    } else if (field.ty === "bool" || field.ty === "i16" || field.ty === "u16" ||
      field.ty === "i32" || field.ty === "u32" || field.ty === "i64" || field.ty === "u64" ||
      field.ty === "f32" || field.ty === "f64" || field.ty === "ID") {
      newLines.push(`        ${field.name}: ${field.ty},`);
    } else {
      newLines.push(`        ${field.name}: &T,`);
    }
  }

  newLines.push(`    ) -> Result<bool> {`);

  // Build function code

  let nameSnake = snakeCase(model.name);

  newLines.push(`        use crate::schema::${nameSnake}s::{self, dsl};
        diesel::update(dsl::${nameSnake}s.filter(dsl::id.eq(id)))
            .set((`);


  for (let field of model.fields){
    console.log("field: " + field);
    let fieldName = field.name;
    
    if (field.name === "id" || field.name === "ts"){
      continue;
    }

    let ty = field.ty;

    let fieldNameSnake = snakeCase(fieldName);

    if (ty === "String" || ty.startsWith("Vec")){
      newLines.push(`            dsl::${fieldNameSnake}.eq(&${fieldNameSnake}),`);
    }else{
      newLines.push(`            dsl::${fieldNameSnake}.eq(${fieldNameSnake}),`);
    }
  }

  newLines.push(`            ))
            .execute(self.db)
            .map(|a| a > 0)
            .map_err(From::from)
    }`);

  let generatedCode = newLines.join('\n');

  clipboardy.writeSync(generatedCode);

  window.showInformationMessage("Generated code copied into clipboard!");

}

export async function copyDaoAddMethod() {
  const rootDir = getRootDir(ProjectType.Server);

  if (!rootDir) {
    return;
  }
  const editor = window.activeTextEditor!;

  const text = editor.document.getText(editor.selection);

  let model = ModelStruct.parse(text);

  if (model === null){
    return;
  }

  model = model!;

  let newLines = [];

  let namePascal = pascalCase(model.name);

  newLines.push(`    /// Add ${namePascal}`);
  newLines.push(`    pub fn add_${snakeCase(model.name)}(&self,`);

  for (let field of model.fields){
    if (field.name === "id" || field.name === "ts"){
      continue;
    }
    if (field.ty === "String") {
      newLines.push(`        ${field.name}: &str,`);
    } else if (field.ty.startsWith("Vec")) {
      newLines.push(`        ${field.name}: &${field.ty},`);
    } else if (field.ty === "bool" || field.ty === "i16" || field.ty === "u16" ||
      field.ty === "i32" || field.ty === "u32" || field.ty === "i64" || field.ty === "u64" ||
      field.ty === "f32" || field.ty === "f64" || field.ty === "ID") {
      newLines.push(`        ${field.name}: ${field.ty},`);
    } else {
      newLines.push(`        ${field.name}: &T,`);
    }
  }

  newLines.push(`    ) -> Result<${namePascal}> {`);

  // Build function code

  let nameSnake = snakeCase(model.name);

  newLines.push(`        use crate::schema::${nameSnake}s::{self, dsl};
        diesel::insert_into(courier_services::table)
            .values(&New${namePascal} {`);


  for (let field of model.fields){
    console.log("field: " + field);
    let fieldName = field.name;
    
    if (field.name === "id" || field.name === "ts"){
      continue;
    }

    // let ty = field.ty;

    let fieldNameSnake = snakeCase(fieldName);

    newLines.push(`            ${fieldNameSnake},`);
  }

  newLines.push(`            })
            .get_result(self.db)
            .map_err(From::from)
    }`);

  let generatedCode = newLines.join('\n');

  clipboardy.writeSync(generatedCode);

  window.showInformationMessage("Generated code copied into clipboard!");

}
