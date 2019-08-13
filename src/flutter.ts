
import { window, workspace, ExtensionContext, commands } from 'vscode';
import { getRootDir, ProjectType } from './util';
import { doGenerateBlocCode, BlocOpts } from './bloc';
import { Cmd } from './cmd';
import { generatePage, GenPageOpts, PageKind } from './flutter_page';
import { generateWidget, GenWidgetOpts, WidgetKind } from './flutter_widget';
import { generateModel, GenModelOpts } from './flutter_model';
import { generateFragment, GenFragmentOpts, FragmentKind } from './flutter_fragment';
import { generateButton, GenButtonOpts, ButtonKind } from './flutter_button';
import * as flutterBloc from './flutter_bloc';

var snakeCase = require('snake-case');
var camelCase = require('camel-case');
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
      new Cmd("Generate new CRUD flow", () => generateFlutter({ statefulScreenPage: true })),
      new Cmd("Generate List Widget W1 (bloc mode, stateless)", () => generateWidget(new GenWidgetOpts(true, WidgetKind.List))),
      new Cmd("Generate List Widget W2 (bloc mode, stateful)", () => generateWidget(new GenWidgetOpts(true, WidgetKind.List, false, true))),
      new Cmd("Generate List Widget W3 (non bloc mode)", () => generateWidget(new GenWidgetOpts(false, WidgetKind.List))),
      new Cmd("Generate List Item Widget", () => generateWidget(new GenWidgetOpts(false, WidgetKind.ListItem))),
      new Cmd("Generate Detail Field Widget", () => generateWidget(new GenWidgetOpts(false, WidgetKind.DetailField, true))),
      new Cmd("Generate Model", () => generateModel(new GenModelOpts())),
      new Cmd("Add Model fields", () => generateFragment(new GenFragmentOpts(FragmentKind.ModelAddField))),
      new Cmd("Generate Basic Page", () => generatePage(new GenPageOpts(PageKind.Basic))),
      new Cmd("Generate Detail Page", () => generatePage(new GenPageOpts(PageKind.Detail))),
      new Cmd("Generate Form Add Page", () => generatePage(new GenPageOpts(PageKind.FormAdd))),
      new Cmd("Generate Autocompletable form field", () => generateFragment(new GenFragmentOpts(FragmentKind.FormAutocompleteField))),
      new Cmd("Generate Popup Menu Button", () => generateButton(new GenButtonOpts(ButtonKind.PopupMenu))),
      new Cmd("Generate BloC (+event, +state, +CRUD, +model)", () => flutterBloc.generateBloc(new flutterBloc.GenBlocOpts(flutterBloc.BlocKind.CRUDMethods, true, true, true, true, false))),
      new Cmd("Generate BloC (+event, +state, +CRUD, -model)", () => flutterBloc.generateBloc(new flutterBloc.GenBlocOpts(flutterBloc.BlocKind.CRUDMethods, true, true, true, false, false))),
      new Cmd("Generate BloC with LayeredRepo BLOC1 (+event, +state, +CRUD)", () => flutterBloc.generateBloc(new flutterBloc.GenBlocOpts(flutterBloc.BlocKind.CRUDMethods, true, true, true, false, true))),
      new Cmd("Generate BloC with LayeredRepo BLOC2 (+event, +state, +CRUD, +model)", () => flutterBloc.generateBloc(new flutterBloc.GenBlocOpts(flutterBloc.BlocKind.CRUDMethods, true, true, true, true, true))),
      new Cmd("Generate BloC with LayeredRepo BLOC3 (+event, +state, +CRUD, -model)", () => flutterBloc.generateBloc(new flutterBloc.GenBlocOpts(flutterBloc.BlocKind.CRUDMethods, true, true, true, false, true))),
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
      doGenerateBlocCode(projectName, rootDir, name, { withModel: true, commentCode: false });

      fs.appendFileSync(screenFile, generateStatefulScreenPageCode(projectName, name, opts));

      updateBlocCode(`${libDir}/blocs/${nameSnake}/${nameSnake}_bloc.dart`, projectName, name, opts);
      updateEventCode(`${libDir}/blocs/${nameSnake}/${nameSnake}_event.dart`, projectName, name, opts);
      updateStateCode(`${libDir}/blocs/${nameSnake}/${nameSnake}_state.dart`, projectName, name, opts);

      // fs.appendFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_event.dart`, generateEventCode(projectName, name, opts));
      // fs.appendFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_state.dart`, generateStateCode(projectName, name, opts));

      // generate item widget
      fs.appendFileSync(`${libDir}/widgets/${nameSnake}_item_view.dart`, generateWidgetCode(projectName, name, opts));

      // generate bloc code for create operation
      generateBlocCodeForCreateOperation(`${libDir}/blocs`, projectName, name, opts);

      // generate add page
      generateAddPage(`${libDir}/screens/${nameSnake}`, projectName, name, opts);

      // generate detail page
      generateDetailPage(`${libDir}/screens/${nameSnake}`, projectName, name, opts);

      // generate bloc code for detail page
      generateBlocCodeForDetailOperation(`${libDir}/blocs`, projectName, name, opts);

    } else {
      // @TODO(robin): code here
    }
  }
}

