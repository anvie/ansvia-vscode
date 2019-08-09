
import { window, workspace, ExtensionContext, commands } from 'vscode';
import { getRootDir, ProjectType, getFlutterInfo, FlutterInfo } from './util';
import { doGenerateBlocCode, BlocOpts } from './bloc';
import { Cmd } from './cmd';

var snakeCase = require('snake-case');
var camelCase = require('camel-case');
var pascalCase = require('pascal-case');

var fs = require('fs');
var yaml = require('js-yaml');

export enum WidgetKind {
  List,
  ListItem
}

export class GenWidgetOpts {
  bloc: boolean;
  kind: WidgetKind;
  constructor(bloc: boolean, kind: WidgetKind) {
    this.bloc = bloc;
    this.kind = kind;
  }
}

export async function generateWidget(opts: GenWidgetOpts) {
  const flutter = getFlutterInfo();

  if (!flutter) {
    return;
  }

  // get component name
  const name = await window.showInputBox({
    value: '',
    valueSelection: [0, 11],
    placeHolder: 'Widget list item name, eg: Todo'
  }) || "";

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
    case WidgetKind.List:
      widgetFilePath = `${widgetDir}/${widgetNameDir}/${nameSnake}_list.dart`;
      break;
    case WidgetKind.ListItem:
      widgetFilePath = `${widgetDir}/${widgetNameDir}/${nameSnake}_item_view.dart`;
      break;
    default:
      window.showErrorMessage("Unknown kind");
      return;
  }

  if (fs.existsSync(widgetFilePath)) {
    window.showWarningMessage(`File already exists: ${widgetFilePath}`);
  } else {
    switch (opts.kind) {
      case WidgetKind.List:
        fs.writeFileSync(widgetFilePath, _genCodeList(name, flutter, opts));
        break;
      case WidgetKind.ListItem:
        fs.writeFileSync(widgetFilePath, _genCodeListItem(name, flutter, opts));
        break;
    }
  }
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
                  TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
            subtitle: Column(
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Icon(Icons.person, color: Colors.grey),
                    Text("subtitle 1",
                        style: TextStyle(color: Colors.white))
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
                      MaterialPageRoute(builder: (context) => ${namePascal}DetailPage()))
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
  const nameSnake = snakeCase(name);
  const nameCamel = camelCase(name);
  const namePascal = pascalCase(name);

  var newLines = [];
  newLines.push(`import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter/material.dart';
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

    newLines.push(`
  /// List for ${name} widget
  class ${namePascal}List extends StatelessWidget {
  
    ${namePascal}List(BuildContext context) {}
  
    @override
    Widget build(BuildContext context) {
      return BlocBuilder<${namePascal}Bloc, ${namePascal}State>(
        builder: (context, state) {
          if (state is ${namePascal}ListLoading) {
            return LoadingIndicator(key: RactaKeys.loading);
          } else if (state is ${namePascal}ListLoaded) {
            final List<${namePascal}> ${nameCamel}s = state.${nameCamel}s;
            return ListView.builder(
              key: RactaKeys.todoList,
              itemCount: ${nameCamel}s.length,
              itemBuilder: (BuildContext context, int index) {
                final item = ${nameCamel}s[index];
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
    List<${namePascal}> ${nameCamel}s = [];

    return ListView.builder(
      // key: RactaKeys.${nameCamel}List,
      itemCount: ${nameCamel}s.length,
      itemBuilder: (BuildContext context, int index) {
        final item = ${nameCamel}s[index];
        return new ${namePascal}ItemView(item: item);
      },
    );
  }
}
    `.trim());
  }
  return newLines.join('\n');
}
