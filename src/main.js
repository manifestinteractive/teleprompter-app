'use strict'

const electron = require('electron')
const glasstron = require('glasstron')
const path = require('path')
const settings = require('electron-settings')

// App Variables
let lastWindowState
let mainWindow
let resizeDebounce

// Default App Settings
settings.configure({
  defaults: {
    lastWindowState: {
      fullscreen: false,
      height: 768,
      maximized: false,
      width: 1024
    }
  }
})

/**
 * App Menu Template
 * @type array
 */
 let menuTemplate = [
  {
    label: 'TelePrompter',
    submenu: [
      {
        label: 'About TelePrompter',
        selector: 'orderFrontStandardAboutPanel:'
      },
      {
        type: 'separator'
      },
      {
        label: 'MIT License',
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            electron.shell.openExternal('https://github.com/manifestinteractive/teleprompter-app/blob/main/LICENSE')
          }
        }
      },
      {
        label: 'Visit Open Source Project',
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            electron.shell.openExternal('https://github.com/manifestinteractive/teleprompter-app')
          }
        }
      },
      {
        label: 'View Change Log',
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            electron.shell.openExternal('https://github.com/manifestinteractive/teleprompter-app')
          }
        }
      },
      {
        label: 'Version: ' + electron.app.getVersion(),
        enabled: false
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        accelerator: 'Command+Q',
        click: () => {
          electron.app.quit()
        }
      }
    ]
  }
 ]

 /**
 * Build App Menu
 */
const setMenu = () => {
  if (electron.Menu && typeof electron.Menu.buildFromTemplate !== 'undefined') {
    let appMenu = electron.Menu.buildFromTemplate(menuTemplate)
    electron.Menu.setApplicationMenu(appMenu)
  }
}

/**
 * Create Electron Window
 */
const createWindow = () => {
  // Initialize Main Window
	mainWindow = new glasstron.BrowserWindow({
		autoHideMenuBar: true,
		backgroundColor: 'rgba(0, 0, 0, 0)',
		blur: false,
		frame: false,
    hasShadow: false,
		height: 768,
    icon: path.join(__dirname, 'assets/icon/png/128x128.png'),
		resizable: true,
		show: true,
    title: 'TelePrompter',
		transparent: true,
		width: 1024,
		webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: true,
			nodeIntegration: true,
      contextIsolation: false
		}
	})

  if (process.platform === 'darwin') {
    electron.app.dock.setIcon(path.join(__dirname, 'assets/icon/png/128x128.png'));
  }

  // Load HTML Page into Window
	mainWindow.webContents.loadURL(`file://${__dirname}/index.html`)

  // We need this to sit on top of other apps
  mainWindow.setAlwaysOnTop(true)

  // Create App Menu
  // setMenu()

  // Exit App on Window Close
  mainWindow.on('closed', () => {
    mainWindow = null
    process.exit()
  })

  // Open New Windows in Default Browser
  mainWindow.webContents.on('new-window', (e, url) => {
    e.preventDefault()
    electron.shell.openExternal(url)
  });

  // Track Window States
  mainWindow.on('resize', () => {
    clearTimeout(resizeDebounce)
    resizeDebounce = setTimeout(storeWindowState, 200)
  })

  mainWindow.on('moved', storeWindowState)

  // Get Last Window State
  settings.get('lastWindowState').then(lastState => {
    lastWindowState = lastState

    // Update Window Bounds
    mainWindow.setBounds({
      x: lastState.x,
      y: lastState.y,
      width: lastState.width,
      height: lastState.height
    }, true)

    if (lastState.maximized) {
      mainWindow.maximize()
    }

    if (lastState.fullscreen) {
      mainWindow.setFullScreen(true)
    }

    mainWindow.show()
  }).catch((error) => {
    mainWindow.show()
  })

	if (process.platform === 'linux') {
		mainWindow.on('resize', () => {
			mainWindow.webContents.send('maximized', !mainWindow.isNormal())
		})
	}

	mainWindow.on('ready-to-show', () => {
		if (process.platform === 'linux') {
      mainWindow.webContents.send('maximized', !mainWindow.isNormal())
    }
		mainWindow.show()
	})

	electron.ipcMain.on('close', () => {
		electron.app.quit()
	})

	electron.ipcMain.on('minimize', (e) => {
		const mainWindow = electron.BrowserWindow.fromWebContents(e.sender)
		mainWindow.minimize()
	})

  electron.ipcMain.on('maximize', (e) => {
		const mainWindow = electron.BrowserWindow.fromWebContents(e.sender)
		mainWindow.maximize()
	})

  electron.ipcMain.on('fullscreen', (e) => {
		const mainWindow = electron.BrowserWindow.fromWebContents(e.sender)
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false)
    } else {
      mainWindow.setFullScreen(true)
    }
	})

	return mainWindow
}

/**
 * Store Window State
 * Triggered after Window Resize & Move
 */
const storeWindowState = () => {
  let bounds = mainWindow.getBounds()
  settings.set('lastWindowState', {
    fullscreen: mainWindow.isFullScreen(),
    height: bounds.height,
    maximized: mainWindow.isMaximized(),
    width: bounds.width,
    x: bounds.x,
    y: bounds.y
  })
}

/**
 * Add Custom Command Line Switches
 */
electron.app.commandLine.appendSwitch('enable-transparent-visuals')

/**
 * Set About Panel Options
 */
 electron.app.setAboutPanelOptions({
  applicationName: 'TelePrompter',
  applicationVersion: electron.app.getVersion(),
  copyright: '© 2021 https://promptr.tv',
  credits: 'Created by Peter Schmalfeldt',
  authors: 'Created by Peter Schmalfeldt',
  website: 'https://github.com/manifestinteractive/teleprompter-app',
  iconPath: path.join(__dirname, 'assets/icon/png/128x128.png')
 })


/**
 * Recreate Window if not initialized
 */
 electron.app.on('activate', () => {
  if (!mainWindow) {
    createWindow()
  }
})

/**
 * Listen for Ready Event
 */
electron.app.on('ready', () => {
  if (!mainWindow) {
    setTimeout(createWindow, process.platform === 'linux' ? 1000 : 0)
  }
})

/**
 * Check if app is closed and quit it from running in the background
 */
electron.app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    electron.app.quit()
  }
})

/**
 * Check if we are already running this app
 */
 const instanceLock = electron.app.requestSingleInstanceLock()
 if (!instanceLock) {
   electron.app.quit()
 }
