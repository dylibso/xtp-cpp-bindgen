WASI_SDK_PATH?=../../wasi-sdk

.PHONY: build
build: dist/plugin.wasm

.PHONY: run
run: dist/plugin.wasm
	extism call ./dist/plugin.wasm referenceTypes --log-level debug --wasi --input "\"apple\""

.PHONY: run-bad-input
run-bad-input: dist/plugin.wasm
	extism call ./dist/plugin.wasm referenceTypes --log-level debug --wasi --input "\"steak\""

.PHONY: run-top
run-top: dist/plugin.wasm
	extism call ./dist/plugin.wasm topLevelPrimitives --log-level debug --wasi --input "\"hello\""

.PHONY: run-void
run-void: dist/plugin.wasm
	extism call ./dist/plugin.wasm voidFunc --log-level debug --wasi

pdk.gen.o: pdk.gen.cpp pdk.gen.hpp extism-pdk.hpp
	$(WASI_SDK_PATH)/bin/clang++ -I. -Imagic_enum -std=c++23 -fno-exceptions -O2 -g -c pdk.gen.cpp

impl.o: impl.cpp pdk.gen.hpp
	$(WASI_SDK_PATH)/bin/clang++ -I. -std=c++23 -fno-exceptions -O2 -g -c impl.cpp

dist/plugin.wasm: pdk.gen.o impl.o
	mkdir -p dist
	$(WASI_SDK_PATH)/bin/clang++ -I. -std=c++23 -fno-exceptions -O2 -g -o $@ $^ -mexec-model=reactor

.PHONY: clean
clean:
	rm -f *.wasm *.o
