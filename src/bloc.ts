
import { window, workspace } from 'vscode';
import { getRootDir, ProjectType } from './util';
var snakeCase = require('snake-case');
var camelCase = require('camel-case');
var pascalCase = require('pascal-case');
var fs = require('fs');
var yaml = require('js-yaml');

export interface BlocOpts {
  withModel: boolean;
  commentCode: boolean;
}

export async function generateBloc(opts: BlocOpts) {
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
    value: 'MyComponent',
    valueSelection: [0, 11],
    placeHolder: 'BloC name, example: TodoBloc'
  }) || "unknown";

  doGenerateBlocCode(projectName, rootDir, name, opts);
}

export function doGenerateBlocCode(projectName: String, rootDir: String, name: String, opts: BlocOpts) {

  var libDir = rootDir + '/lib';
  console.log(libDir);
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir);
    fs.mkdirSync(`${libDir}/blocs`);
  }
  var nameSnake = snakeCase(name);
  if (!fs.existsSync(`${libDir}/blocs/${nameSnake}`)) {
    fs.mkdirSync(`${libDir}/blocs/${nameSnake}`);
  }
  if (fs.existsSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_bloc.dart`)) {
    window.showWarningMessage(`File already exists: ${nameSnake}_bloc.dart`);
  } else {
    fs.writeFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_bloc.dart`, generateBlocCode(projectName, name, opts));
    fs.writeFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_event.dart`, generateEventCode(projectName, name, opts));
    fs.writeFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_state.dart`, generateStateCode(projectName, name, opts));
    fs.writeFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}.dart`, `export './${nameSnake}_bloc.dart';\n`);
    fs.appendFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}.dart`, `export './${nameSnake}_event.dart';\n`);
    fs.appendFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}.dart`, `export './${nameSnake}_state.dart';\n`);

    if (opts.withModel) {
      // Generate models
      const path = `${libDir}/models/${nameSnake}.dart`;
      if (!fs.existsSync(path)) {
        fs.writeFileSync(path, generateModelCode(projectName, name, opts));
      } else {
        opts.commentCode = true;
        fs.appendFileSync(path, generateModelCode(projectName, name, opts));
      }
    }
  }
}

function generateModelCode(projectName: String | undefined, name: String | undefined, opts: BlocOpts) {
  const namePascal = pascalCase(name);
  var code = `
import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';

/// Model for ${name}
@immutable
class ${namePascal} extends Equatable {
  final int id;
  final String name;

  ${namePascal}(this.id, this.name): super([id, name]);

  /// Generate Map<String, dynamic> representation for this model.
  Map<String,dynamic> toMap(){
    Map<String,dynamic> data = Map();
    data['id'] = this.id;
    data['name'] = this.name;
    return data;
  }

  /// Create ${namePascal} instance from Map<String, dynamic> object.
  static ${namePascal} fromMap(Map<String, dynamic> data){
    return ${namePascal}(data['id'], data['name']);
  }

  /// Clone this object with same id
  ${namePascal} copy({String name}) {
    return ${namePascal}(this.id, name ?? this.name);
  }
}
`;
  var newLines = [];
  if (opts.commentCode) {
    newLines.push("// These code bellow are auto-generated, please review and update as you wish");
  }
  for (let line of code.split(/\r?\n/)) {
    if (opts.commentCode) {
      newLines.push("// " + line);
    } else {
      newLines.push(line);
    }
  }

  return newLines.join('\n');
}

function generateBlocCode(projectName: String | undefined, name: String | undefined, opts: BlocOpts) {
  var nameSnake = snakeCase(name);
  var namePascal = pascalCase(name);
  return `
import 'package:bloc/bloc.dart';
import 'package:${snakeCase(projectName)}_mobile/blocs/${nameSnake}/${nameSnake}_event.dart';
import 'package:${snakeCase(projectName)}_mobile/blocs/${nameSnake}/${nameSnake}_state.dart';

class ${namePascal}Bloc extends Bloc<${namePascal}Event, ${namePascal}State> {
    ${namePascal}Bloc();
    
    @override
    ${namePascal}State get initialState => ${namePascal}Loading();
    
    @override
    Stream<${namePascal}State> mapEventToState(${namePascal}Event event) async* {
        // yield* xxx
    }
}`;
}


function generateEventCode(projectName: String | undefined, name: String | undefined, opts: BlocOpts) {
  var nameSnake = snakeCase(name);
  var namePascal = pascalCase(name);
  return `
import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';

@immutable
abstract class ${namePascal}Event extends Equatable {
    ${namePascal}Event([List props = const []]) : super(props);
}

class Load${namePascal} extends ${namePascal}Event {
    Load${namePascal}();

    @override
    String toString() => "Load${namePascal}";
}
`;
}


function generateStateCode(projectName: String | undefined, name: String | undefined, opts: BlocOpts) {
  var nameSnake = snakeCase(name);
  var namePascal = pascalCase(name);
  var rv = `
import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
`;

  if (opts.withModel) {
    rv = rv + `import 'package:${snakeCase(projectName)}_mobile/models/${nameSnake}.dart';
`;
  }

  rv = rv +
    `@immutable
abstract class ${namePascal}State extends Equatable {
    ${namePascal}State([List props = const []]) : super(props);
}

/// Loading state
class ${namePascal}Loading extends ${namePascal}State {
  /// Set true to block screen with blocking loading modal box.
  final bool block;
  ${namePascal}Loading({this.block = false});
  @override
  String toString() => "${namePascal}Loading";
}
`;

  if (opts.withModel) {
    rv = rv + `class ${namePascal}ListLoaded extends ${namePascal}State {
    final List<${namePascal}> ${nameSnake}s;

    ${namePascal}ListLoaded(this.${nameSnake}s) : super([${nameSnake}s]);

    @override
    String toString() => "${namePascal}ListLoaded";
}
`;
  }

  rv = rv + `
/// State when error/failure occurred
class ${namePascal}Failure extends ${namePascal}State {
    final String error;
    ${namePascal}Failure({this.error}): super([error]);
    @override
    String toString() => "${namePascal}Failure";
}      
`;

  return rv;
}