function generateDetailPage(baseDir: String, projectName: String | undefined, name: String | undefined, opts: FlutterOpts) {
  const projectNameSnake = snakeCase(projectName);
  const nameSnake = snakeCase(name);
  const namePascal = pascalCase(name);
  const nameCamel = camelCase(name);

  const code = `
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}_detail/${nameSnake}_detail.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';

class ${namePascal}DetailPage extends StatefulWidget {

  ${namePascal}DetailPage({Key key}) : super(key: key);

  @override
  State<${namePascal}DetailPage> createState() => _${namePascal}DetailState();
}

class _${namePascal}DetailState extends State<${namePascal}DetailPage> {
  ${namePascal} _${nameCamel} = null;
  bool _blockingLoading = false;

  final _nameController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    List<Widget> widgets = [];

    widgets.add(_buildBody(context));

    if (_blockingLoading) {
      widgets.add(_modalLoading());
    }

    final body = new Stack(
      children: widgets,
    );

    return Scaffold(
      appBar: AppBar(title: Text("${namePascal} Detail")),
      body: body,
    );
  }

  Widget _buildBody(BuildContext context) {
    final bloc = BlocProvider.of<${namePascal}DetailBloc>(context);

    _onEditButtonPressed() {
      ${namePascal} ${nameCamel} = this._${nameCamel}.copy(name: this._nameController.text);
      bloc.dispatch(${namePascal}Update(${nameCamel}));
    }

    return BlocListener<${namePascal}DetailBloc, ${namePascal}DetailState>(
        listener: (context, state) {
      if (state is ${namePascal}DetailFailure) {
        Scaffold.of(context).showSnackBar(SnackBar(
          content: Text(
            state.error,
            style: TextStyle(color: Colors.white),
          ),
          backgroundColor: Colors.red,
          duration: Duration(seconds: 3),
        ));
      }else if (state is ${namePascal}UpdateSuccess) {
        Navigator.pop(context, state.${nameCamel});
      }else if (state is ${namePascal}DetailLoading){
        if (state.block){
          this._blockingLoading = true;
        }
      }else if (state is ${namePascal}DetailLoaded){
        this._${nameCamel} = state.${nameCamel};
        _nameController.text = state.${nameCamel}.name;
      }
    }, child: BlocBuilder<${namePascal}DetailBloc, ${namePascal}DetailState>(
      builder: (context, state) {
        print("${nameCamel}_detail_page.state = $state");
        return Center(
          child: ListView(
            children: <Widget>[
              Padding(
                  padding: const EdgeInsets.all(10.0),
                  child: Form(
                      child: Column(
                    children: <Widget>[
                      TextFormField(
                        decoration: InputDecoration(labelText: "${namePascal} name"),
                        controller: _nameController,
                      ),
                      Row(
                        children: <Widget>[
                          RaisedButton(
                            onPressed: state is! ${namePascal}DetailLoading
                                ? _onEditButtonPressed
                                : null,
                            child: Text("UPDATE"),
                          )
                        ],
                      )
                    ],
                  ))),
            ],
          ),
        );
      },
    ));
  }

  Widget _modalLoading() {
    return new Stack(
      children: <Widget>[
        new Opacity(
          opacity: 0.3,
          child: const ModalBarrier(dismissible: false, color: Colors.grey),
        ),
        new Center(
          child: CircularProgressIndicator(),
        )
      ],
    );
  }
}
`;
  fs.writeFileSync(`${baseDir}/${nameSnake}_detail_page.dart`, code.trim());
}

