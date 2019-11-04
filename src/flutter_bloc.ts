
import { window } from 'vscode';
import { getFlutterInfo, FlutterInfo } from './util';
import * as flutterModelGen from './flutter_model';

var snakeCase = require('snake-case');
var camelCase = require('camel-case');
var pascalCase = require('pascal-case');

var fs = require('fs');

export enum BlocKind {
  CRUDMethods = 1,
}

export class GenBlocOpts {
  kind: BlocKind;
  withEvent: boolean;
  withState: boolean;
  withCRUD: boolean;
  withModel: boolean;
  withSmartRepo: boolean;
  constructor(kind: BlocKind, withEvent: boolean = false, withState: boolean = false,
    withCRUD: boolean = false, withModel: boolean = false, withSmartRepo: boolean = false) {
    this.kind = kind;
    this.withEvent = withEvent;
    this.withState = withState;
    this.withCRUD = withCRUD;
    this.withModel = withModel;
    this.withSmartRepo = withSmartRepo;
  }
}

export async function generateBloc(opts: GenBlocOpts) {
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

  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir);
  }

  doGenerate(name, flutter, opts);
}

export async function doGenerate(name: String, flutter: FlutterInfo, opts: GenBlocOpts) {
  var libDir = `${flutter.projectDir}/lib`;
  var nameSnake = snakeCase(name);

  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir);
    fs.mkdirSync(`${libDir}/blocs`);
  }

  if (!fs.existsSync(`${libDir}/blocs/${nameSnake}`)) {
    fs.mkdirSync(`${libDir}/blocs/${nameSnake}`);
  }

  if (fs.existsSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_bloc.dart`)) {
    window.showWarningMessage(`File already exists: ${nameSnake}_bloc.dart`);
  } else {
    fs.writeFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_bloc.dart`, generateBlocCode(name, flutter, opts));
    fs.appendFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}.dart`, `export './${nameSnake}_bloc.dart';\n`);

    if (opts.withEvent) {
      fs.writeFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_event.dart`, generateEventCode(name, flutter, opts));
      fs.appendFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}.dart`, `export './${nameSnake}_event.dart';\n`);
    }

    if (opts.withState) {
      fs.writeFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_state.dart`, generateStateCode(name, flutter, opts));
      fs.appendFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}.dart`, `export './${nameSnake}_state.dart';\n`);
    }

    if (opts.withModel) {
      // Generate models
      const path = `${libDir}/models/${nameSnake}.dart`;
      if (!fs.existsSync(path)) {
        var fieldsStr = await window.showInputBox({
          value: '',
          valueSelection: [0, 11],
          placeHolder: 'Model fields, eg: name:z,age:i,keywords:z[]'
        }) || "";
        fieldsStr = fieldsStr.split(',').map((a) => a.trim()).filter((a) => a.length > 0).join(',');
        fs.writeFileSync(path, generateModelCode(name, fieldsStr, flutter, opts));
      } else {
        window.showWarningMessage(`Cannot generate model, model file ${path} already exists`);
      }
    }
  }
}

function generateModelCode(name: String, fieldsStr: String, flutter: FlutterInfo, opts: GenBlocOpts) {
  var modelOpts = new flutterModelGen.GenModelOpts();
  modelOpts.fields = fieldsStr.split(',');
  return flutterModelGen.genCode(name, flutter, modelOpts);
}

function generateEventCode(name: String | undefined, flutter: FlutterInfo, opts: GenBlocOpts) {
  var projectNameSnaake = snakeCase(flutter.projectName);
  var nameSnake = snakeCase(name);
  var namePascal = pascalCase(name);
  var nameCamel = camelCase(name);

  var newLines = [];

  newLines.push(`
import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import 'package:${projectNameSnaake}_mobile/models/${nameSnake}.dart';

@immutable
abstract class ${namePascal}Event extends Equatable {
  ${namePascal}Event([List props = const []]) : super(props);
}

class Load${namePascal} extends ${namePascal}Event {
  final bool force;
  Load${namePascal}({this.force=false});

