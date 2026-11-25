#!/bin/sh
set -eu

# Firebase client configuration is local and ignored. Simulator builds can run
# without it; release archives are gated by scripts/ios-build.mjs.
config="${SRCROOT}/App/GoogleService-Info.plist"
output="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/GoogleService-Info.plist"
if [ -f "$config" ]; then
  bundle=$(/usr/libexec/PlistBuddy -c 'Print :BUNDLE_ID' "$config")
  if [ "$bundle" != 'com.luwangtech.daciana' ]; then
    echo 'error: Firebase iOS configuration has the wrong bundle ID.'
    exit 1
  fi
  mkdir -p "$(dirname "$output")"
  cp "$config" "$output"
elif [ -f "$output" ]; then
  rm "$output"
fi
