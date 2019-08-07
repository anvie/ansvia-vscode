
import { window, workspace } from 'vscode';
import { getRootDir } from './util';
import { doGenerateBlocCode, BlocOpts } from './bloc';

var snakeCase = require('snake-case');
var camelCase = require('camel-case');
var pascalCase = require('pascal-case');
var fs = require('fs');
var yaml = require('js-yaml');

export interface FlutterOpts {
  statefulScreenPage: boolean;
}

export async function generateFlutter(opts: FlutterOpts) {
  const rootDir = getRootDir();

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
    value: 'MyComponent',
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

      // generate task add page
      generateAddPage(`${libDir}/screens/${nameSnake}`, projectName, name, opts);
    } else {
      // @TODO(robin): code here
    }
  }
}

function generateAddPage(baseDir: String, projectName: String | undefined, name: String | undefined, opts: FlutterOpts){
  const projectNameSnake = snakeCase(projectName);
  const nameSnake = snakeCase(name);
  const namePascal = pascalCase(name);

  const code = `import 'package:flutter/material.dart';
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

function generateBlocCodeForCreateOperation(baseDir: String, projectName: String | undefined, name: String | undefined, opts: FlutterOpts) {
  const nameSnake = snakeCase(name);
  const projectNameSnake = snakeCase(projectName);
  const namePascal = pascalCase(name);

  const blocDir = `${baseDir}/${nameSnake}_add`;
  if (!fs.existsSync(blocDir)){
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
  const namePascal = pascalCase(name);

  return `
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:${snakeCase(projectName)}_mobile/blocs/${snakeCase(name)}/${snakeCase(name)}.dart';
import 'package:${snakeCase(projectName)}_mobile/core/core.dart';
import 'package:${snakeCase(projectName)}_mobile/models/${snakeCase(name)}.dart';
import 'package:${snakeCase(projectName)}_mobile/widgets/loading_indicator.dart';
import 'package:${snakeCase(projectName)}_mobile/widgets/${snakeCase(name)}_item_view.dart';

class ${namePascal}sPage extends StatefulWidget {
  @override
  State<StatefulWidget> createState() {
    return _${namePascal}sPage();
  }
}

class _${namePascal}sPage extends State<${namePascal}sPage> {
    bool _editMode = false;
    bool _blockingLoading = false;
    List<${namePascal}> _${snakeCase(name)}s;

    _${namePascal}sPage() {
      this._${snakeCase(name)}s = [];
    }

    @override
    Widget build(BuildContext context) {
    final ${snakeCase(name)}Bloc = BlocProvider.of<${namePascal}Bloc>(context);

    return Scaffold(
        appBar: AppBar(
        title: Text("${namePascal}s"),
        actions: <Widget>[
            IconButton(
            tooltip: "Edit ${snakeCase(name)}s list",
            key: ${pascalCase(projectName)}Keys.edit${namePascal}s,
            icon: Icon(Icons.edit),
            onPressed: () {
                // ${snakeCase(name)}Bloc.dispatch(TurnEditMode());
                setState(() {
                _editMode = !_editMode;
                });
            },
            )
        ],
        ),
        body: _${snakeCase(name)}ListView(context),
        floatingActionButton: FloatingActionButton(
          key: ${pascalCase(projectName)}Keys.add${namePascal},
          onPressed: () {
            Navigator.of(context)
                .push(MaterialPageRoute(
                    builder: (context) => BlocProvider(
                        builder: (context) => ${namePascal}AddBloc(),
                        child: ${namePascal}AddPage(
                          key: Key("__${camelCase(name)}AddPage__"),
                        ))))
                .then((result) {
              taskBloc.dispatch(Load${namePascal}List(forceFetch: true));
            });
          },
          child: Icon(Icons.add),
          tooltip: "Create new ${snakeCase(name)}",
        ),
    );
    }

    Widget _${snakeCase(name)}ListView(BuildContext context) {
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
          _${snakeCase(name)}s = _${snakeCase(name)}s.where((a) => a.id != state.${snakeCase(name)}Id).toList();
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

        // List<${namePascal}> ${snakeCase(name)}s = List();
        Widget body = Container();

        if (state is ${namePascal}Loading) {
          if (state.block) {
              this._blockingLoading = true;
          } else {
              return LoadingIndicator(key: ${pascalCase(projectName)}Keys.loading);
          }
        } else if (state is ${namePascal}ListLoaded) {
          _${snakeCase(name)}s = state.${snakeCase(name)}s;
        }

        if (this._${snakeCase(name)}s.length > 0) {
        body = ListView.builder(
            key: ${pascalCase(projectName)}Keys.${snakeCase(name)}List,
            itemCount: _${snakeCase(name)}s.length,
            itemBuilder: (BuildContext context, int index) {
            final item = _${snakeCase(name)}s[index];
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

  try {
    List<${namePascal}> ${nameSnake}s;

    List<dynamic> entries = [];

    if (!event.forceFetch) {
      // check from local first
      entries = _storage.getItem("entries");
    }

    if (entries == null || event.forceFetch) {
      final data =
          await PublicApi.get("/${nameSnake}/v1/list?offset=0&limit=20");
      print("data: $data");
      entries = data["result"]["entries"] as List;
    }

    this._storage.setItem("entries", entries);

    ${nameSnake}s = entries.map((p) => ${namePascal}.fromMap(p)).toList();

    yield ${namePascal}ListLoaded(${nameSnake}s);
  } catch (error) {
    yield ${namePascal}Failure(error: error.toString());
  }
}

Stream<${namePascal}State> _mapRemoveToState(Remove${namePascal} event) async* {
  yield ${namePascal}Loading(block: true);
  try {
    final data = await PublicApi.post(
        "/${nameSnake}/v1/delete", {"id": event.${nameSnake}.id});
    print("DELETE RESULT: \${data}");

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
          new_lines.push(`import 'package:${snakeCase(projectName)}_mobile/models/${nameSnake}.dart';`)
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
  var nameSnake = snakeCase(name);
  var namePascal = pascalCase(name);
  return `
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:${snakeCase(projectName)}_mobile/blocs/${nameSnake}/${nameSnake}.dart';
import 'package:${snakeCase(projectName)}_mobile/models/${nameSnake}.dart';
import 'package:${snakeCase(projectName)}_mobile/util/dialog.dart';

class ${namePascal}ItemView extends StatelessWidget {
  final ${namePascal} item;
  final GestureTapCallback onTap;
  final bool editMode;

  ${namePascal}ItemView(
      {Key key, @required this.item, @required this.onTap, this.editMode})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    ${namePascal}Bloc bloc = BlocProvider.of<${namePascal}Bloc>(context);

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
                    bloc.dispatch(Remove${namePascal}(this.item));
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
          ),
        ));
  }
}
  
  
`;
}
