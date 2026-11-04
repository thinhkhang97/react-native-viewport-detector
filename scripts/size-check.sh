#!/usr/bin/env bash
# Fails when the bundled, minified, gzipped entry points exceed their budgets (bytes).
set -euo pipefail
size() {
  npx -y esbuild@0.24.0 "$1" --bundle --minify --format=esm \
    --external:react --external:react-native --log-level=error | gzip -c | wc -c | tr -d ' '
}
core_entry=$(mktemp -d)/core.js
cat > "$core_entry" <<JS
export * from '$(pwd)/lib/module/react/ViewportProvider.js';
export * from '$(pwd)/lib/module/react/useViewportRoot.js';
export * from '$(pwd)/lib/module/react/useInView.js';
export * from '$(pwd)/lib/module/react/InView.js';
export * from '$(pwd)/lib/module/measure.js';
JS
full=$(size lib/module/index.js)
core=$(size "$core_entry")
echo "full entry: ${full} B (budget 7680), v2 API: ${core} B (budget 6656)"
[ "$full" -le 7680 ] && [ "$core" -le 6656 ]
