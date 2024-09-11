import ejs from "ejs";
import { getContext, helpers, Property, Import, Export, Parameter, Schema } from "@dylibso/xtp-bindgen";

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

function toCppTypeInner(property: PropertyLike, refnamespace: string): string {
  if (property.$ref) return refnamespace + property.$ref.name;
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
      return "std::string";
    case "array":
      return 'std::vector<' + toCppType(property.items as Property, refnamespace) + '>';
    case "buffer":
      return "std::vector<uint8_t>";
    default:
      throw new Error("Can't convert property to C++ type: " + property.type);
  }
}

function toCppType(property: PropertyLike, refnamespace: string) {
  const innerType = toCppTypeInner(property, refnamespace);
  if (property.nullable) {
    return 'std::optional<' + innerType + '>';
  }
  return innerType;
}

function isLargeType(property: PropertyLike) {
  return getEstimatedSize(property) > 128;
}

function toStorageType(param: Parameter, refnamespace: string) {
  if (isLargeType(param)) {
    return 'std::unique_ptr<' + toCppTypeInner(param, refnamespace) + '>';
  }
  return toCppType(param, refnamespace);
}

function toCppReturnType(property: Parameter, isImport: boolean): string {
  const refnamespace = isImport ? '' : 'pdk::';
  const rawType = toStorageType(property, refnamespace);
  return 'std::expected<' + rawType + ', ' + refnamespace + 'Error>';
}

function toCppParamType(property: PropertyLike, isImport: boolean): string {
  const refnamespace = isImport ? '' : 'pdk::';
  if (property.$ref) {
    const name = toCppType(property, refnamespace);
    if (getEstimatedSize(property) <= 8) {
      return name;
    }
    const prefix = isImport ? 'const ' : '';
    if (property.nullable && isLargeType(property)) {
      const rawType = toCppTypeInner(property, refnamespace);
      if (isImport) {
        return prefix + rawType + ' *';
      }
      return prefix + 'std::unique_ptr<' + rawType + '>';
    }
    const suffix = isImport ? '&' : '&&';
    return prefix + name + suffix;
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
        return 'std::span<const ' + toCppType(property, refnamespace) + '>';
      } else {
        return 'std::vector<' + toCppType(property, refnamespace) + '>&&';
      }
  }
  return toCppType(property, refnamespace);
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

function getImportReturnType(func: Import) {
  if (func.output) {
    return toCppReturnType(func.output, true);
  } else if (!func.input) {
    return 'void';
  }
  return 'std::expected<void, Error>';
}

function shouldImportReturnExplicitly(func: Import) {
  return getImportReturnType(func) !== 'void';
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

function getExportReturnType(func: Export) {
  if (func.output) {
    return toCppReturnType(func.output, false);
  }
  return 'std::expected<void, pdk::Error>';
}

function getExportParamType(func: Export) {
  if (func.input) {
    return toCppParamType(func.input, false);
  }
  return '';
}

function getPropertyNames(schema: Schema) {
  return schema.properties.map((item: Property) => item.name).join(', ');
}

function isEnum(prop: PropertyLike) {
  return prop['$ref'] && prop['$ref']['enum'];
}

function isString(param: Parameter) {
  return !param['$ref'] && param.type === 'string' && !param.format;
}

function getHandleType(prop: Parameter) {
  if (prop.contentType === 'application/json') {
    return 'char';
  }
  else if (isEnum(prop) && prop.contentType === 'text/plain; charset=utf-8') {
    return 'char';
  }
  else if (!prop['$ref']) {
    if (prop.contentType === "application/x-binary") {
      if (prop.type === 'buffer') {
        return 'uint8_t';
      } else if (prop.type === 'array' && !(prop.items as Property)['$ref']) {
        // support fixed width numeric types
        const aprop = prop.items as Property;
        if (aprop.type === 'number' || aprop.type === 'integer') {
          return toCppType(aprop, '');
        }
      }
    } else if (prop.contentType === 'text/plain; charset=utf-8') {
      if (prop.type === 'string' && !prop.format) {
        return 'char';
      } else if (prop.type === 'buffer') {
        return 'char';
      }
    }
  }
  throw new Error("not sure what the handle type should be for " + prop.type + ' encoded as ' + prop.contentType);
}

function getHandleAccessor(prop: Parameter) {
  if (getHandleType(prop) != 'char') {
    return 'vec';
  } else if (!prop['$ref'] && prop.contentType === 'text/plain; charset=utf-8' && prop.type === 'buffer') {
    return 'vec';
  }
  return 'string';
}

function getJSONDecodeType(param: Parameter) {
  return toStorageType(param, '');
}

function derefIfNotOptionalPointer(param: Parameter) {
  if (param.nullable || !isLargeType(param)) {
    return '';
  }
  return '*';
}

function needsNullCheck(param: Parameter) {
  return !param.nullable && isLargeType(param);
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
    getImportReturnType,
    shouldImportReturnExplicitly,
    getImportParamType,
    getParamName,
    getExportReturnType,
    getExportParamType,
    getPropertyNames,
    isEnum,
    getHandleType,
    getHandleAccessor,
    getJSONDecodeType,
    derefIfNotOptionalPointer,
    needsNullCheck,
    isString
  };




  //Host.outputString(JSON.stringify(objects))
  //Host.outputString(JSON.stringify(ctx.schema))
  const output = ejs.render(tmpl, ctx);
  Host.outputString(output);
}
