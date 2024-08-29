#include "pdk.gen.hpp"

std::unique_ptr<pdk::ComplexObject> impl::referenceTypes(pdk::Fruit input) {
  // return nullptr;
  return std::make_unique<pdk::ComplexObject>(pdk::ComplexObject{
      .writeParams =
          pdk::WriteParams{.key = "key", .value = {'v', 'a', 'l', 'u', 'e'}},
      .aString = "string",
      .anOptionalDate = "date",
      .ghost = pdk::GhostGang::blinky,
      .anInt = 60,
      .aBoolean = true});
}

std::vector<bool> impl::topLevelPrimitives(std::string &&input) {
  if (input == "hello") {
    return {true, true};
  }
  return {false, false};
}

void impl::voidFunc() {}
