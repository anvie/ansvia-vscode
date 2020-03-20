# Change Log

## 0.3.13

* Fixup generate CRUD API code generator wrong impl_service placement.
* Remove protobuf from API generated code.## 0.3.13.

## 0.3.11

- [Snippet] Added Rust code snippet for generate dao search method.

## 0.3.10

- [Syncgen] Fixup cannot generate code from non explicit numeric enum type.

## 0.3.9

- [Flutter] Fixup generate model from Rust struct does not treat Option as nullable.
- [Snippet] Added new rust snippet for test: apicallfunc
- [Flutter] Improve edit model's fields generator.
- [Flutter] Support nullable field by adding `?` char in field name, eg: name:z?
            nullable field will not generate assertion code for null value in `fromMap` method.
- [Flutter] Several minor fixes.
- [Flutter] Fixup Edit model fields failed to reconstruct list/array with custom type name.

## 0.3.7

- [Fixed] Bug edit model fields with custom type always treated as String type.
- [Fixed] Bug model `toMap` not convert recursively for custom type.

## 0.3.6

- Added command to generate dao from model and copy generated result into clipboard.

## 0.3.5

- Added support syncgen to generate Rust (server) enum types to Flutter (frontends) dart/js code.
- error_code syncgen is now deprecated, use syncgen.enum_types instead, see README for example usage.

## 0.3.4

- Add assertion in Flutter model `fromMap`.
- Handle null in Flutter model field.

## 0.3.2

- Enhance class variables and constructor code generator to use scoped class name first.
- Add more Dart snippets.
- Add Flutter's code generator variants for class variables constructor CVC1b and CVC4.

## 0.3.1

- Add Dart's snippet to generate Flutter dropdown list field code.
- Fixup labels for Flutter fragment generator code.

## 0.3.0

- Added new extension command "Utils" for code utility helper.
- Added Dart snippets.
- Added more Rust snippets.

## 0.2.17

- Added Rust snippet.

## 0.2.16

- [Server] Fixup table name in update method generator.

## 0.2.15

- Support for project without ansvia-vscode.yaml configuration file.

## 0.2.13

- Added code generator for Class variables and constructor, CVC1, CVC2, CVC3.
- Minor improvements.

## 0.2.12

- Added Generate DAO code from model.
- Some optimization.

## 0.2.11

- Added new model struct generator typed and convert.
- Bug fix: activation error when no error sync gen config.

## 0.2.9

- Auto generate error code from backend -> frontends.
- Remove old BloC generator.

## 0.2.8

- Generate CRUD Web Vue views.

## 0.2.7

- Generate DAO update method.
- Change how to insert service definition in latest Mainframe version.

## 0.2.6

- Generate DAO update method from model and copy to clipboard
- Fixup: Flutter model generator from Rust struct cannot handle boolean type.

## 0.2.5

- Generate Flutter model from Rust struct.
- Flutter model generator now support custom types.

## 0.2.4

- Added Flutter model fields updater.

## 0.2.3

- Some minor fixes.

## 0.2.2

- Rename LayeredRepo to SmartRepo.
- Some minor fixes and improvements.

## 0.2.1

- Bug fix: Flutter code generator for model cannot parse field name in quote.
- Improved: Flutter basic page generator.
- Changed: Flutter List Widget items naming.
- Added `d` type as f64 for server in model generator.

## 0.2.0

- Added Flutter "edit page" code generator.
- Added Server DAO new file (non inline) code generator.
- Added Server model generator from SQL definition.

## 0.1.9

- Add Flutter model generator from SQL definition.
- Some minor fixes when generating service implementation macro.

## 0.1.8

- Add code generator for DB model to API type converter.
- Fixed: Remove deprecated extension BloC command.

## 0.1.7

- Ask model fields for BLOC2 generator.
- Some minor bug fixes.

## 0.1.6

- Full BloC generator with smart repo.
- List Widget generator with support of stateless and statefull options.

## 0.1.5

- Improved: Flutter detail page generator.

## 0.1.4

- Added: Flutter popup menu button generator.

## 0.0.1

- Initial release