function generateAddPage(baseDir: String, projectName: String | undefined, name: String | undefined, opts: FlutterOpts) {
  const projectNameSnake = snakeCase(projectName);
  const nameSnake = snakeCase(name);
  const namePascal = pascalCase(name);

  const code = `// Screen page implementation for ${name} detail.
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}_add/${nameSnake}_add.dart';

class ${namePascal}AddPage extends StatefulWidget {
  ${namePascal}AddPage({Key key}) : super(key: key);

  @override
  State<${namePascal}AddPage> createState() => _${namePascal}AddState();
}

class _${namePascal}AddState extends State<${namePascal}AddPage> {
  final _nameController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final bloc = BlocProvider.of<${namePascal}AddBloc>(context);

    _onAddButtonPressed() {
      bloc.dispatch(${namePascal}Add(_nameController.text));
    }

    return Scaffold(
      appBar: AppBar(title: Text("Add new ${namePascal}")),
      body: BlocListener<${namePascal}AddBloc, ${namePascal}AddState>(
          listener: (context, state) {
        if (state is ${namePascal}Created) {
          Navigator.pop(context);
        } else if (state is ${namePascal}AddFailure) {
          Scaffold.of(context).showSnackBar(SnackBar(
            content: Text(
              state.error,
              style: TextStyle(color: Colors.white),
            ),
            backgroundColor: Colors.red,
            duration: Duration(seconds: 3),
          ));
        }
      }, child: BlocBuilder<${namePascal}AddBloc, ${namePascal}AddState>(
        builder: (context, state) {
          print("${nameSnake}_add_page.state = $state");
          return Center(
            child: ListView(
              children: <Widget>[
                Padding(
                    padding: const EdgeInsets.all(10.0),
                    child: Form(
                        child: Column(
                      children: <Widget>[
                        TextFormField(
                          autofocus: true,
                          decoration:
                              InputDecoration(labelText: "${namePascal} name"),
                          controller: _nameController,
                        ),
                        Row(
                          children: <Widget>[
                            RaisedButton(
                              onPressed: state is! ${namePascal}AddLoading
                                  ? _onAddButtonPressed
                                  : null,
                              child: Text("Add"),
                            )
                          ],
                        )
                      ],
                    ))),
              ],
            ),
          );
        },
      )),
    );
  }
}
  `;
  fs.writeFileSync(`${baseDir}/${nameSnake}_add_page.dart`, code.trim());
}

