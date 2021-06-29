const path = require('path')

const productName = require('./package.json').name
const version = require('./package.json').version
const year = new Date().getFullYear()

module.exports = {
  packagerConfig: {
    icon: './build/icon',
    name: productName,
    overwrite: true,
    appCopyright: `© ${year} https://promptr.tv`,
    dir: './src'
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: productName
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
  ]
}
