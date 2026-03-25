#!/bin/bash
# Wrapper: echte logica staat in scripts/build.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/build.sh" "$@"
