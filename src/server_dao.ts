import { getRootDir, ProjectType, openFile, normalizeName, nameToPlural } from "./util";
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
      newLines.push(`        ${s[1]}: &T,`);
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
      newLines.push(`        ${s[1]}: &T,`);
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
