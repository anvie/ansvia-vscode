
import { window, ExtensionContext, commands, Uri } from 'vscode';
import { getRootDir, ProjectType, parseFieldsStr, reformatDocument, shortcutTypeToFlutterType } from './util';
// import { doGenerateBlocCode } from './bloc';
import { Cmd } from './cmd';
import { generatePage, GenPageOpts, PageKind } from './flutter_page';
import { generateWidget, GenWidgetOpts, WidgetKind } from './flutter_widget';
import { generateModel, GenModelOpts, generateModelFromSQLDef, generateModelFromApiType } from './flutter_model';
import { generateFragment, GenFragmentOpts, FragmentKind } from './flutter_fragment';
import { generateButton, GenButtonOpts, ButtonKind } from './flutter_button';
import * as flutterBloc from './flutter_bloc';

var snakeCase = require('snake-case');
var pascalCase = require('pascal-case');

var fs = require('fs');
var yaml = require('js-yaml');

export interface FlutterOpts {
  statefulScreenPage: boolean;
}

export function setup(context: ExtensionContext) {
  context.subscriptions.push(commands.registerCommand('extension.flutter', async () => {
    const quickPick = window.createQuickPick();
    quickPick.items = [
      new Cmd("Generate List Widget W1 (bloc mode, stateless)", () => generateWidget(new GenWidgetOpts(true, WidgetKind.List))),
      new Cmd("Generate List Widget W2 (bloc mode, stateful)", () => generateWidget(new GenWidgetOpts(true, WidgetKind.List, false, true))),
      new Cmd("Generate List Widget W3 (non bloc mode)", () => generateWidget(new GenWidgetOpts(false, WidgetKind.List))),
      new Cmd("Generate List Item Widget", () => generateWidget(new GenWidgetOpts(false, WidgetKind.ListItem))),
      new Cmd("Generate Detail Field Widget", () => generateWidget(new GenWidgetOpts(false, WidgetKind.DetailField, true))),
      new Cmd("Generate Model", () => generateModel(new GenModelOpts())),
      new Cmd("Generate Model from Rust struct", () => generateModelFromApiType()),
      new Cmd("Generate Model from SQL definition", () => generateModelFromSQLDef(new GenModelOpts())),
      new Cmd("Add Model fields", () => generateFragment(new GenFragmentOpts(FragmentKind.ModelAddField))),
      new Cmd("Edit Model fields", () => generateFragment(new GenFragmentOpts(FragmentKind.ModelEditField, true))),
      new Cmd("Generate Basic Page", () => generatePage(new GenPageOpts(PageKind.Basic))),
      new Cmd("Generate Detail Page", () => generatePage(new GenPageOpts(PageKind.Detail))),
      new Cmd("Generate Form Add Page", () => generatePage(new GenPageOpts(PageKind.FormAdd))),
      new Cmd("Generate Form Edit Page", () => generatePage(new GenPageOpts(PageKind.FormUpdate))),
      new Cmd("Generate Autocompletable form field", () => generateFragment(new GenFragmentOpts(FragmentKind.FormAutocompleteField))),
      new Cmd("Generate Popup Menu Button", () => generateButton(new GenButtonOpts(ButtonKind.PopupMenu))),
      new Cmd("Generate BloC (+event, +state, +CRUD, +model)", () => flutterBloc.generateBloc(new flutterBloc.GenBlocOpts(flutterBloc.BlocKind.CRUDMethods, true, true, true, true, false))),
      new Cmd("Generate BloC (+event, +state, +CRUD, -model)", () => flutterBloc.generateBloc(new flutterBloc.GenBlocOpts(flutterBloc.BlocKind.CRUDMethods, true, true, true, false, false))),
      new Cmd("Generate BloC with SmartRepo BLOC1 (+event, +state, +CRUD)", () => flutterBloc.generateBloc(new flutterBloc.GenBlocOpts(flutterBloc.BlocKind.CRUDMethods, true, true, true, false, true))),
      new Cmd("Generate BloC with SmartRepo BLOC2 (+event, +state, +CRUD, +model)", () => flutterBloc.generateBloc(new flutterBloc.GenBlocOpts(flutterBloc.BlocKind.CRUDMethods, true, true, true, true, true))),
      new Cmd("Generate BloC with SmartRepo BLOC3 (+event, +state, +CRUD, -model)", () => flutterBloc.generateBloc(new flutterBloc.GenBlocOpts(flutterBloc.BlocKind.CRUDMethods, true, true, true, false, true))),
      new Cmd("Generate Class variables and constructor CVC1", () => generateClassVarAndConstructor(true, false)),
      new Cmd("Generate Class variables and constructor CVC2 (+key)", () => generateClassVarAndConstructor(true, true)),
      new Cmd("Generate Class variables and constructor CVC3 (+key, -final)", () => generateClassVarAndConstructor(false, true))
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

async function generateClassVarAndConstructor(useFinal:boolean, withKey:boolean){
  
  const name = await window.showInputBox({
    value: '',
    placeHolder: 'class name, eg: Todo'
  });
  const namePascalCase = pascalCase(name);

  const fieldsStr = await window.showInputBox({
    value: '',
    placeHolder: 'Fields, eg: name:z,active:b,timestamp:dt,num:i,num:i64,keywords:z[]'
  }) || "";
  let fields = parseFieldsStr(fieldsStr);

  var newLines:string[] = [];
  let params = [];

  for (let field of fields){
    if (useFinal){
      newLines.push(`final ${shortcutTypeToFlutterType(field.ty)} ${field.nameCamel};`);
    }else{
      newLines.push(`${shortcutTypeToFlutterType(field.ty)} ${field.nameCamel};`);
    }
    
    params.push(`this.${field.nameCamel}`);
  }
  newLines.push("\n");

  let paramsStr = params.join(', ');

  if (withKey){
    newLines.push(`${namePascalCase}({Key key, ${paramsStr}}) : super(key: key);`);
  }else{
    newLines.push(`${namePascalCase}({${paramsStr}});`);
  }

  const editor = window.activeTextEditor!;
  var filePath = "";
  if (window.activeTextEditor !== null) {
    filePath = window.activeTextEditor!.document.fileName;
  }
  editor.edit(builder => {
    let result = newLines.join('\n');
    builder.insert(editor.selection.anchor, result);
    reformatDocument(Uri.file(filePath));
  });
}

export async function generateFlutter(opts: FlutterOpts) {
  const rootDir = getRootDir(ProjectType.Mobile);

  if (!rootDir) {
    return;
  }

  console.log("rootDir: " + rootDir);

  // get project name
  var project = yaml.safeLoad(fs.readFileSync(`${rootDir}/pubspec.yaml`));

  console.log(project);
  console.log("project.name: " + project['name']);

  var projectName = project['name'];

  if (projectName.endsWith("_mobile")) {
    projectName = projectName.substring(0, projectName.length - 7);
  }

  // get component name
  const name = await window.showInputBox({
    value: '',
    valueSelection: [0, 11],
    placeHolder: 'BloC name, example: TodoBloc'
  }) || "";

  var libDir = rootDir + '/lib';
  var screenDir = libDir + '/screens';

  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir);
    fs.mkdirSync(screenDir);
  }
  var nameSnake = snakeCase(name);

  if (!fs.existsSync(`${screenDir}/${nameSnake}`)) {
    fs.mkdirSync(`${screenDir}/${nameSnake}`);
  }

  var screenFile = `${screenDir}/${nameSnake}/${nameSnake}_page.dart`;

  if (fs.existsSync(screenFile)) {
    window.showWarningMessage(`File already exists: ${screenFile}`);
  } else {
    if (opts.statefulScreenPage) {
      // doGenerateBlocCode(projectName, rootDir, name, { withModel: true, commentCode: false });

      // fs.appendFileSync(screenFile, generateStatefulScreenPageCode(projectName, name));

      // updateBlocCode(`${libDir}/blocs/${nameSnake}/${nameSnake}_bloc.dart`, projectName, name);
      // updateEventCode(`${libDir}/blocs/${nameSnake}/${nameSnake}_event.dart`, projectName, name);
      // updateStateCode(`${libDir}/blocs/${nameSnake}/${nameSnake}_state.dart`, name);

      // // fs.appendFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_event.dart`, generateEventCode(projectName, name, opts));
      // // fs.appendFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_state.dart`, generateStateCode(projectName, name, opts));

      // // generate item widget
      // fs.appendFileSync(`${libDir}/widgets/${nameSnake}_item_view.dart`, generateWidgetCode(projectName, name));

      // // generate bloc code for create operation
      // generateBlocCodeForCreateOperation(`${libDir}/blocs`, projectName, name);

      // // generate add page
      // generateAddPage(`${libDir}/screens/${nameSnake}`, projectName, name);

      // // generate detail page
      // generateDetailPage(`${libDir}/screens/${nameSnake}`, projectName, name);

      // // generate bloc code for detail page
      // generateBlocCodeForDetailOperation(`${libDir}/blocs`, projectName, name);

    } else {
      // @TODO(robin): code here
    }
  }
}