function generateBlocCodeForDetailOperation(baseDir: String, projectName: String | undefined, name: String | undefined, opts: FlutterOpts) {
  const nameSnake = snakeCase(name);
  const projectNameSnake = snakeCase(projectName);
  const namePascal = pascalCase(name);
  const nameCamel = camelCase(name);

  const blocDir = `${baseDir}/${nameSnake}_detail`;
  if (!fs.existsSync(blocDir)) {
    fs.mkdirSync(blocDir);
  }

  const blocCode = `
import 'package:bloc/bloc.dart';
import 'package:localstorage/localstorage.dart';
import 'package:${projectNameSnake}_mobile/api/${projectNameSnake}_api.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}_detail/${nameSnake}_detail_event.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}_detail/${nameSnake}_detail_state.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';

class ${namePascal}DetailBloc extends Bloc<${namePascal}DetailEvent, ${namePascal}DetailState> {
  final LocalStorage _storage = new LocalStorage("bloc.${nameSnake}");

  ${namePascal}DetailBloc();

  @override
  ${namePascal}DetailState get initialState => ${namePascal}DetailLoading();

  @override
  Stream<${namePascal}DetailState> mapEventToState(${namePascal}DetailEvent event) async* {
    if (event is Load${namePascal}Detail) {
      yield* this._mapLoadToState(event);
    }else if (event is ${namePascal}Update){
      yield* this._mapUpdateToState(event);
    }
  }

  Stream<${namePascal}DetailState> _mapLoadToState(Load${namePascal}Detail event) async* {
    yield ${namePascal}DetailLoading(block: true);

    final data = await PublicApi.get("/${nameSnake}/v1/detail?id=\${event.${camelCase}Id}");
    if (data != null){
      print("data: $data");
      Map<String, dynamic> entry = data["result"] as Map;

      this._storage.setItem("detail", entry);

      yield ${namePascal}DetailLoaded(${namePascal}.fromMap(entry));
    }else{
      yield ${namePascal}DetailFailure(error: "Cannot get data from server");
    }
  }

  Stream<${namePascal}DetailState> _mapUpdateToState(${namePascal}Update event) async* {
    yield ${namePascal}DetailLoading(block: true);

    final data = await PublicApi.post("/${nameSnake}/v1/update", {
      "id": event.${nameCamel}.id,
      "name": event.${nameCamel}.name,
    });
    if (data != null){
      print("data: $data");
      Map<String, dynamic> entry = data["result"] as Map;

      this._storage.setItem("detail", entry);

      List<dynamic> entries = _storage.getItem("entries");

      // Update local data
      if (entries != null) {
        entries = entries.map((a) {
          if (a["id"] == event.${nameCamel}.id) {
            return event.${nameCamel}.toMap();
          } else {
            return a;
          }
        }).toList();
        _storage.setItem("entries", entries);
      }

      yield ${namePascal}UpdateSuccess(event.${nameCamel});
      yield ${namePascal}DetailLoaded(event.${nameCamel});
    }else{
      yield ${namePascal}DetailFailure(error: error.toString());
    }
  }
}
  
  
    `;
  fs.writeFileSync(`${baseDir}/${nameSnake}_detail/${nameSnake}_detail_bloc.dart`, blocCode.trim());

  const eventCode = `
import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';

@immutable
abstract class ${namePascal}DetailEvent extends Equatable {
  ${namePascal}DetailEvent([List props = const []]) : super(props);
}

class Load${namePascal}Detail extends ${namePascal}DetailEvent {
  final int ${nameCamel}Id;
  Load${namePascal}Detail(this.${nameCamel}Id): super([${nameCamel}Id]);

  @override
  String toString() => "Load${namePascal}Detail";
}

class ${namePascal}Update extends ${namePascal}DetailEvent {
  final ${namePascal} ${nameCamel};
  ${namePascal}Update(this.${nameCamel}): super([${nameCamel}]);
  @override
  String toString() => "${namePascal}Update";
}
  
  `;

  fs.writeFileSync(`${baseDir}/${nameSnake}_detail/${nameSnake}_detail_event.dart`, eventCode.trim());

  const stateCode = `

import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';

@immutable
abstract class ${namePascal}DetailState extends Equatable {
    ${namePascal}DetailState([List props = const []]) : super(props);
}

/// Loading state
class ${namePascal}DetailLoading extends ${namePascal}DetailState {
  /// Set true to block screen with blocking loading modal box.
  final bool block;
  ${namePascal}DetailLoading({this.block = false});
  @override
  String toString() => "${namePascal}DetailLoading";
}

class ${namePascal}DetailLoaded extends ${namePascal}DetailState {
  final ${namePascal} ${nameCamel};
  ${namePascal}DetailLoaded(this.${nameCamel});
  @override
  String toString() => "${namePascal}DetailLoaded";
}

class ${namePascal}UpdateSuccess extends ${namePascal}DetailState {
  final ${namePascal} ${nameCamel};
  ${namePascal}UpdateSuccess(this.${nameCamel});
  @override
  String toString() => "${namePascal}UpdateSuccess";
}

/// State when error/failure occurred
class ${namePascal}DetailFailure extends ${namePascal}DetailState {
    final String error;
    ${namePascal}DetailFailure({this.error}): super([error]);
    @override
    String toString() => "${namePascal}DetailFailure";
}      
  
  `;

  fs.writeFileSync(`${baseDir}/${nameSnake}_detail/${nameSnake}_detail_state.dart`, stateCode.trim());

  const modCode = `
export './${nameSnake}_detail_bloc.dart';
export './${nameSnake}_detail_event.dart';
export './${nameSnake}_detail_state.dart';

  `;

  fs.writeFileSync(`${baseDir}/${nameSnake}_detail/${nameSnake}_detail.dart`, modCode.trim());
}

