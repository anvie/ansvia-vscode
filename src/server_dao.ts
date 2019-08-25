import { getRootDir, ProjectType, openFile, normalizeName, nameToPlural } from "./util";
import { window, Position } from "vscode";

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

  const reName = new RegExp("pub struct (\\w*) {");
  const reField = new RegExp("pub (\\w*): *([a-zA-Z0-9_<>:]*),?");

  var name = "";

  let lines = text.split('\n');
  let newLines = [];
  let fields = [];

  for (let line of lines) {
    var s = reName.exec(line);
    if (s && s[1]) {
      if (name !== "") {
        window.showWarningMessage("Name already defined: " + name);
        return;
      }
      name = s[1].trim();
      newLines.push(`    /// Update ${pascalCase(name)}`);
      newLines.push(`    pub fn update(&self,id: ID,`);
      continue;
    }
    if (name.length > 0) {
      s = reField.exec(line);
      if (s === null) {
        continue;
      }
      // console.log("s: " + s);
      // console.log("s[2]: " + s[2]);
      if (s[1]) {
        let fieldName = s[1].trim();
        if (fieldName === "id" || fieldName === "ts"){
          continue;
        }
        let ty = s[2].trim();
        fields.push([fieldName, ty]);
        if (ty === "String") {
          newLines.push(`        ${fieldName}: &str,`);
        } else if (ty.startsWith("Vec")) {
          newLines.push(`        ${fieldName}: &${ty},`);
        } else if (ty === "bool" || ty === "i16" || ty === "u16" ||
          ty === "i32" || ty === "u32" || ty === "i64" || ty === "u64" ||
          ty === "f32" || ty === "f64" || ty === "ID") {
          newLines.push(`        ${fieldName}: ${ty},`);
        } else {
          newLines.push(`        ${s[1]}: &T,`);
        }
      }
    }
  }

  newLines.push(`    ) -> Result<bool> {`);

  // Build function code

  let nameSnake = snakeCase(name);

  newLines.push(`        use crate::schema::${nameSnake}s::{self, dsl};
        diesel::update(dsl::${nameSnake}s.filter(dsl::id.eq(id)))
            .set((`);


  for (let field of fields){
    console.log("field: " + field);
    let fieldName = field[0];
    let ty = field[1];

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
