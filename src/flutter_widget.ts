
import { window, workspace, ExtensionContext, commands } from 'vscode';
import { getRootDir, ProjectType, getFlutterInfo, FlutterInfo, openAndFormatFile } from './util';
import { doGenerateBlocCode, BlocOpts } from './bloc';
import { Cmd } from './cmd';

var snakeCase = require('snake-case');
var camelCase = require('camel-case');
var pascalCase = require('pascal-case');

var fs = require('fs');
var yaml = require('js-yaml');

export enum WidgetKind {
  List = 1,
  ListItem = 2,
  DetailField = 3,
}

export class GenWidgetOpts {
  bloc: boolean;
  kind: WidgetKind;
  oneStep: boolean;
  stateful: boolean;
  constructor(bloc: boolean, kind: WidgetKind, oneStep: boolean = false, stateful: boolean = false) {
    this.bloc = bloc;
    this.kind = kind;
    this.oneStep = oneStep;
    this.stateful = stateful;
  }
}

export async function generateWidget(opts: GenWidgetOpts) {
  const flutter = getFlutterInfo();

  if (!flutter) {
    return;
  }

  // get component name
  const name = opts.oneStep === true ? "" : await window.showInputBox({
    value: '',
    valueSelection: [0, 11],
    placeHolder: 'Widget list item name, eg: Todo'
  }) || "";

  if (name === "") {
    window.showInformationMessage("No name");
    return;
  }

  var libDir = `${flutter.projectDir}/lib`;
  var widgetDir = `${libDir}/widgets`;

  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir);
    if (!fs.existsSync(widgetDir)) {
      fs.mkdirSync(widgetDir);
    }
  }
  var nameSnake = snakeCase(name);

  var widgetNameDir = nameSnake.split('_')[0];

  if (!fs.existsSync(`${widgetDir}/${widgetNameDir}`)) {
    fs.mkdirSync(`${widgetDir}/${widgetNameDir}`);
  }

  var widgetFilePath = "";

  switch (opts.kind) {
    case WidgetKind.List: {
      widgetFilePath = `${widgetDir}/${widgetNameDir}/${nameSnake}_list.dart`;
      break;
    }
    case WidgetKind.ListItem: {
      widgetFilePath = `${widgetDir}/${widgetNameDir}/${nameSnake}_item_view.dart`;
      break;
    }
    case WidgetKind.DetailField: {
      widgetFilePath = `${widgetDir}/${widgetNameDir}/detail_field.dart`;
      break;
    }
    default: {
      window.showErrorMessage("Unknown kind");
      return;
    }
  }

  if (fs.existsSync(widgetFilePath)) {
    window.showWarningMessage(`File already exists: ${widgetFilePath}`);
  } else {
    switch (opts.kind) {
      case WidgetKind.List: {
        fs.writeFileSync(widgetFilePath, _genCodeList(name, flutter, opts));
        openAndFormatFile(widgetFilePath);
        break;
      }
      case WidgetKind.ListItem: {
        fs.writeFileSync(widgetFilePath, _genCodeListItem(name, flutter, opts));
        openAndFormatFile(widgetFilePath);
        break;
      }
      case WidgetKind.DetailField: {
        fs.writeFileSync(widgetFilePath, _genCodeDetailField(name, flutter, opts));
        openAndFormatFile(widgetFilePath);
        break;
      }
    }
  }
}

function _genCodeDetailField(name: String, flutter: FlutterInfo, opts: GenWidgetOpts) {
  return `
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';

class DetailField extends StatelessWidget {
  final String theKey;
  final String value;

  const DetailField(this.theKey, this.value, {Key key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(this.theKey, style: TextStyle(fontSize: 15)),
      subtitle: Text(this.value, style: TextStyle(fontSize: 20)),
    );
  }
}
`.trim();
}

function _genCodeListItem(name: String, flutter: FlutterInfo, opts: GenWidgetOpts) {
  const projectNameSnake = snakeCase(flutter.projectName);
  const nameSnake = snakeCase(name);
  const nameCamel = camelCase(name);
  const namePascal = pascalCase(name);

  const code = `
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';
import 'package:${projectNameSnake}_mobile/screens/${nameSnake}/${nameSnake}_detail_page.dart';
import 'package:${projectNameSnake}_mobile/util/dialog.dart';

class ${namePascal}ItemView extends StatelessWidget {
  final ${namePascal} item;
  // final GestureTapCallback onTap;
  final bool editMode;
  // final Function(${namePascal}) onUpdated;

  ${namePascal}ItemView(
      {Key key, @required this.item, this.editMode})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
        elevation: 8.0,
        margin: new EdgeInsets.symmetric(horizontal: 10.0, vertical: 10.0),
        child: Container(
          // decoration: BoxDecoration(color: Color.fromRGBO(64, 75, 96, .9)),
          child: new ListTile(
            contentPadding:
                EdgeInsets.symmetric(horizontal: 20.0, vertical: 10.0),
            leading: editMode == true
                ? Container(
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
                        confirmDialog(context, "Delete ${name} \${item.name}",
                            onOk: () {
                          // @TODO(*): code here for delete operation
                          Navigator.pop(context);
                        });
                      },
                    ),
                  )
                : null,
            title: Text(
              item.name,
              style:
                  TextStyle(color: Colors.grey[800], fontWeight: FontWeight.bold),
            ),
            subtitle: Column(
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Icon(Icons.person, color: Colors.grey),
                    Text("subtitle 1",
                        style: TextStyle(color: Colors.grey[800]))
                  ],
                ),
                Container(
                  alignment: Alignment.topLeft,
                  child: Text("subtitle 2"),
                )
              ],
            ),
            onTap: () {
              Navigator.of(context)
                  .push(
                      MaterialPageRoute(builder: (context) => ${namePascal}DetailPage(item: item)))
                  .then((result) {
                // @TODO(*): code here after view item
                // this.onUpdated(result);
              });
            },
          ),
        ));
  }
}
  `;
  return code.trim();
}

