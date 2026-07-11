# educandu-plugin-mei-import

An [educandu](https://github.com/educandu/educandu) plugin to import MEI (Music Encoding Initiative) files and display musical notation.

## Prerequisites

* node.js ^20.0.0
* optional: globally installed gulp: `npm i -g gulp-cli`

The output of this repository is an npm package (`@musikisum/educandu-plugin-mei-import`).

## Installation

```sh
npm install @musikisum/educandu-plugin-mei-import
```

## Usage

Add the plugin info to the application's custom resolvers module:

```js
import MeiImportPlugin from '@musikisum/educandu-plugin-mei-import';

export default {
  resolveCustomPageTemplate: null,
  resolveCustomHomePageTemplate: null,
  resolveCustomSiteLogo: null,
  resolveCustomPluginInfos: () => [MeiImportPlugin]
};
```

Add the plugin name, the translations and any additional controllers to your server config:

```js
import educandu from '@educandu/educandu';
import { createRequire } from 'node:module';
import MeiImportController from '@musikisum/educandu-plugin-mei-import/mei-import-controller.js';

const require = createRequire(import.meta.url);
const meiImportPluginTranslationsPath = require.resolve('@musikisum/educandu-plugin-mei-import/translations.json');

educandu({
  plugins: [/* your other plugins here */, 'musikisum/educandu-plugin-mei-import'],
  resources: [/* your other translations here */, meiImportPluginTranslationsPath],
  additionalControllers: [/* your other additional controllers here */, MeiImportController],
  /* your other server config here */
});
```

Import the plugin styles to your main LESS entry point:

```less
// Base styles from Educandu:
@import url('@educandu/educandu/styles/main.less');

// Styles for the plugin:
@import url('@musikisum/educandu-plugin-mei-import/mei-import.less');

// Other styles here
```

## Development

```sh
git clone git@github.com:musikisum/educandu-plugin-mei-import.git
cd educandu-plugin-mei-import
yarn install
npx gulp
```

---

## OER learning platform for music

Funded by 'Stiftung Innovation in der Hochschullehre'

<img src="https://stiftung-hochschullehre.de/wp-content/uploads/2020/07/logo_stiftung_hochschullehre_screenshot.jpg)" alt="Logo der Stiftung Innovation in der Hochschullehre" width="200"/>

A Project of the 'Hochschule für Musik und Theater München' (University for Music and Performing Arts)

<img src="https://upload.wikimedia.org/wikipedia/commons/d/d8/Logo_Hochschule_f%C3%BCr_Musik_und_Theater_M%C3%BCnchen_.png" alt="Logo der Hochschule für Musik und Theater München" width="200"/>

Project owner: Hochschule für Musik und Theater München\
Project management: Ulrich Kaiser
