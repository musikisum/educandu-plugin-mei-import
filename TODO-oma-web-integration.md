# TODO: esbuild-Fix in oma-web nachziehen, sobald mei-import dort eingebunden wird

## Problem

Verovio (`verovio/wasm`, siehe `src/mei-document.js`) besteht aus generiertem
Emscripten/WASM-Loader-Code, der sowohl in Node.js als auch im Browser laufen
kann. Dafür enthält er einen Node-Fallback-Zweig:

```js
await import("node:module");
```

Dieser Zweig wird zur Laufzeit im Browser nie ausgeführt, aber esbuild
versucht beim Bündeln trotzdem, `node:module` als Modul aufzulösen — und
bricht ab, weil `node:module` ein Node-Builtin ist, kein npm-Paket:

```
X [ERROR] Could not resolve "node:module"
node_modules/verovio/dist/verovio-module.mjs:1:339
```

In diesem Repo (`mei-import`) ist der Fix bereits in `gulpfile.js`
(`buildTestAppJs`) eingebaut. **Sobald `oma-web` das Plugin
`musikisum/educandu-plugin-mei-import` registriert, tritt derselbe Fehler dort
erneut auf**, weil `oma-web` seinen eigenen esbuild-Build hat, der das Plugin
mitbündelt.

## Original-Codestelle in oma-web

`d:/dev/oma-web/gulpfile.js`, Funktion `buildJs` (aktueller Stand, unverändert):

```js
export async function buildJs() {
  if (currentAppBuildContext) {
    await currentAppBuildContext.rebuild();
  } else {
    // eslint-disable-next-line require-atomic-updates
    currentAppBuildContext = await esbuild.bundle({
      entryPoints: ['./src/main.js'],
      outdir: './dist',
      minify: true,
      incremental: isInWatchMode,
      inject: ['./src/polyfills.js'],
      metaFilePath: './dist/.meta.json'
    });
  }
}
```

## Notwendige Änderung

Nur eine neue Zeile im Optionsobjekt der `esbuild.bundle({...})`-Aufrufs
ergänzen, der Rest (inkl. `if`/`else` fürs Watch-Mode-Rebuild) bleibt
unverändert:

```js
export async function buildJs() {
  if (currentAppBuildContext) {
    await currentAppBuildContext.rebuild();
  } else {
    // eslint-disable-next-line require-atomic-updates
    currentAppBuildContext = await esbuild.bundle({
      entryPoints: ['./src/main.js'],
      outdir: './dist',
      minify: true,
      incremental: isInWatchMode,
      inject: ['./src/polyfills.js'],
      metaFilePath: './dist/.meta.json',
      external: ['node:module']
    });
  }
}
```

## Referenz

Gleicher Fix bereits umgesetzt in diesem Repo:
`d:/dev/oma-plugin mei-import/gulpfile.js`, Funktion `buildTestAppJs`.
