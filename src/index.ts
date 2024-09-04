import ejs from "ejs";
import { getContext, helpers, Property, Import, Export, Parameter } from "@dylibso/xtp-bindgen";

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

type PropertyLike = Property | Parameter;

function toCppType(property: PropertyLike): string {
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
      return 'std::vector<' + toCppType(property.items as Property) + '>';
    case "buffer":
      return "std::vector<uint8_t>";
    default:
      throw new Error("Can't convert property to C++ type: " + property.type);
  }
}

function toCppReturnType(property: PropertyLike): string {
  const rawType = toCppType(property);
  if (getEstimatedSize(property) > 128) {
    return 'std::unique_ptr<' + rawType + '>';
  }
  return 'std::expected<' + rawType + ', Error>';
}

function toCppParamType(property: PropertyLike, isImport: boolean): string {
  if (property.$ref) {
    if (getEstimatedSize(property) <= 8) {
      return property.$ref.name;
    }
    const prefix = isImport ? 'const ' : '';
    return prefix + property.$ref.name + '&';
  }
  switch (property.type) {
    case "string":
      if (isImport) {
        if (property.format === "date-time") {
          return "std::string_view";
        }
        return "std::string_view";
      } else {
        return 'std::string&&';
      }
    case "buffer":
      if (isImport) {
        return 'std::span<const uint8_t>';
      } else {
        return 'std::vector<uint8_t>&&';
      }
    case "array":
      if (isImport) {
        return 'std::span<const ' + toCppType(property) + '>';
      } else {
        return 'std::vector<' + toCppType(property) + '>&&';
      }
  }
  return toCppType(property);
}

function getEstimatedSize(property: PropertyLike): number {
  if (property.$ref) {
    if (property.$ref.enum) {
      return 5;
    }
    return property.$ref.properties.reduce((accumulator: number, currentValue: Property) => {
      return accumulator + getEstimatedSize(currentValue);
    }, 0);
  }
  switch (property.type) {
    case "string":
      if (property.format === "date-time") {
        return 14;
      }
      return 16;
    case "number":
      if (property.format === "float") {
        return 4;
      }
      if (property.format === "double") {
        return 8;
      }
      return 8;
    case "integer":
      return 4;
    case "boolean":
      return 1;
    case "object":
      return 9001;
    case "array":
      return 16;
    case "buffer":
      return 16;
    default:
      throw new Error("Cannot estimate size of type: " + property.type);
  }
}

function getReturnType(func: Import | Export) {
  if (func.output) {
    return toCppReturnType(func.output);
  }
  return 'std::expected<void, Error>';
}

function getImportParamType(func: Import) {
  if (func.input) {
    return toCppParamType(func.input, true);
  }
  return '';
}

function getParamName(func: Import | Export) {
  if (func.input) {
    return 'input';
  }
  return '';
}

function getExportParamType(func: Export) {
  if (func.input) {
    return toCppParamType(func.input, false);
  }
  return '';
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
  // sort the properties for efficient struct layout
  for (const object of objects) {
    object.properties.sort((a: Property, b: Property) => {
      return getEstimatedSize(b) - getEstimatedSize(a);
    });
  }

  const ctx = {
    ...helpers,
    ...prevctx,
    makePublic,
    enums,
    objects,
    toCppType,
    getReturnType,
    getImportParamType,
    getParamName,
    getExportParamType
  };




  //Host.outputString(JSON.stringify(objects))
  //Host.outputString(JSON.stringify(ctx.schema))
  const output = ejs.render(tmpl, ctx);
  Host.outputString(output);
}
