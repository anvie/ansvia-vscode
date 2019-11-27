# Ansvia VSCode

Ansvia VSCode extension, to simplify programmer's life.

## Features

### Server
* Server service & API code generator.
* Server data model generator.
* Server data model generator from SQL definition.
* Server db model type to API type converter.
* Server model's DAO generator.
* etc.. etc..

### Mobile (Flutter)
* BloC code generator.
* Flutter CRUD UI complete flow.
* Flutter model.
* Flutter model edit fields.
* Flutter model add fields.
* Generate Flutter model from SQL definition.
* Generate Flutter model from Rust struct.
* Flutter list widget (bloc/non bloc/stateless/statefull).
* Flutter list item widget.
* Flutter detail field widget.
* Flutter basic page.
* Flutter detail page.
* Flutter form add page.
* Flutter form edit page.
* Flutter form autocomplete field.
* Flutter Popup Menu Button.
* etc.. etc..

### Mobile (Vue.js)
* Generate CRUD Vue page.

### Utils
* Generate snippet code from selected text with multi-line support.


## Configurable

You can configure this extension per project via `ansvia-vscode.yaml` file by place the file into your root project directory.

Example configuration:

```yaml

# Synchronized code generator Server code -> Flutter code.
sync_gen:
  enum_types:
    # Generate dart code from Rust enum type ErrorCode.
    - src: src/error.rs#ErrorCode
      outs:
        - dart:frontends/mobile/lib/core/error_code.dart

    - src: src/types.rs#ObjectKind
      outs:
        - dart:frontends/mobile/lib/core/object_kind.dart

# Server related configuration
server:
  # Model directory
  model_dir: models
  # Model file name
  model_file: mod.rs
```


## Build

Enter into root project directory, and type:

    $ vsce package

The above command will created vsix file, eg: ansvia-vscode-0.0.4.vsix
Now you can install into VS Code > Extension > Install from VSIX.

**Enjoy!**
