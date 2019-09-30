import { parseFieldsStr, shortcutTypeToRustType } from "./util";
import snakeCase = require("snake-case");
import camelCase = require("camel-case");

export class Field {
  name: string;
  ty: string;
  nameSnake: string;
  nameCamel: string;
  constructor(name: string, ty: string) {
    this.name = name;
    this.ty = ty;
    this.nameSnake = snakeCase(name);
    this.nameCamel = camelCase(name);
  }

  static parseFields(text:string): Array<Field> {
    return parseFieldsStr(text);
  }

  static mapShortcutTypeToRustType(fields:Array<Field>): Array<Field> {
    return fields.map((a) => {
      a.ty = shortcutTypeToRustType(a.ty);
      return a;
    });
  }
}

