#!/bin/sh
set -eu
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
task_tmp=$(mktemp -d /tmp/derive-label-ocr.XXXXXX)
trap 'rm -rf "$task_tmp"' EXIT HUP INT TERM
if [ "${1:-}" = "--simulator" ]; then
  task_device=${2:-booted}
  xcrun --sdk iphonesimulator swiftc -target arm64-apple-ios16.0-simulator \
    -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -parse-as-library \
    "$task_root/modules/derive-label-ocr/ios/DeriveLabelOcrEngine.swift" \
    "$task_root/scripts/part-one-ocr-smoke.swift" -o "$task_tmp/label-ocr-smoke"
  xcrun simctl spawn "$task_device" "$task_tmp/label-ocr-smoke" "$task_tmp"
else
  xcrun swiftc -parse-as-library \
    "$task_root/modules/derive-label-ocr/ios/DeriveLabelOcrEngine.swift" \
    "$task_root/scripts/part-one-ocr-smoke.swift" -o "$task_tmp/label-ocr-smoke"
  "$task_tmp/label-ocr-smoke" "$task_tmp"
fi
