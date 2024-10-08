// THIS FILE WAS GENERATED BY `xtp-cpp-bindgen`. DO NOT EDIT.
#define EXTISM_CPP_IMPLEMENTATION
#include "pdk.gen.hpp"
#include "extism-pdk.hpp"
#include "jsoncons/json.hpp"
#include <magic_enum.hpp>

JSONCONS_ENUM_TRAITS(pdk::Fruit, apple, orange, banana, strawberry)
JSONCONS_ENUM_TRAITS(pdk::GhostGang, blinky, pinky, inky, clyde)
JSONCONS_ALL_MEMBER_TRAITS(pdk::WriteParams, key, value)
JSONCONS_ALL_MEMBER_TRAITS(pdk::ComplexObject, writeParams, aString,
                           anOptionalDate, ghost, anInt, aBoolean)

namespace pdk {

namespace exports {
int32_t EXTISM_EXPORTED_FUNCTION(referenceTypes) {
  extism::log_debug("referenceTypes: getting JSON input");
  auto input_str = extism::input().string();
  if (!input_str.size()) {
    extism::error_set("0 length input cannot be json");
    return -1;
  }
  auto input = jsoncons::decode_json<pdk::Fruit>(std::move(input_str));
  extism::log_debug("referenceTypes: calling implementation function");
  auto maybe_output = impl::referenceTypes(std::move(input));
  if (!maybe_output) {
    extism::error_set("nullptr returned");
    return -2;
  }
  extism::log_debug("referenceTypes: setting JSON output");
  std::string output;
  jsoncons::encode_json(*maybe_output, output);
  if (!extism::output(output)) {
    extism::error_set("outputting failed");
    return -3;
  }
  extism::log_debug("referenceTypes: returning");
  return 0;
}

int32_t EXTISM_EXPORTED_FUNCTION(topLevelPrimitives) {
  extism::log_debug("topLevelPrimitives: getting JSON input");
  auto input_str = extism::input().string();
  if (!input_str.size()) {
    extism::error_set("0 length input cannot be json");
    return -1;
  }
  auto input = jsoncons::decode_json<std::string>(std::move(input_str));
  extism::log_debug("topLevelPrimitives: calling implementation function");
  auto raw_output = impl::topLevelPrimitives(std::move(input));
  extism::log_debug("topLevelPrimitives: setting JSON output");
  std::string output;
  jsoncons::encode_json(raw_output, output);
  if (!extism::output(output)) {
    extism::error_set("outputting failed");
    return -3;
  }
  extism::log_debug("topLevelPrimitives: returning");
  return 0;
}

int32_t EXTISM_EXPORTED_FUNCTION(voidFunc) {
  extism::log_debug("voidFunc: calling implementation function");
  impl::voidFunc();
  extism::log_debug("voidFunc: returning");
  return 0;
}
} // namespace exports

namespace imports {
EXTISM_IMPORT_USER("eatAFruit")
extern extism::imports::RawHandle eatAFruit(extism::imports::RawHandle);

EXTISM_IMPORT_USER("kv_read")
extern extism::imports::RawHandle kv_read(extism::imports::RawHandle);

EXTISM_IMPORT_USER("kv_write")
extern void kv_write(extism::imports::RawHandle);
} // namespace imports

// eatAFruit This is a host function. Right now host functions can only be the
// type (i64) -> i64. We will support more in the future. Much of the same rules
// as exports apply. It takes input of Fruit (A set of available fruits you can
// consume) And it returns an output bool
std::expected<bool, Error> eatAFruit(Fruit input) {
  auto input_string = magic_enum::enum_name(input);
  auto in_handle = extism::UniqueHandle<char>::from(input_string);
  if (!in_handle) {
    return std::unexpected(Error::extism);
  }
  auto out_raw = imports::eatAFruit(*in_handle);
  if (!out_raw) {
    return std::unexpected(Error::host_null);
  }
  extism::UniqueHandle<char> out_handle(out_raw);
  auto out_string = out_handle.string();
  if (!out_string.size()) {
    return std::unexpected(Error::not_json);
  }
  return jsoncons::decode_json<bool>(std::move(out_string));
}

// kv_read
// It takes input of string (the key)
// And it returns an output std::vector<std::byte> (the raw byte values at key)
std::expected<std::vector<std::byte>, Error> kv_read(std::string_view input) {
  auto in_handle = extism::UniqueHandle<char>::from(input);
  if (!in_handle) {
    return std::unexpected(Error::extism);
  }
  auto out_raw = imports::kv_read(*in_handle);
  if (!out_raw) {
    return std::unexpected(Error::host_null);
  }
  extism::UniqueHandle<std::byte> out_handle(out_raw);
  return out_handle.vec();
}

// kv_write
// It takes input of WriteParams (Parameters to write to kv store)
std::expected<void, Error> kv_write(const WriteParams &input) {
  std::string json_input;
  jsoncons::encode_json(input, json_input);
  auto in_handle = extism::UniqueHandle<char>::from(json_input);
  if (!in_handle) {
    return std::unexpected(Error::extism);
  }
  imports::kv_write(*in_handle);
  return std::expected<void, Error>();
}
} // namespace pdk