function _genCodeList(name: String, flutter: FlutterInfo, opts: GenWidgetOpts) {
  const projectNameSnake = snakeCase(flutter.projectName);
  const projectNamePascal = pascalCase(flutter.projectName);
  const nameSnake = snakeCase(name);
  const nameCamel = camelCase(name);
  const namePascal = pascalCase(name);

  var newLines = [];
  newLines.push(`import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
`);

  if (opts.bloc) {
    newLines.push(`import 'package:flutter_bloc/flutter_bloc.dart';`);
  }

  newLines.push(`
import 'package:${projectNameSnake}_mobile/core/core.dart';
import 'package:${projectNameSnake}_mobile/widgets/widgets.dart';
import 'package:${projectNameSnake}_mobile/widgets/loading_indicator.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';
import 'package:${projectNameSnake}_mobile/widgets/${nameSnake}/${nameSnake}_item_view.dart';
`);

  if (opts.bloc) {

    if (opts.stateful) {
      newLines.push(`
/// List widget for ${namePascal}
class ${namePascal}List extends StatefulWidget {
  final BuildContext context;
  ${namePascal}List(this.context, {Key key}) : super(key: key);

  _${namePascal}ListState createState() => _${namePascal}ListState(context);
}

class _${namePascal}ListState extends State<${namePascal}List> {
  List<${namePascal}> items;

  _${namePascal}ListState(BuildContext context) {
    items = [];
  }
`);

    }else{
      newLines.push(`
/// List widget for ${name}
class ${namePascal}List extends StatelessWidget {

  ${namePascal}List(BuildContext context) {}

`);
    }

    if (opts.stateful){
      newLines.push(`
  @override
  Widget build(BuildContext context) {
    return BlocBuilder<${namePascal}Bloc, ${namePascal}State>(
      builder: (context, state) {
        if (state is ${namePascal}ListLoading) {
          if (${nameCamel}s.length == 0){
            return LoadingIndicator(key: ${projectNamePascal}Keys.loading);
          }
        } else if (state is ${namePascal}ListLoaded) {
          ${nameCamel}s = state.items;
        }
        return ListView.builder(
          key: ${projectNamePascal}Keys.${nameCamel}List,
          itemCount: ${nameCamel}s.length,
          itemBuilder: (BuildContext context, int index) {
            final item = ${nameCamel}s[index];
            return new ${namePascal}ItemView(item: item);
          });
        }
    );
  }
}
      `);
    }else{
      newLines.push(`
  @override
  Widget build(BuildContext context) {
      return BlocBuilder<${namePascal}Bloc, ${namePascal}State>(
      builder: (context, state) {
          if (state is ${namePascal}ListLoading) {
            return LoadingIndicator(key: ${projectNamePascal}Keys.loading);
          } else if (state is ${namePascal}ListLoaded) {
          final List<${namePascal}> items = state.items;
          return ListView.builder(
              key: ${projectNamePascal}Keys.${nameCamel}List,
              itemCount: items.length,
              itemBuilder: (BuildContext context, int index) {
              final item = items[index];
              return new ${namePascal}ItemView(item: item);
              },
          );
          } else {
          return Text("Unknown state");
          }
      },
      );
  }
}
      `);
    }

  }
  else {
    newLines.push(`
/// List for ${namePascal} widget
class ${namePascal}List extends StatefulWidget {
  final BuildContext context;
  ${namePascal}List(this.context, {Key key}) : super(key: key);

  _${namePascal}ListState createState() => _${namePascal}ListState(this.context);
}

class _${namePascal}ListState extends State<${namePascal}List> {
  final BuildContext context;

  _${namePascal}ListState(this.context);

  @override
  Widget build(BuildContext context) {
    // @TODO(*): code here
    List<${namePascal}> items = [];

    return ListView.builder(
      // key: ${projectNamePascal}Keys.${nameCamel}List,
      itemCount: items.length,
      itemBuilder: (BuildContext context, int index) {
        final item = items[index];
        return new ${namePascal}ItemView(item: item);
      },
    );
  }
}
    `.trim());
  }
  return newLines.join('\n');
}