function generateBlocCodeForCreateOperation(baseDir: String, projectName: String | undefined, name: String | undefined, opts: FlutterOpts) {
  const nameSnake = snakeCase(name);
  const projectNameSnake = snakeCase(projectName);
  const namePascal = pascalCase(name);

  const blocDir = `${baseDir}/${nameSnake}_add`;
  if (!fs.existsSync(blocDir)) {
    fs.mkdirSync(blocDir);
  }

  const blocCode = `
import 'package:bloc/bloc.dart';
import 'package:${projectNameSnake}_mobile/api/${projectNameSnake}_api.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}_add/${nameSnake}_add_event.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}_add/${nameSnake}_add_state.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';

class ${namePascal}AddBloc extends Bloc<${namePascal}AddEvent, ${namePascal}AddState> {
  ${namePascal}AddBloc();

  @override
  ${namePascal}AddState get initialState => ${namePascal}AddInitial();

  @override
  Stream<${namePascal}AddState> mapEventToState(${namePascal}AddEvent event) async* {
    if (event is ${namePascal}Add){
      yield* this._mapCreate${namePascal}ToState(event);
    }
  }

  Stream<${namePascal}AddState> _mapCreate${namePascal}ToState(${namePascal}Add event) async* {
    yield ${namePascal}AddLoading();

    try {
      final data = await PublicApi.post("/${nameSnake}/v1/add", {
        "name": event.name
      });
      print("resp data: \${data}");
      final new${namePascal} = ${namePascal}.fromMap(data["result"]);
      yield ${namePascal}Created(new${namePascal});
    } catch (error) {
      yield ${namePascal}AddFailure(error: error.toString());
    }
  }
}
  
    `;
  fs.writeFileSync(`${baseDir}/${nameSnake}_add/${nameSnake}_add_bloc.dart`, blocCode.trim());

  const eventCode = `
import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';

@immutable
abstract class ${namePascal}AddEvent extends Equatable {
  ${namePascal}AddEvent([List props = const []]) : super(props);
}

class ${namePascal}Add extends ${namePascal}AddEvent {
  final String name;

  ${namePascal}Add(this.name) : super([name]);

  @override
  String toString() => "${namePascal}Add";
}
  
  `;

  fs.writeFileSync(`${baseDir}/${nameSnake}_add/${nameSnake}_add_event.dart`, eventCode.trim());

  const stateCode = `
import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';

@immutable
abstract class ${namePascal}AddState extends Equatable {
  ${namePascal}AddState([List props = const []]) : super(props);
}

class ${namePascal}AddInitial extends ${namePascal}AddState {
  @override
  String toString() => "${namePascal}AddInitial";
}

class ${namePascal}AddLoading extends ${namePascal}AddState {
  @override
  String toString() => "${namePascal}AddLoading";
}

class ${namePascal}Created extends ${namePascal}AddState {
  final ${namePascal} ${nameSnake};

  ${namePascal}Created(this.${nameSnake}) : super([${nameSnake}]);

  @override
  String toString() => "${namePascal}Created";
}

class ${namePascal}AddFailure extends ${namePascal}AddState {
  final String error;
  ${namePascal}AddFailure({this.error}) : super([error]);
  @override
  String toString() => "${namePascal}AddFailure";
}
  `;

  fs.writeFileSync(`${baseDir}/${nameSnake}_add/${nameSnake}_add_state.dart`, stateCode.trim());

  const modCode = `
export './${nameSnake}_add_bloc.dart';
export './${nameSnake}_add_event.dart';
export './${nameSnake}_add_state.dart';

  `;

  fs.writeFileSync(`${baseDir}/${nameSnake}_add/${nameSnake}_add.dart`, modCode.trim());
}