  @override
  String toString() => "Load${namePascal}";
}

class Create${namePascal} extends ${namePascal}Event {
  final int id;
  final String text;
  Create${namePascal}(this.id, this.text);
  @override
  String toString() => "Create${namePascal}";
}

/// Event to delete ${name}
class Delete${namePascal} extends ${namePascal}Event {
  final ${namePascal} ${nameCamel};
  Delete${namePascal}(this.${nameCamel});
  @override
  String toString() => "Delete${namePascal}";
}
  
`);
  return newLines.join('\n');
}

function generateStateCode(name: String | undefined, flutter: FlutterInfo, opts: GenBlocOpts) {
  const projectNameSnake = snakeCase(flutter.projectName);
  var nameSnake = snakeCase(name);
  var nameCamel = camelCase(name);
  var namePascal = pascalCase(name);

  var newLines = [];

  newLines.push(`
import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';

@immutable
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

class ${namePascal}ListLoading extends ${namePascal}State {
  @override
  String toString() => "${namePascal}ListLoading";
}

class ${namePascal}ListLoaded extends ${namePascal}State {
  final List<${namePascal}> items;
  ${namePascal}ListLoaded(this.items);
  @override
  String toString() => "${namePascal}ListLoaded";
}

/// State when error/failure occurred
class ${namePascal}Failure extends ${namePascal}State {
  final String error;
  ${namePascal}Failure({this.error}) : super([error]);
  @override
  String toString() => "${namePascal}Failure";
}

class ${namePascal}Created extends ${namePascal}State {
  final ${namePascal} item;
  ${namePascal}Created(this.item);
  @override
  String toString() => "${namePascal}Created";
}

/// State when ${name} already deleted
class ${namePascal}Deleted extends ${namePascal}State {
  final ${namePascal} ${nameCamel};
  ${namePascal}Deleted(this.${nameCamel});
  @override
  String toString() => "${namePascal}Deleted";
}
`);
  return newLines.join('\n');
}

function generateBlocCode(name: String | undefined, flutter: FlutterInfo, opts: GenBlocOpts) {
  const projectNameSnake = snakeCase(flutter.projectName);
  var nameSnake = snakeCase(name);
  var nameCamel = camelCase(name);
  var namePascal = pascalCase(name);

  var newLines = [];

  const importsStr = `
import 'package:bloc/bloc.dart';
import 'package:${projectNameSnake}_mobile/api/${projectNameSnake}_api.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}/${nameSnake}_event.dart';
import 'package:${projectNameSnake}_mobile/blocs/${nameSnake}/${nameSnake}_state.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';
  `;

  if (opts.withSmartRepo) {
    newLines.push(`import 'package:${projectNameSnake}_mobile/core/smart_repo.dart';`);
  }

  const classHeadStr = `
class ${namePascal}Bloc extends Bloc<${namePascal}Event, ${namePascal}State> {
  PersistentSmartRepo repo;

  ${namePascal}Bloc() {
    repo = PersistentSmartRepo("bloc_${nameSnake}");
  }

  @override
  ${namePascal}State get initialState => ${namePascal}Loading();

