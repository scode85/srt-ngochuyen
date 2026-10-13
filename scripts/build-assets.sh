#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p .build
git clone --depth 1 https://github.com/k2-fsa/sherpa-onnx.git .build/sherpa-onnx
ASSETS="$ROOT/.build/sherpa-onnx/wasm/tts/assets"
curl -fL --retry 3 -o "$ASSETS/model.onnx" 'https://huggingface.co/doof-ferb/nghitts-copy/resolve/main/sherpa-onnx/ngochuyen.onnx'
curl -fL --retry 3 -o "$ASSETS/tokens.txt" 'https://huggingface.co/doof-ferb/nghitts-copy/resolve/main/sherpa-onnx/tokens.txt'
if [ ! -d "$ASSETS/espeak-ng-data" ]; then
 curl -fL --retry 3 -o "$ASSETS/espeak.tar.bz2" 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/espeak-ng-data.tar.bz2'
 tar -xjf "$ASSETS/espeak.tar.bz2" -C "$ASSETS"
fi
test -s "$ASSETS/model.onnx"
test -s "$ASSETS/tokens.txt"
test -d "$ASSETS/espeak-ng-data"
cd "$ROOT/.build/sherpa-onnx"
./build-wasm-simd-tts.sh
FROM="$PWD/build-wasm-simd-tts/install/bin/wasm/tts"
for name in sherpa-onnx-wasm-main-tts.js sherpa-onnx-wasm-main-tts.wasm sherpa-onnx-wasm-main-tts.data sherpa-onnx-tts.js; do
 test -s "$FROM/$name" || { echo "Missing asset $FROM/$name"; exit 1; }
 cp "$FROM/$name" "$ROOT/site/$name"
done
echo 'Sherpa-ONNX model WASM copied to site'
