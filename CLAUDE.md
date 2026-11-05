# react-native-viewport-detector

Pure-JS React Native library: `useInView` / `<InView>` / `<ViewportProvider>` (2.x), plus the deprecated 1.x `ViewPortDetector` API in `src/compat/`.

## Commands

- `npm test` — Jest (`src/__tests__/**`)
- `npm run typecheck` — tsc
- `npm run build` — builder-bob → `lib/`
- `./scripts/size-check.sh` — gzip size budgets (CI fails if exceeded)
- Example app: `cd example && npm install && npx expo start` (metro resolves the library from `../src`)

## Conventions

- `master` is protected: changes go through a PR, CI (typecheck, test, build, size, pack) must pass, PRs are squash-merged.
- Commit messages: `<type>: <description>` (feat, fix, docs, chore, ci, …). No AI attribution lines in commits or PR bodies.
- Keep README, `llms.txt`, `docs/BENCHMARKS.md` and `docs/MIGRATION.md` consistent with the engine's actual behaviour.

## Release process

Publishing is done by `.github/workflows/release.yml` on a `v*` tag, using **npm trusted publishing (OIDC) + staged publishing**. No npm token or repo secret exists or is needed.

1. **Prepare in a PR:** bump the version with `npm version <x.y.z[-beta.n]> --no-git-tag-version` (updates `package.json` + `package-lock.json`) and add a `## <version>` section at the top of `CHANGELOG.md`. Merge the PR after CI is green.
2. **Tag the merged commit** (the PR is squash-merged, so tag `origin/master`, not the local branch):
   ```bash
   git fetch origin && git tag v<version> origin/master && git push origin v<version>
   ```
   The workflow checks that the tag equals `v` + `package.json` version, re-runs typecheck/test/build/size, then runs `npm stage publish --provenance`. Versions containing `-` (e.g. `2.0.0-beta.1`) go to the `next` dist-tag; others go to `latest`.
3. **Approve the staged version with 2FA** (owner only — never automated). The job log prints `staged with id <stage-id>`:
   ```bash
   npx -y npm@11 stage approve <stage-id>
   ```
   (`npm stage` needs npm ≥ 11.15; `npx npm@11` avoids upgrading the global npm. If it fails with E401, the browser auth link it prints completes login.) Alternatively approve on npmjs.com → package → staged versions.
4. **Verify:** `curl -s https://registry.npmjs.org/react-native-viewport-detector | python3 -c "import json,sys; print(json.load(sys.stdin)['dist-tags'])"` — `npm view` can show stale dist-tags for about a minute.
5. **GitHub release:** `gh release create v<version> --verify-tag --title v<version> --notes-file <notes>`; add `--prerelease` for `-beta`/`-rc` versions so `v1.0.8`/the current stable stays "Latest".

### If the release job fails

- **Fails before publishing** (tests, size, tag/version mismatch): fix in a PR, then move the tag to the new master commit — `git push origin :refs/tags/v<version> && git tag -f v<version> origin/master && git push origin v<version>`. Only do this while the version is not yet on npm; a published version can never be re-used.
- **`ENEEDAUTH` / `403 OIDC permission denied`:** the npmjs.com Trusted Publisher must be GitHub Actions, `thinhkhang97` / `react-native-viewport-detector`, workflow `release.yml`, environment empty. It allows staged publishes only, so the workflow must keep `npm stage publish` (a direct `npm publish` gets 403). Re-run with `gh run rerun <run-id> --failed`.

### Dist-tags and branches

- `latest` = stable line (currently 1.0.8 until 2.0.0 is promoted); `next` = 2.x prereleases.
- Promoting 2.0.0: release `2.0.0` (no `-`) through the same flow; it lands on `latest`.
- 1.x maintenance: a `1.x` branch from `v1.0.8` (to be created). Releases from it must not take `latest` once 2.x is stable — publish them with a `v1` dist-tag.
