import { getRootDir, ProjectType } from "./util";
import { window, ExtensionContext, commands } from "vscode";
import { Cmd } from "./cmd";
import { generateModel, ServerOpts, ServerKind, generateModelFromSQLDef } from "./server_model";

const snakeCase = require('snake-case');
const camelCase = require('camel-case');
const pascalCase = require('pascal-case');
const fs = require('fs');


export interface ServiceOpts {
  name: String;
}


export function setup(context: ExtensionContext) {
  context.subscriptions.push(commands.registerCommand('extension.mainframe', async () => {
    const quickPick = window.createQuickPick();
    quickPick.items = [
      new Cmd("Generate basic CRUD Service +API", () => generateCode({ name: '' })),
      new Cmd("Generate model", () => generateModel(new ServerOpts(ServerKind.Model))),
      new Cmd("Generate DAO inline", () => generateModel(new ServerOpts(ServerKind.DaoInline))),
      new Cmd("Generate DAO new file", () => generateModel(new ServerOpts(ServerKind.DaoNewFile))),
      new Cmd("Generate Model to API type", () => generateModel(new ServerOpts(ServerKind.ModelToApiType))),
      new Cmd("Generate Model from SQL definition", () => generateModelFromSQLDef(new ServerOpts(ServerKind.Model))),
      // new Cmd("Generate CRUD Screen Page (stateless)", () => generateFlutter({statefulScreenPage: false}) ),
    ];
    quickPick.onDidChangeSelection(selection => {
      if (selection[0]) {
        (selection[0] as Cmd).code_action(context).catch(console.error)
          .then((result) => {
            console.log(result);
            quickPick.dispose();
          });
      }
    });
    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  }));
}


async function generateCode(opts: ServiceOpts) {
  const rootDir = getRootDir(ProjectType.Server);

  if (!rootDir) {
    return;
  }

  console.log("rootDir: " + rootDir);

  const name = await window.showInputBox({
    value: '',
    placeHolder: 'Service name, example: Account'
  }) || "";

  if (name.length === 0) {
    window.showInformationMessage("No name");
    return;
  }

  const path = `${rootDir}/src/api`;

  if (!fs.existsSync(path)) {
    window.showWarningMessage(`Path not exists: ${path}`);
    return;
  }

  opts.name = name;

  generateApiCode(path, opts);
  generateServiceCode(`${rootDir}/src/service`, opts);
}

function generateServiceCode(baseDir: String, opts: ServiceOpts) {
  const namePascal = pascalCase(opts.name);
  const nameSnake = snakeCase(opts.name);

  const newCode = `impl_service!(${namePascal}Service, ${nameSnake});\n`;

  fs.appendFileSync(`${baseDir}/services.rs`, newCode);
}

function generateApiCode(path: String, opts: ServiceOpts) {
  const namePascal = pascalCase(opts.name);
  const nameSnake = snakeCase(opts.name);

  const newCode = `
//! Koleksi query yang digunakan untuk operasi pada rest API ${namePascal}
#![allow(missing_docs)]

use actix_web::{HttpRequest, HttpResponse};
use chrono::NaiveDateTime;
use protobuf;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::{
    api,
    api::types::*,
    api::{ApiResult, Error as ApiError, HttpRequest as ApiHttpRequest, error::param_error},
    auth,
    dao::${namePascal}Dao,
    error::{Error, ErrorCode},
    models,
    prelude::*,
    ID,
};


/// New ${namePascal} query 
#[derive(Serialize, Deserialize)]
pub struct New${namePascal} {
    pub name: String,
}

/// Holder untuk implementasi API endpoint publik untuk ${nameSnake}.
pub struct PublicApi;

#[api_group("${namePascal}", "public", base = "/${nameSnake}/v1")]
impl PublicApi {
    /// Rest API endpoint untuk menambahkan ${nameSnake} baru.
    #[api_endpoint(path = "/add", mutable, auth = "required")]
    pub fn add_${nameSnake}(query: New${namePascal}) -> ApiResult<models::${namePascal}> {
        let conn = state.db();
        let dao = ${namePascal}Dao::new(&conn);

        // @TODO(*): Add parameter checking here

        dao
            .create(
                &query.name,
            )
            .map_err(From::from)
            .map(ApiResult::success)
    }

    /// Mendapatkan daftar ${nameSnake}
    #[api_endpoint(path = "/list", auth = "required")]
    pub fn list_${nameSnake}(query: QueryEntries) -> ApiResult<EntriesResult<models::${namePascal}>> {
        let conn = state.db();
        let dao = ${namePascal}Dao::new(&conn);

        let entries = dao.get_${nameSnake}s(query.offset, query.limit)?;

        let count = dao.count()?;
        Ok(ApiResult::success(EntriesResult { count, entries }))
    }

    /// Mendapatkan jumlah ${nameSnake} secara keseluruhan.
    #[api_endpoint(path = "/count", auth = "required")]
    pub fn ${nameSnake}_count(state: &AppState, query: ()) -> ApiResult<i64> {
        let conn = state.db();
        let dao = ${namePascal}Dao::new(&conn);

        dao.count().map(ApiResult::success).map_err(From::from)
    }

    /// Mendapatkan data ${nameSnake} berdasarkan ID.
    #[api_endpoint(path = "/detail", auth = "required")]
    pub fn ${nameSnake}_detail(query: IdQuery) -> ApiResult<models::${namePascal}> {
        let conn = state.db();
        let dao = ${namePascal}Dao::new(&conn);

        dao.get_by_id(query.id)
            .map(ApiResult::success)
            .map_err(From::from)
    }

    /// Delete ${nameSnake}.
    #[api_endpoint(path = "/delete", auth = "required", mutable="true")]
    pub fn delete_${nameSnake}(query: IdQuery) -> ApiResult<()> {
       let conn = state.db();
       let dao = ${namePascal}Dao::new(&conn);

       dao.delete_by_id(query.id)?;

       Ok(ApiResult::success(()))
    }
    
}

/// Holder untuk implementasi API endpoint privat.
pub struct PrivateApi;

#[api_group("${namePascal}", "private", base = "/${nameSnake}/v1")]
impl PrivateApi {}
`;
  fs.writeFileSync(`${path}/${nameSnake}.rs`, newCode);

  // add pub mod into mod.rs file
  {
    const modFile = `${path}/mod.rs`;
    const modData = fs.readFileSync(modFile).toString();

    var lines = modData.split(/\r?\n/);
    var newLines = [];
    var foundPubMod = false;
    var alreadyInserted = false;

    for (let [i, line] of lines.entries()) {
      if (!alreadyInserted) {
        if (line.trim().startsWith("pub mod")) {
          foundPubMod = true;
        } else if (foundPubMod) {
          newLines.push(`pub mod ${nameSnake};`);
          alreadyInserted = true;
        }
      }
      newLines.push(line);
    }

    fs.writeFileSync(modFile, newLines.join('\n'));
  }
}