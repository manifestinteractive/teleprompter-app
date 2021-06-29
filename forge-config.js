const path = require('path')

const productName = require('./package.json').name
const version = require('./package.json').version
const year = new Date().getFullYear()

module.exports = {
  packagerConfig: {
    icon: './build/icon',
    name: productName,
    overwrite: true,
    appCopyright: `© ${year} Peter Schmalfeldt`,
    ignore: [
      "^(\/.github$)",
      "^(\/.vscode$)",
      "^(\/build$)",
      "^(\/out$)",
      '.editorconfig',
      '.env',
      '.env.example',
      '.gitignore',
      '.nvmrc',
      '^(\/DEVELOPERS.md$)',
      '^(\/README.md$)',
      'forge-config.js',
      'package-lock.json',
      'teleprompter.code-workspace'
    ]
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: productName,
        description: 'TelePrompter App for Windows',
        appCopyright: `© ${year} Peter Schmalfeldt`,
        version: version,
        authors: 'Peter Schmalfeldt'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: [
        'darwin'
      ]
    },
    {
      name: '@electron-forge/maker-deb',
      config: {}
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {}
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        background: './build/background.png',
        icon: './build/icon.icns',
        title: `TelePrompter v${version}`,
        iconTextSize: 16,
        iconSize: 120,
        contents: [
          {
            x: 425,
            y: 237,
            type: 'link',
            path: '/Applications'
          },
          {
            x: 120,
            y: 237,
            type: 'file',
            path: path.resolve(process.cwd(), `out/${productName}-darwin-x64/${productName}.app`)
          }
        ]
      }
    }
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'manifestinteractive',
          name: 'teleprompter-app'
        },
        draft: true
      }
    }
  ]
}
