import { getRootDir, ProjectType, openFile, normalizeName, nameToPlural } from "./util";
import { window, Position } from "vscode";

import snakeCase = require('snake-case');
import pascalCase = require('pascal-case');
import fs = require('fs');
import clipboardy = require('clipboardy');
import { Field } from "./field";

export async function generateApiUpdateMethod() {
  const rootDir = getRootDir(ProjectType.Server);

  if (!rootDir) {
    return;
  }
  
  let name = await window.showInputBox({
    value: '',
    placeHolder: 'Name, eg: Courier'
  }) || "";

  if (name.length === 0) {
    window.showInformationMessage("No name");
    return;
  }

  let fieldsStr = await window.showInputBox({
    value: '',
    placeHolder: 'Fields, eg: name:z,courier_id:id'
  }) || "";

  let fields = Field.parseFields(fieldsStr);
  fields = Field.mapShortcutTypeToRustType(fields);

  let newLines = [];

  let namePascal = pascalCase(name);
  let nameSnake = snakeCase(name);

  newLines.push(`
///// Update ${name} query
//#[derive(Deserialize, Validate)]
//pub struct Update${namePascal} {
//    pub id: ID,`);

  for (let field of fields){
    if (field.ty === "String"){
      newLines.push(`//    #[validate(length(min = 3, max = 1000, message = "${field.name} min 3 and max 1000 characters long"))]`);
    }
    newLines.push(`//    pub ${field.nameSnake}: ${field.ty},`);
  }
  newLines.push('//}\n');

  newLines.push(`    /// Update ${name} rest API endpoint.
    #[api_endpoint(path = "/${nameSnake}/update", auth = "required", mutable)]`);
  newLines.push(`    pub fn update_${nameSnake}(query: Update${namePascal}) -> ApiResult<()> {
        query.validate()?;

        let conn = state.db();
        let dao = ${namePascal}Dao::new(&conn);
        dao.update(
            query.id,`);

  for (let field of fields){
    if (field.ty === "String"){
      newLines.push(`            &query.${field.nameSnake},`);
    }else if (field.ty.startsWith("Vec<")){
      newLines.push(`            &query.${field.nameSnake},`);
    }else if (field.ty.startsWith("Option<Vec<")){
      newLines.push(`            &query.${field.nameSnake}.unwrap_or(vec![]),`);
    }else{
      newLines.push(`            query.${field.nameSnake},`);
    }
  }
  newLines.push(`        )?;`);
  newLines.push(`        Ok(ApiResult::success(()))`);
  newLines.push(`    }`);

  let generatedCode = newLines.join('\n');

  const editor = window.activeTextEditor!;
  editor.edit(builder => {
    builder.replace(editor.selection.anchor, generatedCode);
  });

}
