import { getRootDir, ProjectType, openFile, normalizeName, nameToPlural, parseFieldsStr, shortcutTypeToRustType, insertLineInFile } from "./util";
import { window, Position } from "vscode";

import { ModelStruct } from "./rust_parser";

import snakeCase = require('snake-case');
import pascalCase = require('pascal-case');
import fs = require('fs');
import clipboardy = require('clipboardy');
import { parseModel } from "./server_model";
import { Field } from "./field";

export enum DaoKind {
  UpdateMethod
}

export class DaoOpts {
  kind: DaoKind;
  constructor(kind: DaoKind) {
    this.kind = kind;
  }
}

export async function generateDao(newFile:boolean){
  let rootDir = getRootDir(ProjectType.Server);
  const editor = window.activeTextEditor!;

  let name = await window.showInputBox({
    value: '',
    placeHolder: 'Service name, example: Account'
  }) || "";

  if (name.length === 0) {
    window.showInformationMessage("No name");
    return;
  }

  const fieldsStr = await window.showInputBox({
    value: '',
    placeHolder: 'Fields, eg: name:z,active:b,timestamp:dt,num:i,num:i64,keywords:z[]'
  }) || "";
  let fields = parseFieldsStr(fieldsStr);

  if (!newFile) {
    editor.edit(builder => {
      let result = generateDaoCode(name, fields, new GenDaoOpts(false, []));
      builder.replace(editor.selection.anchor, result);
    });
  } else {
    editor.edit(() => {
      let nameSnake = snakeCase(name);
      let result = generateDaoCode(name, fields, new GenDaoOpts(false, []));
      let daoFile = `${rootDir}/src/${nameSnake}_dao.rs`;
      fs.writeFileSync(daoFile, result);

      // update lib.rs files
      // add pub mod into mod.rs file
      insertLineInFile(`${rootDir}/src/lib.rs`, "pub mod", `pub mod ${nameSnake}_dao;`);
      insertLineInFile(`${rootDir}/src/dao.rs`, "pub use", `pub use crate::${nameSnake}_dao::${pascalCase(name)}Dao;`);
      openFile(daoFile);
    });
  }
}

export async function generateDaoFromModel(newFile:boolean) {
  let rootDir = getRootDir(ProjectType.Server);

  const editor = window.activeTextEditor!;

  const text = editor.document.getText(editor.selection);
  let model = parseModel(text);

  if (!newFile) {
    editor.edit(builder => {
      let result = generateDaoCode(model.name, model.fields, new GenDaoOpts(false, ["id", "ts"]));
      builder.replace(editor.selection.anchor, result);
    });
  } else {
    editor.edit(() => {
      let nameSnake = snakeCase(model.name);
      let result = generateDaoCode(model.name, model.fields, new GenDaoOpts(true, ["id", "ts"]) );
      let daoFile = `${rootDir}/src/${nameSnake}_dao.rs`;
      fs.writeFileSync(daoFile, result);

      // update lib.rs files
      // add pub mod into mod.rs file
      insertLineInFile(`${rootDir}/src/lib.rs`, "pub mod", `pub mod ${nameSnake}_dao;`);
      insertLineInFile(`${rootDir}/src/dao.rs`, "pub use", `pub use crate::${nameSnake}_dao::${pascalCase(model.name)}Dao;`);
      openFile(daoFile);
    });
  }
}

export class GenDaoOpts {
  newFile:boolean;
  excludeFields: string[];
  constructor(newFile:boolean, excludeFields:string[]){
    this.newFile = newFile;
    this.excludeFields = excludeFields;
  }
}

export function generateDaoCode(name: string, fields: Field[], opts: GenDaoOpts) {
  name = normalizeName(name);
  const namePascal = pascalCase(name);
  const nameSnake = snakeCase(name);

  var newFields = [];

  for (let _field of fields) {
    var newFieldName = _field.name.trim();

    if (opts.excludeFields.includes(newFieldName)){
      continue;
    }

    var ty = shortcutTypeToRustType(_field.ty);

    if (ty === "String"){
      ty = "&'a str";
    }else if (ty === "Vec<String>"){
      ty = "&'a Vec<&'a str>";
    }

    const newFieldNameSnake = snakeCase(newFieldName);

    newFields.push([newFieldNameSnake, ty]);
  }

  let tableName = nameToPlural(nameSnake);

  var newLines = [];


  if (opts.newFile) {
    newLines.push(`//! Dao implementation for ${name}
//! 

use chrono::prelude::*;
use diesel::prelude::*;

use crate::{ID, result::Result, models::${namePascal}, schema::${tableName}};
`);
  }

  newLines.push(`
#[derive(Insertable)]
#[table_name = "${tableName}"]
struct New${namePascal}<'a> {`);

  for (let fld of newFields) {
    newLines.push(`    pub ${fld[0]}: ${fld[1]},`);
  }

  newLines.push('}\n');

  newLines.push(`
/// Data Access Object for ${name}
#[derive(Dao)]
#[table_name="${tableName}"]
pub struct ${namePascal}Dao<'a> {
    db: &'a PgConnection,
}
`);

  newLines.push(`
impl<'a> ${namePascal}Dao<'a> {
  /// Create new ${namePascal}
  pub fn create(&self,
`.trim());

  for (let fld of newFields) {
    newLines.push(`      ${fld[0]}: ${fld[1]},`);
  }
  newLines.push(`    ) -> Result<${namePascal}> {`);
  newLines.push(`    use crate::schema::${tableName}::{self, dsl};`);

  newLines.push(`
    diesel::insert_into(${tableName}::table)
        .values(&New${namePascal} {`);

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
  let tableNameSnake = snakeCase(tableName);
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
    newLines.push(`        use crate::schema::${tableNameSnake}::{self, dsl};`);
    newLines.push(`        diesel::update(dsl::${tableNameSnake}.filter(dsl::id.eq(id)))
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