function generateStatefulScreenPageCode(projectName: String | undefined, name: String | undefined, opts: FlutterOpts) {
  const nameProjectSnake = snakeCase(projectName);
  const nameProjectPascal = pascalCase(projectName);
  const namePascal = pascalCase(name);
  const nameCamel = camelCase(name);
  const nameSnake = snakeCase(name);

  return `
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:${nameProjectSnake}_mobile/blocs/${nameSnake}/${nameSnake}.dart';
import 'package:${nameProjectSnake}_mobile/blocs/${nameSnake}_add/${nameSnake}_add_bloc.dart';
import 'package:${nameProjectSnake}_mobile/core/core.dart';
import 'package:${nameProjectSnake}_mobile/models/${nameSnake}.dart';
import 'package:${nameProjectSnake}_mobile/screens/${nameSnake}/${nameSnake}_add_page.dart';
import 'package:${nameProjectSnake}_mobile/widgets/loading_indicator.dart';
import 'package:${nameProjectSnake}_mobile/widgets/${nameSnake}_item_view.dart';

class ${namePascal}sPage extends StatefulWidget {
  @override
  State<StatefulWidget> createState() {
    return _${namePascal}sPage();
  }
}

class _${namePascal}sPage extends State<${namePascal}sPage> {
    bool _editMode = false;
    bool _blockingLoading = false;
    List<${namePascal}> _${nameCamel}s;

    _${namePascal}sPage() {
      this._${nameCamel}s = [];
    }

    @override
    Widget build(BuildContext context) {
    final ${nameCamel}Bloc = BlocProvider.of<${namePascal}Bloc>(context);

    return Scaffold(
        appBar: AppBar(
        title: Text("${namePascal}s"),
        actions: <Widget>[
            IconButton(
            tooltip: "Edit ${nameSnake}s list",
            key: ${nameProjectPascal}Keys.edit${namePascal}s,
            icon: Icon(Icons.edit),
            onPressed: () {
                setState(() {
                _editMode = !_editMode;
                });
            },
            )
        ],
        ),
        body: _${nameCamel}ListView(context, ${nameCamel}Bloc),
        floatingActionButton: FloatingActionButton(
          key: ${nameProjectPascal}Keys.add${namePascal},
          onPressed: () {
            Navigator.of(context)
                .push(MaterialPageRoute(
                    builder: (context) => BlocProvider(
                        builder: (context) => ${namePascal}AddBloc(),
                        child: ${namePascal}AddPage(
                          key: Key("__${nameCamel}AddPage__"),
                        ))))
                .then((result) {
              ${nameCamel}Bloc.dispatch(Load${namePascal}List(forceFetch: true));
            });
          },
          child: Icon(Icons.add),
          tooltip: "Create new ${name}",
        ),
    );
    }

    Widget _${nameCamel}ListView(BuildContext context, ${namePascal}Bloc ${nameCamel}Bloc) {
    return BlocListener<${namePascal}Bloc, ${namePascal}State>(listener: (context, state) {
        if (state is ${namePascal}Failure) {
          Scaffold.of(context).showSnackBar(SnackBar(
              content: Text(
                state.error,
                style: TextStyle(color: Colors.white),
              ),
              backgroundColor: Colors.red,
              duration: Duration(seconds: 3),
          ));
          this._blockingLoading = false;
        } else if (state is ${namePascal}DeleteSuccess) {
          _${nameCamel}s = _${nameCamel}s.where((a) => a.id != state.${nameCamel}Id).toList();
          Scaffold.of(context).showSnackBar(SnackBar(
              content: Text(
              "${namePascal} deleted: \${state.name}",
              style: TextStyle(color: Colors.white),
              ),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 2),
          ));
          this._blockingLoading = false;
        }
    }, child: BlocBuilder<${namePascal}Bloc, ${namePascal}State>(
        builder: (BuildContext context, ${namePascal}State state) {
        print("${namePascal}sPage.state: $state");

        // List<${namePascal}> ${nameCamel}s = List();
        Widget body = Container();

        if (state is ${namePascal}Loading) {
          if (state.block) {
              this._blockingLoading = true;
          } else {
              return LoadingIndicator(key: ${nameProjectPascal}Keys.loading);
          }
        } else if (state is ${namePascal}ListLoaded) {
          _${nameCamel}s = state.${nameCamel}s;
        }

        if (this._${nameCamel}s.length > 0) {
        body = ListView.builder(
            key: ${nameProjectPascal}Keys.${nameCamel}List,
            itemCount: _${nameCamel}s.length,
            itemBuilder: (BuildContext context, int index) {
            final item = _${nameCamel}s[index];
            return ${namePascal}ItemView(
                item: item,
                onTap: () {
                showDialog(
                    context: context,
                    builder: (BuildContext context) {
                        return AlertDialog(
                        title: Text("Info"),
                        content: Text(item.name),
                        );
                    });
                },
                editMode: _editMode,
                onUpdated: (${namePascal} ${nameCamel}) {
                  if (${nameCamel} != null) {
                    print("onUpdated: \$${nameCamel}");
                    ${nameCamel}Bloc.dispatch(Update${namePascal}ListItem(${nameCamel}));
                    Scaffold.of(context).showSnackBar(SnackBar(
                      content: Text(
                        "${name} updated",
                        style: TextStyle(color: Colors.white),
                      ),
                      backgroundColor: Colors.green,
                      duration: Duration(seconds: 2),
                    ));
                  }
                },
            );
            },
        );
        }

        List<Widget> widgets = [];

        widgets.add(body);

        if (_blockingLoading) {
            widgets.add(_modalLoading());
        }

        return new Stack(
            children: widgets,
        );
    }));
    }

    Widget _modalLoading() {
    return new Stack(
        children: <Widget>[
        new Opacity(
            opacity: 0.3,
            child: const ModalBarrier(dismissible: false, color: Colors.grey),
        ),
        new Center(
            child: CircularProgressIndicator(),
        )
        ],
    );
    }
}
`;
}


