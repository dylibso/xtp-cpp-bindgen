import ejs from "ejs";
import { getContext, helpers, Property } from "@dylibso/xtp-bindgen";

function toGolangType(property: Property): string {
  if (property.$ref) return property.$ref.name;
  switch (property.type) {
    case "string":
      if (property.format === "date-time") {
        return "time.Time";
      }
      return "string";
    case "number":
      if (property.format === "float") {
        return "float32";
      }
      if (property.format === "double") {
        return "float64";
      }
      return "int64";
    case "integer":
      return "int32";
    case "boolean":
      return "bool";
    case "object":
      return "map[string]interface{}";
    case "array":
      if (!property.items) return "[]any";
      // TODO this is not quite right to force cast
      return `[]${toGolangType(property.items as Property)}`;
    case "buffer":
      return "[]byte";
    default:
      throw new Error("Can't convert property to Go type: " + property.type);
  }
}

function pointerToGolangType(property: Property) {
  const typ = toGolangType(property);

  if (typ.startsWith("[]") || typ.startsWith("map[")) {
    return typ;
  }

  return `*${typ}`;
}

function makePublic(s: string) {
  const cap = s.charAt(0).toUpperCase();
  if (s.charAt(0) === cap) {
    return s;
  }

  const pub = cap + s.slice(1);
  return pub;
}

function objectReferencesObject(existing: any, name: string) {
  for (const prop of existing.properties) {
    if (prop['$ref'] && prop['$ref']['name'] === name) {
      return true;
    }
  }
  return false;
}

function getTypename(property: Property): string {
  if (property.$ref) return property.$ref.name;
  switch (property.type) {
    case "string":
      if (property.format === "date-time") {
        return "std::string";
      }
      return "std::string";
    case "number":
      if (property.format === "float") {
        return "float";
      }
      if (property.format === "double") {
        return "double";
      }
      return "int64_t";
    case "integer":
      return "int32_t";
    case "boolean":
      return "bool";
    case "object":
      return "object_notimplemented";
    case "array":
      //if (!property.items) return "[]any";
      //// TODO this is not quite right to force cast
      //return `[]${toGolangType(property.items as Property)}`;
      return 'array_notimplemented';
    case "buffer":
      return "std::vector<uint8_t>";
    default:
      throw new Error("Can't convert property to Go type: " + property.type);
  }
}

export function render() {
  const tmpl = Host.inputString();
  const prevctx = getContext();

  const enums: any[] = [];
  const objects: any[] = [];
  Object.values(prevctx.schema.schemas).forEach(schema => {
    if (schema.enum) {
      enums.push(schema);
    } else {
      // insertion sort objects ahead of objects that use them
      let i = 0;
      for (; i < objects.length; i++) {
        if (objectReferencesObject(objects[i], schema.name)) {
          break;
        }
      }
      objects.splice(i, 0, schema);
    }
  });

  const ctx = {
    ...helpers,
    ...prevctx,
    toGolangType,
    pointerToGolangType,
    makePublic,
    enums,
    objects,
    getTypename
  };




  //Host.outputString(JSON.stringify(objects))
  //Host.outputString(JSON.stringify(ctx.schema))
  const output = ejs.render(tmpl, ctx);
  Host.outputString(output);
}
