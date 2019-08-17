
import { window, workspace, ExtensionContext, commands, Uri, WorkspaceEdit, TextEdit } from 'vscode';
import { getRootDir, ProjectType, getFlutterInfo, FlutterInfo } from './util';
import { doGenerateBlocCode, BlocOpts } from './bloc';
import { Cmd } from './cmd';
import { openAndFormatFile } from './flutter_util';

var snakeCase = require('snake-case');
var camelCase = require('camel-case');
var pascalCase = require('pascal-case');

var fs = require('fs');

export enum PageKind {
  Basic,
  Detail,
  FormAdd,
  FormUpdate
}

export class GenPageOpts {
  kind: PageKind;
  constructor(kind: PageKind) {
    this.kind = kind;
  }
}

export async function generatePage(opts: GenPageOpts) {
  const flutter = getFlutterInfo();

  if (!flutter) {
    return;
  }

  // get component name
  const name = await window.showInputBox({
    value: '',
    valueSelection: [0, 11],
    placeHolder: 'Name, eg: Todo'
  }) || "";

  var libDir = `${flutter.projectDir}/lib`;
  var screenDir = `${libDir}/screens`;

  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir);
    if (!fs.existsSync(screenDir)) {
      fs.mkdirSync(screenDir);
    }
  }
  var nameSnake = snakeCase(name);

  var pageNameDir = nameSnake.split('_')[0];

  if (!fs.existsSync(`${screenDir}/${pageNameDir}`)) {
    fs.mkdirSync(`${screenDir}/${pageNameDir}`);
  }

  var pageFilePath = "";
  switch (opts.kind) {
    case PageKind.Detail:
      pageFilePath = `${screenDir}/${pageNameDir}/${nameSnake}_detail_page.dart`;
      break;
    case PageKind.Basic:
      pageFilePath = `${screenDir}/${pageNameDir}/${nameSnake}_page.dart`;
    case PageKind.FormAdd:
      pageFilePath = `${screenDir}/${pageNameDir}/${nameSnake}_add_page.dart`;
      break;
    case PageKind.FormUpdate:
      pageFilePath = `${screenDir}/${pageNameDir}/${nameSnake}_edit_page.dart`;
      break;
  }

  // var pageFile = `${screenDir}/${nameSnake}/${nameSnake}_page.dart`;
  // var pageFile = `${screenDir}/${nameSnake}_page.dart`;

  if (fs.existsSync(pageFilePath)) {
    window.showWarningMessage(`File already exists: ${pageFilePath}`);
  } else {
    switch (opts.kind) {
      case PageKind.Basic:
        fs.writeFileSync(pageFilePath, _genCodeBasic(name, flutter, opts));
        break;
      case PageKind.Detail:
        fs.writeFileSync(pageFilePath, await _genCodeDetail(name, flutter, opts));
        break;
      case PageKind.FormAdd:
        fs.writeFileSync(pageFilePath, await _genCodeAddForm(name, flutter, opts));
        break;
      case PageKind.FormUpdate:
        fs.writeFileSync(pageFilePath, await _genCodeUpdateForm(name, flutter, opts));
        break;
    }
    openAndFormatFile(pageFilePath);
  }
}

async function _genCodeDetail(name: String, flutter: FlutterInfo, opts: GenPageOpts) {
  const projectNameSnake = snakeCase(flutter.projectName);
  const nameSnake = snakeCase(name);
  const namePascal = pascalCase(name);

  const attrs = await window.showInputBox({
    value: '',
    valueSelection: [0, 11],
    placeHolder: 'Attributes to show, eg: name,active'
  }) || "";

  var attrsLines = [];

  for (let _att of attrs.split(',')) {
    let att = _att.trim();
    attrsLines.push(`DetailField("${pascalCase(att)}:", item.${camelCase(att)})`);
  }
  const rowsAdd = attrsLines.join(',\n                    ');

  var newLines = [];

  newLines.push(`
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';

class ${namePascal}DetailPage extends StatefulWidget {
  final ${namePascal} item;

  ${namePascal}DetailPage({Key key, @required this.item}) : super(key: key);

  _${namePascal}DetailPageState createState() => _${namePascal}DetailPageState(this.item);
}

class _${namePascal}DetailPageState extends State<${namePascal}DetailPage> {
  final ${namePascal} item;

  _${namePascal}DetailPageState(this.item);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(title: Text("${name} Detail"),),
        body: _getBody(context),
      );  
  }

  Widget _getBody(BuildContext context) {
    return Center(
      child: ListView(
        children: <Widget>[
          Padding(
              padding: const EdgeInsets.all(10.0),
              child: Column(
                children: <Widget>[
                  ${rowsAdd}
                ],
              )),
        ],
      ),
    );
  }
}
  `.trim());

  return newLines.join('\n');

}