function updateBlocCode(path: String, projectName: String | undefined, name: String | undefined, opts: FlutterOpts) {
  var nameSnake = snakeCase(name);
  var namePascal = pascalCase(name);
  var nameCamel = camelCase(name);

  var data = fs.readFileSync(path);
  var lines = data.toString().split(/\r?\n/);

  console.log("lines: ");
  console.log(lines);

  var new_lines = [];
  var header = true;
  var hasImport = false;

  const len = lines.length;

  // get last }
  var tgtIndex = 0;
  for (let [i, line] of lines.entries()) {
    console.log(`line: ${line}: ${i}, ${lines[(len - 2) - i]}`);
    if (lines[(len - 1) - i].trim() === '}') {
      tgtIndex = (len - 1) - i;
      break;
    }
  }


  const new_code = `
Stream<${namePascal}State> _mapLoadingToState(Load${namePascal}List event) async* {
  yield ${namePascal}Loading();


  List<${namePascal}> ${nameCamel}s;

  List<dynamic> entries = [];

  if (!event.forceFetch) {
    // check from local first
    entries = _storage.getItem("entries");
  }

  if (entries == null || event.forceFetch) {
    final data =
        await PublicApi.get("/${nameSnake}/v1/list?offset=0&limit=20");
    if (data != null){
      print("data: $data");
      entries = data["result"]["entries"] as List;
    }else{
      yield ${namePascal}Failure(error: error.toString());
    }
  }

  if (entries.length > 0){
    this._storage.setItem("entries", entries);
    ${nameCamel}s = entries.map((p) => ${namePascal}.fromMap(p)).toList();
    yield ${namePascal}ListLoaded(${nameCamel}s);
  }
}

Stream<${namePascal}State> _mapRemoveToState(Remove${namePascal} event) async* {
  yield ${namePascal}Loading(block: true);
  try {
    final data = await PublicApi.post(
        "/${nameSnake}/v1/delete", {"id": event.${nameSnake}.id});
    print("DELETE RESULT: \$data");

    List<dynamic> entries = _storage.getItem("entries");
    entries = entries.where((a) => a["id"] != event.${nameSnake}.id).toList();
    this._storage.setItem("entries", entries);

    yield ${namePascal}DeleteSuccess(event.${nameSnake}.id, event.${nameSnake}.name);
  } catch (e) {
    yield ${namePascal}Failure(error: e.toString());
  }
}`;

  for (let [i, line] of lines.entries()) {
    if (i === tgtIndex) {
      new_lines.push(new_code);
      new_lines.push('}');
    } else {
      new_lines.push(line);
    }
  }

  lines = new_lines;
  new_lines = [];
  var alreadyAdded = false;

  // inject 3 imports
  for (let [i, line] of lines.entries()) {
    if (line.startsWith("class") && !alreadyAdded) {
      new_lines.push(`import 'package:localstorage/localstorage.dart';
import 'package:${snakeCase(projectName)}_mobile/models/${nameSnake}.dart';
import 'package:${snakeCase(projectName)}_mobile/api/${snakeCase(projectName)}_api.dart';
`);
      new_lines.push(line);
      new_lines.push(`  final LocalStorage _storage = new LocalStorage("bloc.${nameSnake}");`);
      alreadyAdded = true;
      continue;
    } else if (line.trim() === "// yield* xxx") {
      new_lines.push(`
    if (event is Load${namePascal}List) {
      yield* this._mapLoadingToState(event);
    } else if (event is Remove${namePascal}) {
      yield* this._mapRemoveToState(event);
    }`);
    } else {
      new_lines.push(line);
    }
  }

  fs.writeFileSync(path, new_lines.join('\n'));
}


function updateEventCode(path: String, projectName: String | undefined, name: String | undefined, opts: FlutterOpts) {
  var nameSnake = snakeCase(name);
  var namePascal = pascalCase(name);

  var data = fs.readFileSync(path);
  var lines = data.toString().split(/\r?\n/);

  var new_lines = [];
  var header = true;
  var hasImport = false;

  for (let line of lines) {
    // console.log(line);
    if (header) {
      if (line.startsWith("import")) {
        hasImport = true;
        new_lines.push(line);
        continue;
      } else {
        if (hasImport) {
          new_lines.push(`import 'package:${snakeCase(projectName)}_mobile/models/${nameSnake}.dart';`);
          header = false;
          continue;
        }
      }
    }
    // add anything after
    new_lines.push(line);
  }

  const new_event = `

/// Event to load data ${namePascal} from local storage/remote API.
class Load${namePascal}List extends ${namePascal}Event {
  /// Set true to force fetch data from server
  final bool forceFetch;

  Load${namePascal}List({this.forceFetch: false}) : super([forceFetch]);

  @override
  String toString() => "Load${namePascal}List";
}

/// Update ${namePascal} list
class Update${namePascal}ListItem extends ${namePascal}Event {
  final ${namePascal} item;
  Update${namePascal}ListItem(this.item);
  @override
  String toString() => "Update${namePascal}ListItem";
}

/// Event when removing ${namePascal} data
class Remove${namePascal} extends ${namePascal}Event {
  final ${namePascal} ${nameSnake};
  Remove${namePascal}(this.${nameSnake});
  @override
  String toString() => "Remove${namePascal}";
}

`;
  new_lines.push(new_event);
  fs.writeFileSync(path, new_lines.join('\n'));
}


