#!/bin/bash
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/build-native-mac-app.sh" "$@"