function _genCodeAddForm(name: String, flutter: FlutterInfo, opts: GenPageOpts) {
  const projectNameSnake = snakeCase(flutter.projectName);
  const nameSnake = snakeCase(name);
  const namePascal = pascalCase(name);

  return `
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}/${nameSnake}_bloc.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}/${nameSnake}_event.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}/${nameSnake}_state.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';

class ${namePascal}AddPage extends StatefulWidget {
  ${namePascal}AddPage({Key key}) : super(key: key);

  @override
  State<${namePascal}AddPage> createState() => _${namePascal}State();
}

class _${namePascal}State extends State<${namePascal}AddPage> {
  final _nameController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final bloc = BlocProvider.of<${namePascal}Bloc>(context);

    _onAddButtonPressed() {
      bloc.dispatch(Create${namePascal}(_nameController.text));
    }

    return Scaffold(
      appBar: AppBar(title: Text("Add new ${namePascal}")),
      body: BlocListener<${namePascal}Bloc, ${namePascal}State>(
          listener: (context, state) {
        if (state is ${namePascal}Created) {
          Navigator.pop(context);
        } else if (state is ${namePascal}Failure) {
          Scaffold.of(context).showSnackBar(SnackBar(
            content: Text(
              state.error,
              style: TextStyle(color: Colors.white),
            ),
            backgroundColor: Colors.red,
            duration: Duration(seconds: 3),
          ));
        }
      }, child: BlocBuilder<${namePascal}Bloc, ${namePascal}State>(
        builder: (context, state) {
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
                          autofocus: true,
                          controller: _nameController,
                        ),
                        Row(
                          children: <Widget>[
                            RaisedButton(
                              onPressed: state is! ${namePascal}Loading
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
}


function _genCodeUpdateForm(name: String, flutter: FlutterInfo, opts: GenPageOpts) {
  const projectNameSnake = snakeCase(flutter.projectName);
  const nameSnake = snakeCase(name);
  const namePascal = pascalCase(name);
  const nameCamel = camelCase(name);

  return `
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}/${nameSnake}_bloc.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}/${nameSnake}_event.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}/${nameSnake}_state.dart';
import 'package:${projectNameSnake}_mobile/util/error_util.dart';

class ${namePascal}EditPage extends StatefulWidget {
  final ${namePascal}Bloc ${nameCamel}Bloc;

  ${namePascal}EditPage(this.${nameCamel}Bloc, {Key key}) : super(key: key);

  @override
  State<${namePascal}EditPage> createState() =>
      _${namePascal}EditState(${nameCamel}Bloc);
}

class _${namePascal}EditState extends State<${namePascal}EditPage> {
  final _field1Controller = TextEditingController();
  final _field2Controller = TextEditingController();
  final _field3Controller = TextEditingController();
  final ${namePascal}Bloc ${nameCamel}Bloc;
  bool _inProgress = false;
  StreamSubscription subs;
  BuildContext _context;

  _${namePascal}EditState(this.${nameCamel}Bloc) {
    subs = ${nameCamel}Bloc.state.listen((${namePascal}EditState state) {
      if (state is ${namePascal}Updated) {
        Navigator.pop(_context, true);
      } else if (state is ${namePascal}Failure) {
        Scaffold.of(_context).showSnackBar(
          SnackBar(
            content: Text(state.error),
            backgroundColor: Colors.red,
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    super.dispose();
    subs.cancel();
  }

  @override
  Widget build(BuildContext context) {
    disableApiErrorHandler();

    _onUpdateButtonPressed() {
      ${nameCamel}Bloc.dispatch(Update${namePascal}(_field1Controller.text,
          _field2Controller.text, _field3Controller.text));
    }

    return Scaffold(
        appBar: AppBar(title: Text("Update ${name}")),
        body: Builder(
          builder: (context) {
            _context = context;
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
                                InputDecoration(labelText: "Field 1:"),
                            autofocus: true,
                            controller: _field1Controller,
                          ),
                          TextFormField(
                            decoration:
                                InputDecoration(labelText: "Field 2:"),
                            controller: _field2Controller,
                          ),
                          TextFormField(
                            decoration: InputDecoration(
                                labelText: "Field 3:"),
                            controller: _field3Controller,
                          ),
                          Row(
                            children: <Widget>[
                              RaisedButton(
                                onPressed: !_inProgress
                                    ? _onUpdateButtonPressed
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
}
  
  
  `;
}

function _genCodeBasic(name: String, flutter: FlutterInfo, opts: GenPageOpts) {
  const nameSnake = snakeCase(name);
  const namePascal = pascalCase(name);

  return `
class ${namePascal}Page extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(title: Text("Add new ${namePascal}")),
        body: _getBody(context));
  }

  Widget _getBody(BuildContext context) {
    return Center(
      child: ListView(
        children: <Widget>[
          Padding(
              padding: const EdgeInsets.all(10.0),
              child: Form(
                  child: Column(
                children: <Widget>[
                  // @TODO(you): code here
                ],
              ))),
        ],
      ),
    );
  }
}
  
  `;
}
