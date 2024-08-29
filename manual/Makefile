WASI_SDK_PATH?=../../wasi-sdk

.PHONY: run
run: fruit.wasm
	extism call ./fruit.wasm referenceTypes --log-level debug --wasi --input "\"apple\""

.PHONY: run-bad-input
run-bad-input: fruit.wasm
	extism call ./fruit.wasm referenceTypes --log-level debug --wasi --input "\"steak\""

.PHONY: run-top
run-top: fruit.wasm
	extism call ./fruit.wasm topLevelPrimitives --log-level debug --wasi --input "\"hello\""

.PHONY: run-void
run-void: fruit.wasm
	extism call ./fruit.wasm voidFunc --log-level debug --wasi

pdk.gen.o: pdk.gen.cpp pdk.gen.hpp extism-pdk.hpp
	$(WASI_SDK_PATH)/bin/clang++ -I. -Imagic_enum -std=c++23 -fno-exceptions -O2 -g -c pdk.gen.cpp

impl.o: impl.cpp pdk.gen.hpp
	$(WASI_SDK_PATH)/bin/clang++ -I. -std=c++23 -fno-exceptions -O2 -g -c impl.cpp

fruit.wasm: pdk.gen.o impl.o
	$(WASI_SDK_PATH)/bin/clang++ -I. -std=c++23 -fno-exceptions -O2 -g -o $@ $^ -mexec-model=reactor

.PHONY: clean
clean:
	rm -f *.wasm *.o
