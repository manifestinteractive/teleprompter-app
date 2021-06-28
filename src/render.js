'use strict';

const electron = require('electron')
const version = require('../package.json').version

let style = 'default'

if (process.platform === 'darwin') {
  style = 'mac'
} else if (process.platform === 'win32') {
  style = 'win'
}

new (require('windowbar'))({
  style: style,
  title: `TelePrompter v${version}`,
  transparent: true
})
.on('close', () => electron.ipcRenderer.send('close'))
.on('fullscreen', () => electron.ipcRenderer.send('fullscreen'))
.on('maximize', () => electron.ipcRenderer.send('maximize'))
.on('minimize', () => electron.ipcRenderer.send('minimize'))
.appendTo(document.getElementById('windowbar'))