  @override
  Stream<${namePascal}State> mapEventToState(${namePascal}Event event) async* {
`;

  newLines.push(importsStr);
  newLines.push(classHeadStr);

  if (opts.withCRUD) {
    newLines.push(`
    if (event is Load${namePascal}) {
      yield* _mapLoad${namePascal}ToState(event);
    } else if (event is Create${namePascal}) {
      yield* _mapCreate${namePascal}ToState(event);
    } else if (event is Delete${namePascal}) {
      yield* _mapDeleteToState(event);
    }
    `);
  }
  newLines.push('  }');

  if (opts.withCRUD) {
    newLines.push(`
  Stream<${namePascal}State> _mapLoad${namePascal}ToState(Load${namePascal} event) async* {
    yield ${namePascal}ListLoading();`);

    if (opts.withSmartRepo) {
      newLines.push(`
    final data = await repo.fetchApi(
      "entries", "/${nameSnake}/v1/list?offset=0&limit=10",
      force: event.force);
`);
    } else {
      newLines.push(`
    final data = await PublicApi.get("/${nameSnake}/v1/list?offset=0&limit=10");
`);
    }

    newLines.push(`
    if (data != null) {
      yield ${namePascal}ListLoaded((data["result"]["entries"] as List<dynamic>)
          .map((a) => ${namePascal}.fromMap(a))
          .toList());
    } else {
      yield ${namePascal}Failure(error: "Cannot get ${nameSnake} data from server");
    }
  }
`);

    newLines.push(`
  Stream<${namePascal}State> _mapCreate${namePascal}ToState(Create${namePascal} event) async* {
    yield ${namePascal}Loading();

    final data = await PublicApi.post(
        "/${nameSnake}/v1/add", {
          // @TODO(you): add params to post here
        });

    if (data != null) {
      print("resp data: $data");

      repo.updateEntriesItem("entries", data["result"]);

      yield ${namePascal}Created(${namePascal}.fromMap(data["result"]));

      dispatch(Load${namePascal}());
    } else {
      yield ${namePascal}Failure(error: "Cannot add ${name}");
    }
  }
`);

    newLines.push(`
  Stream<${namePascal}State> _mapDeleteToState(Delete${namePascal} event) async* {
    yield ${namePascal}Loading();

    final data =
        await PublicApi.post("/${nameSnake}/v1/delete", {"id": event.${nameCamel}.id});

    if (data != null) {
      await repo.deleteEntriesItem("entries", event.${nameCamel}.toMap());

      yield ${namePascal}Deleted(event.${nameCamel});
      dispatch(Load${namePascal}(force: false));
    } else {
      yield ${namePascal}Failure(error: "Cannot delete ${name}");
    }
  }
    `);
  }
  newLines.push('}');

  return newLines.join('\n');
}


// export function doGenerateBlocCode(projectName: String, rootDir: String, name: String, opts: BlocOpts) {

//   var libDir = rootDir + '/lib';
//   console.log(libDir);
//   if (!fs.existsSync(libDir)) {
//     fs.mkdirSync(libDir);
//     fs.mkdirSync(`${libDir}/blocs`);
//   }
//   var nameSnake = snakeCase(name);
//   if (!fs.existsSync(`${libDir}/blocs/${nameSnake}`)) {
//     fs.mkdirSync(`${libDir}/blocs/${nameSnake}`);
//   }
//   if (fs.existsSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_bloc.dart`)) {
//     window.showWarningMessage(`File already exists: ${nameSnake}_bloc.dart`);
//   } else {
//     fs.writeFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_bloc.dart`, generateBlocCode(projectName, name));
//     fs.writeFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_event.dart`, generateEventCode(name));
//     fs.writeFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}_state.dart`, generateStateCode(projectName, name, opts));
//     fs.writeFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}.dart`, `export './${nameSnake}_bloc.dart';\n`);
//     fs.appendFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}.dart`, `export './${nameSnake}_event.dart';\n`);
//     fs.appendFileSync(`${libDir}/blocs/${nameSnake}/${nameSnake}.dart`, `export './${nameSnake}_state.dart';\n`);

//     if (opts.withModel) {
//       // Generate models
//       const path = `${libDir}/models/${nameSnake}.dart`;
//       if (!fs.existsSync(path)) {
//         fs.writeFileSync(path, generateModelCode(name, opts));
//       } else {
//         opts.commentCode = true;
//         fs.appendFileSync(path, generateModelCode(name, opts));
//       }
//     }
//   }
// }

// function generateModelCode(name: String | undefined, opts: BlocOpts) {
//   const namePascal = pascalCase(name);
//   var code = `
// import 'package:equatable/equatable.dart';
// import 'package:meta/meta.dart';

// /// Model for ${name}
// @immutable
// class ${namePascal} extends Equatable {
//   final int id;
//   final String name;

//   ${namePascal}(this.id, this.name): super([id, name]);

//   /// Generate Map<String, dynamic> representation for this model.
//   Map<String,dynamic> toMap(){
//     Map<String,dynamic> data = Map();
//     data['id'] = this.id;
//     data['name'] = this.name;
//     return data;
//   }

//   /// Create ${namePascal} instance from Map<String, dynamic> object.
//   static ${namePascal} fromMap(Map<String, dynamic> data){
//     return ${namePascal}(data['id'], data['name']);
//   }

//   /// Clone this object with same id
//   ${namePascal} copy({String name}) {
//     return ${namePascal}(this.id, name ?? this.name);
//   }
// }
// `;
//   var newLines = [];
//   if (opts.commentCode) {
//     newLines.push("// These code bellow are auto-generated, please review and update as you wish");
//   }
//   for (let line of code.split(/\r?\n/)) {
//     if (opts.commentCode) {
//       newLines.push("// " + line);
//     } else {
//       newLines.push(line);
//     }
//   }

//   return newLines.join('\n');
// }

// function generateBlocCode(projectName: String | undefined, name: String | undefined) {
//   var nameSnake = snakeCase(name);
//   var namePascal = pascalCase(name);
//   return `
// import 'package:bloc/bloc.dart';
// import 'package:${snakeCase(projectName)}_mobile/blocs/${nameSnake}/${nameSnake}_event.dart';
// import 'package:${snakeCase(projectName)}_mobile/blocs/${nameSnake}/${nameSnake}_state.dart';

// class ${namePascal}Bloc extends Bloc<${namePascal}Event, ${namePascal}State> {
//     ${namePascal}Bloc();

//     @override
//     ${namePascal}State get initialState => ${namePascal}Loading();

//     @override
//     Stream<${namePascal}State> mapEventToState(${namePascal}Event event) async* {
//         // yield* xxx
//     }
// }`;
// }


// function generateEventCode(name: String | undefined) {
//   var namePascal = pascalCase(name);
//   return `
// import 'package:equatable/equatable.dart';
// import 'package:meta/meta.dart';

// @immutable
// abstract class ${namePascal}Event extends Equatable {
//     ${namePascal}Event([List props = const []]) : super(props);
// }

// class Load${namePascal} extends ${namePascal}Event {
//     Load${namePascal}();

//     @override
//     String toString() => "Load${namePascal}";
// }
// `;
// }


// function generateStateCode(projectName: String | undefined, name: String | undefined, opts: BlocOpts) {
//   var nameSnake = snakeCase(name);
//   var namePascal = pascalCase(name);
//   var nameCamel = camelCase(name);

//   var rv = `
// import 'package:equatable/equatable.dart';
// import 'package:meta/meta.dart';
// `;

//   if (opts.withModel) {
//     rv = rv + `import 'package:${snakeCase(projectName)}_mobile/models/${nameSnake}.dart';
// `;
//   }

//   rv = rv +
//     `@immutable
// abstract class ${namePascal}State extends Equatable {
//     ${namePascal}State([List props = const []]) : super(props);
// }

// /// Loading state
// class ${namePascal}Loading extends ${namePascal}State {
//   /// Set true to block screen with blocking loading modal box.
//   final bool block;
//   ${namePascal}Loading({this.block = false});
//   @override
//   String toString() => "${namePascal}Loading";
// }
// `;

//   if (opts.withModel) {
//     rv = rv + `class ${namePascal}ListLoaded extends ${namePascal}State {
//     final List<${namePascal}> ${nameCamel}s;

//     ${namePascal}ListLoaded(this.${nameCamel}s) : super([${nameCamel}s]);

//     @override
//     String toString() => "${namePascal}ListLoaded";
// }
// `;
//   }

//   rv = rv + `
// /// State when error/failure occurred
// class ${namePascal}Failure extends ${namePascal}State {
//     final String error;
//     ${namePascal}Failure({this.error}): super([error]);
//     @override
//     String toString() => "${namePascal}Failure";
// }      
// `;

//   return rv;
// }

