import ejs from "ejs";
import { getContext, helpers, Property, Import, Export, Parameter, Schema, XtpNormalizedType, ArrayType, ObjectType, EnumType, MapType, XtpTyped } from "@dylibso/xtp-bindgen";

function cppIdentifer(s: string) {
  if (!s) throw Error('Name missing to convert')
  return helpers.snakeToPascalCase(s);
}

function objectReferencesObject(existing: ObjectType, name: string) {
  for (const prop of existing.properties) {
    if (prop.kind === 'object') {
      const object = prop as ObjectType
      if (object.name === name) {
        return true
      }
    }
  }
  return false
}

function v2ToCppTypeXInner(type: XtpNormalizedType, refnamespace: string): string {
  switch (type.kind) {
    case 'string':
      return 'std::string'
    case 'int32':
      return 'int32_t'
    case 'int64':
      return 'int64_t'
    case 'float':
      return 'float'
    case 'double':
      return 'double'
    case 'byte':
      return 'uint8_t'
    case 'date-time':
      return 'std::string'
    case 'boolean':
      return 'bool'
    case 'array':
      const arrayType = type as ArrayType
      return 'std::vector<' + v2ToCppTypeX(arrayType.elementType, refnamespace) + '>'
    case 'buffer':
      return "std::vector<uint8_t>"
    case 'object':
      const oType = (type as ObjectType)
      if (oType.properties?.length > 0) {
        return refnamespace + cppIdentifer(oType.name)
      } else {
        // untyped object
        return "jsoncons::json"
      }
    case 'enum':
      return refnamespace + cppIdentifer((type as EnumType).name)
    case 'map':
      const { keyType, valueType } = type as MapType
      return 'std::unordered_map<' + v2ToCppTypeX(keyType, refnamespace) + ', ' + v2ToCppTypeX(valueType, refnamespace) + '>'
    default:
      throw new Error("Can't convert XTP type to C++ type: " + JSON.stringify(type))
  }
}

function v2ToCppTypeX(type: XtpNormalizedType, refnamespace: string) {
  const innerType = v2ToCppTypeXInner(type, refnamespace);
  if (type.nullable) {
    return 'std::optional<' + innerType + '>';
  }
  return innerType;
}

function v2ToCppType(property: XtpTyped, refnamespace: string, required?: boolean): string {
  const t = v2ToCppTypeX(property.xtpType, refnamespace)

  // if required is unset, just return what we get back
  if (required === undefined) return t

  // if it's set and true, just return what we get back
  if (required) return t

  // otherwise it's false, so let's ensure it's optional
  if (t.startsWith('std::optional<')) return t
  return `std::optional<${t}>`
}

function v2GetEstimatedSize(type: XtpNormalizedType): number {
  switch (type.kind) {
    case 'string':
      return 16
    case 'int32':
      return 4
    case 'int64':
      return 8
    case 'float':
      return 4
    case 'double':
      return 8
    case 'byte':
      return 1
    case 'date-time':
      return 14
    case 'boolean':
      return 1
    case 'array':
      return 16
    case 'buffer':
      return 16
    case 'object':
      const oType = (type as ObjectType)
      if (oType.properties?.length > 0) {
        return oType.properties.reduce((accumulator: number, currentValue: XtpNormalizedType) => {
          return accumulator + v2GetEstimatedSize(currentValue);
        }, 0);
      } else {
        // untyped object
        return 64
      }
    case 'enum':
      return 5
    case 'map':
      return 16
    default:
      throw new Error("Can't estimate size for XTP type: " + JSON.stringify(type))
  }
}

function v2IsLargeType(type: XtpNormalizedType) {
  return v2GetEstimatedSize(type) > 128
}

function v2ToStorageType(type: XtpNormalizedType, refnamespace: string) {
  if (v2IsLargeType(type)) {
    return 'std::unique_ptr<' + v2ToCppTypeXInner(type, refnamespace) + '>'
  }
  return v2ToCppTypeX(type, refnamespace)
}

