
import { Field } from './field';

export class ModelStruct {
  name: string;
  fields: Array<Field>;
  constructor(name: string, fields: Array<Field>) {
    this.name = name;
    this.fields = fields;
  }

  static parse(text:string) {
    const reName = new RegExp("pub struct (\\w*) {");
    const reField = new RegExp("pub (\\w*): *([a-zA-Z0-9_<>:]*),?");
  
    var name = "";
  
    let lines = text.split('\n');
    let fields = [];
  
    for (let line of lines) {
      var s = reName.exec(line);
      if (s && s[1]) {
        if (name !== "") {
          return;
        }
        name = s[1].trim();
        continue;
      }
      if (name.length > 0) {
        s = reField.exec(line);
        if (s === null) {
          continue;
        }
        // console.log("s: " + s);
        // console.log("s[2]: " + s[2]);
        if (s[1]) {
          let fieldName = s[1].trim();
          let ty = s[2].trim();
          fields.push(new Field(fieldName, ty));
        }
      }
    }

    return new ModelStruct(name, fields);
  }
}