function updateStateCode(path: String, projectName: String | undefined, name: String | undefined, opts: FlutterOpts) {
  var nameSnake = snakeCase(name);
  var namePascal = pascalCase(name);
  const newCode = `

/// State when deletion of ${namePascal} success.
class ${namePascal}DeleteSuccess extends ${namePascal}State {
  final int ${camelCase(name)}Id;
  final String name;
  ${namePascal}DeleteSuccess(this.${camelCase(name)}Id, this.name);
  @override
  String toString() => "${namePascal}DeleteSuccess";
}
`;

  fs.appendFileSync(path, newCode);
}

function generateWidgetCode(projectName: String | undefined, name: String | undefined, opts: FlutterOpts) {
  const projectNameSnake = snakeCase(projectName);
  var nameSnake = snakeCase(name);
  var namePascal = pascalCase(name);
  var nameCamel = camelCase(name);
  return `
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}/${nameSnake}.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';
import 'package:${projectNameSnake}_mobile/util/dialog.dart';
import 'package:${projectNameSnake}_mobile/screens/${nameSnake}/${nameSnake}_detail_page.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}_detail/${nameSnake}_detail_bloc.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}_detail/${nameSnake}_detail_event.dart';

class ${namePascal}ItemView extends StatelessWidget {
  final ${namePascal} item;
  final GestureTapCallback onTap;
  final bool editMode;
  final Function(${namePascal}) onUpdated;

  ${namePascal}ItemView(
      {Key key, @required this.item, @required this.onTap, this.editMode, @required this.onUpdated})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    ${namePascal}Bloc ${nameCamel}Bloc = BlocProvider.of<${namePascal}Bloc>(context);

    return Card(
        elevation: 8.0,
        margin: new EdgeInsets.symmetric(horizontal: 10.0, vertical: 10.0),
        child: Container(
          // decoration: BoxDecoration(color: Color.fromRGBO(64, 75, 96, .9)),
          child: new ListTile(
            contentPadding:
                EdgeInsets.symmetric(horizontal: 20.0, vertical: 10.0),
            leading: editMode==true ? Container(
              padding: EdgeInsets.only(right: 12.0),
              // decoration: new BoxDecoration(
              //     border: new Border(
              //         right:
              //             new BorderSide(width: 1.0, color: Colors.white24))),
              child: IconButton(
                icon: Icon(
                  Icons.cancel,
                  color: Colors.red,
                ),
                onPressed: () {
                  confirmDialog(context, "Delete ${nameSnake} \${item.name}", onOk: (){
                    ${nameCamel}Bloc.dispatch(Remove${namePascal}(this.item));
                    Navigator.pop(context);
                  });
                },
              ),
            ) : null,
            title: Text(
              item.name,
              style:
                  TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
            subtitle: Column(
              children: <Widget>[
                // Row(
                //   children: <Widget>[
                //     Icon(Icons.person, color: Colors.yellowAccent),
                //     Text(item.code, style: TextStyle(color: Colors.white))
                //   ],
                // ),
                // Container(
                //   alignment: Alignment.topLeft,
                //   child: Text("Grade: \${item.grade.toString()}"),
                // )
              ],
            ),
            onTap: () {
              Navigator.of(context)
                  .push(MaterialPageRoute(
                      builder: (context) => BlocProvider(
                          builder: (context) => ${namePascal}DetailBloc()
                            ..dispatch(Load${namePascal}Detail(item.id)),
                          child:
                              ${namePascal}DetailPage(key: Key("__${nameCamel}DetailPage__")))))
                  .then((result) {
                this.onUpdated(result);
                ${nameCamel}Bloc.dispatch(LoadProjectStepList(forceFetch: false));
              });
            }
          ),
        ));
  }
}
  
  
`;
}