function v2ToCppReturnType(property: XtpTyped, isImport: boolean): string {
  const refnamespace = isImport ? '' : 'pdk::'
  const rawType = v2ToStorageType(property.xtpType, refnamespace)
  return 'std::expected<' + rawType + ', ' + refnamespace + 'Error>'
}

function v2ToCppParamType(type: XtpNormalizedType, isImport: boolean): string {
  const refnamespace = isImport ? '' : 'pdk::';
  switch (type.kind) {
    case 'object':
      const oType = (type as ObjectType)
      if (oType.properties?.length > 0) {
        const name = v2ToCppTypeX(type, refnamespace);
        if (v2GetEstimatedSize(type) <= 8) {
          return name;
        }
        const prefix = isImport ? 'const ' : '';
        if (type.nullable && v2IsLargeType(type)) {
          const rawType = v2ToCppTypeXInner(type, refnamespace);
          if (isImport) {
            return prefix + rawType + ' *';
          }
          return prefix + 'std::unique_ptr<' + rawType + '>';
        }
        const suffix = isImport ? '&' : '&&';
        return prefix + name + suffix;
      }
      break;
    case "string":
      if (isImport) {
        return "std::string_view";
      } else {
        return 'std::string&&';
      }
    case "date-time":
      if (isImport) {
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
    case "map":
      const atype = v2ToCppTypeX(type, refnamespace);
      return (isImport ? 'const ' : '') + atype + (isImport ? '&' : '&&')
  }
  return v2ToCppTypeX(type, refnamespace);
}

function getImportReturnType(func: Import) {
  if (func.output) {
    return v2ToCppReturnType(func.output, true)
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
    return v2ToCppParamType(func.input.xtpType, true)
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
    return v2ToCppReturnType(func.output, false)
  }
  return 'std::expected<void, pdk::Error>';
}

function getExportParamType(func: Export) {
  if (func.input) {
    return v2ToCppParamType(func.input.xtpType, false)
  }
  return '';
}

function getPropertyNames(schema: Schema) {
  return schema.properties.map((item: Property) => item.name).join(', ');
}

function getHandleType(prop: Parameter) {
  if (prop.contentType === 'application/json') {
    return 'char';
  } else if (helpers.isEnum(prop) && prop.contentType === 'text/plain; charset=utf-8') {
    return 'char';
  } else if (prop.contentType === "application/x-binary") {
    if (helpers.isBuffer(prop)) {
      return 'uint8_t';
    } else if (helpers.isArray(prop)) {
      // unofficial extension - support fixed width types
      const arrayType = prop.xtpType as ArrayType
      switch (arrayType.elementType.kind) {
        case 'byte':
        case 'int32':
        case 'int64':
        case 'float':
        case 'double':
          return v2ToCppTypeXInner(arrayType.elementType, '')
      }
    }
  } else if (prop.contentType === 'text/plain; charset=utf-8') {
    if (helpers.isString(prop) || helpers.isBuffer(prop)) {
      return 'char'
    }
  }
  throw new Error("not sure what the handle type should be for " + prop.xtpType.kind + ' encoded as ' + prop.contentType);
}

function getHandleAccessor(prop: Parameter) {
  if (getHandleType(prop) != 'char') {
    return 'vec';
  } else if (prop.contentType === 'text/plain; charset=utf-8' && helpers.isBuffer(prop)) {
    return 'vec';
  }
  return 'string';
}

function getJSONDecodeType(param: Parameter) {
  return v2ToStorageType(param.xtpType, '')
}

function derefIfNotOptionalPointer(param: Parameter) {
  if (param.xtpType.nullable || !v2IsLargeType(param.xtpType)) {
    return '';
  }
  return '*';
}

function needsNullCheck(param: Parameter) {
  return !param.xtpType.nullable && v2IsLargeType(param.xtpType)
}

function objectHasBuffer(schema: Schema) {
  const object = schema.xtpType as ObjectType
  for (const prop of object.properties) {
    if (prop.kind === 'buffer') {
      return true
    }
  }
  return false
}

function isPropertyRequired(property: Property) {
  return property.required === undefined || property.required
}

function numRequiredProperties(object: Schema) {
  let count = 0;
  for (const prop of object.properties) {
    if (isPropertyRequired(prop)) {
      count++
    }
  }
  return count
}

function sortedProperties(object: Schema) {
  const properties: Property[] = []
  const requiredProperties: Property[] = []
  for (const prop of object.properties) {
    const target = (isPropertyRequired(prop) ? requiredProperties : properties)
    target.push(prop)
  }
  return [...requiredProperties, ...properties]
}

function isTypeUntypedObject(type: XtpNormalizedType) {
  if (type.kind === 'object') {
    const object = type as ObjectType;
    if (!object.properties?.length && object.name === '') {
      return true
    }
  }
  return false
}

export function render() {
  const tmpl = Host.inputString();
  const prevctx = getContext();

  const enums: Schema[] = [];
  const objects: Schema[] = [];
  Object.values(prevctx.schema.schemas).forEach(schema => {
    if (helpers.isEnum(schema)) {
      enums.push(schema);
    } else if (helpers.isObject(schema)) {
      const object = schema.xtpType as ObjectType;
      // insertion sort objects ahead of objects that use them
      let i = 0;
      for (; i < objects.length; i++) {
        if (objectReferencesObject(objects[i].xtpType as ObjectType, object.name)) {
          break;
        }
      }
      objects.splice(i, 0, schema); // we need Schema as it has the required attribute
    } else {
      throw new Error("unhandled schema type " + schema.xtpType.kind)
    }
  });
  // sort the properties for efficient struct layout
  for (const object of objects) {
    object.properties.sort((a: Property, b: Property) => {
      return v2GetEstimatedSize(b.xtpType) - v2GetEstimatedSize(a.xtpType)
    });
  }

  const headerUsesJSON = function () {
    for (const schema of objects) {
      const object = schema.xtpType as ObjectType;
      for (const type of object.properties) {
        if (isTypeUntypedObject(type)) {
          return true
        }
      }
    }
    for (const funcSet of [prevctx.schema.imports, prevctx.schema.exports]) {
      for (const func of funcSet) {
        for (const param of [func.input, func.output]) {
          if (param && isTypeUntypedObject(param.xtpType)) {
            return true
          }
        }
      }
    }
    return false
  }();

  const usesJSONEncoding = function () {
    for (const funcSet of [prevctx.schema.imports, prevctx.schema.exports]) {
      for (const func of funcSet) {
        for (const param of [func.input, func.output]) {
          if (param && param.contentType === 'application/json') {
            return true
          }
        }
      }
    }
    return false
  }();

  const usesBuffer = function () {
    for (const schema of objects) {
      if (objectHasBuffer(schema)) {
        return true;
      }
    }
    for (const funcSet of [prevctx.schema.imports, prevctx.schema.exports]) {
      for (const func of funcSet) {
        for (const param of [func.input, func.output]) {
          if (param && helpers.isBuffer(param)) {
            return true
          }
        }
      }
    }
    return false;
  }();

  const usesJSONBuffer = usesJSONEncoding && usesBuffer;

  const ctx = {
    ...helpers,
    ...prevctx,
    cppIdentifer,
    enums,
    objects,
    getImportReturnType,
    shouldImportReturnExplicitly,
    getImportParamType,
    getParamName,
    getExportReturnType,
    getExportParamType,
    getPropertyNames,
    getHandleType,
    getHandleAccessor,
    getJSONDecodeType,
    derefIfNotOptionalPointer,
    needsNullCheck,
    objectHasBuffer,
    usesJSONBuffer,
    v2ToCppType,
    numRequiredProperties,
    sortedProperties,
    headerUsesJSON,
    usesJSONEncoding
  };

  const output = ejs.render(tmpl, ctx);
  Host.outputString(output);
}
