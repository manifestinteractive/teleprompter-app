/**
 * TelePrompter v1.2.0 - Browser-based TelePrompter with Remote Control
 * (c) 2021 Peter Schmalfeldt
 * License: https://github.com/manifestinteractive/teleprompter/blob/master/LICENSE
 */
const TelePrompter = (function () {
  /**
   * ==================================================
   * TelePrompter Settings
   * ==================================================
   */

  /* DOM Elements used by App */
  const $elm = {}

  /* App Settings */
  let emitTimeout
  let debug = false
  let initialized = false
  let isPlaying = false
  let remote
  let scrollDelay
  let socket
  let modalOpen = false
  let timeout
  let timer
  const timerExp = 10
  let timerGA
  const version = 'v1.2.0'

  /* Default App Settings */
  const defaultConfig = {
    backgroundColor: 'rgba(20, 20, 20, 0.92)',
    dimControls: true,
    flipX: false,
    flipY: false,
    fontSize: 60,
    pageSpeed: 35,
    pageScrollPercent: 0,
    textColor: 'rgba(255, 255, 255, 1)'
  }

  /* Custom App Settings */
  const config = Object.assign({}, defaultConfig)

  /**
   * ==================================================
   * TelePrompter Init Functions
   * ==================================================
   */

  /**
   * Bind Events to DOM Elements
   */
  function bindEvents () {
    // Cache DOM Elements
    $elm.article = $('article')
    $elm.backgroundColor = $('#background-color')
    $elm.body = $('body')
    $elm.buttonDimControls = $('.button.dim-controls')
    $elm.buttonFlipX = $('.button.flip-x')
    $elm.buttonFlipY = $('.button.flip-y')
    $elm.buttonPlay = $('.button.play')
    $elm.buttonRemote = $('.button.remote')
    $elm.buttonReset = $('.button.reset')
    $elm.closeModal = $('.close-modal')
    $elm.fontSize = $('.fontSize')
    $elm.gaInput = $('input[data-ga], textarea[data-ga], select[data-ga]')
    $elm.gaLinks = $('a[data-ga], button[data-ga]')
    $elm.header = $('header')
    $elm.headerContent = $('header h1, header nav')
    $elm.markerOverlay = $('.marker, .overlay')
    $elm.modal = $('#modal')
    $elm.remoteID = $('.remote-id')
    $elm.remoteURL = $('.remote-url')
    $elm.remoteControlModal = $('#remote-control-modal')
    $elm.speed = $('.speed')
    $elm.softwareUpdate = $('#software-update')
    $elm.teleprompter = $('#teleprompter')
    $elm.textColor = $('#text-color')
    $elm.window = $(window)

    // Bind Events
    $elm.backgroundColor.on('change.teleprompter', handleBackgroundColor)
    $elm.buttonDimControls.on('click.teleprompter', handleDim)
    $elm.buttonFlipX.on('click.teleprompter', handleFlipX)
    $elm.buttonFlipY.on('click.teleprompter', handleFlipY)
    $elm.buttonPlay.on('click.teleprompter', handlePlay)
    $elm.buttonRemote.on('click.teleprompter', handleRemote)
    $elm.buttonReset.on('click.teleprompter', handleReset)
    $elm.closeModal.on('click.teleprompter', handleCloseModal)
    $elm.gaInput.on('change.teleprompter', gaInput)
    $elm.gaLinks.on('click.teleprompter', gaLinks)
    $elm.textColor.on('change.teleprompter', handleTextColor)

    // Listen for Key Presses
    $elm.teleprompter.on('keyup.teleprompter', updateTeleprompter)
    $elm.teleprompter.on('blur.teleprompter', cleanTeleprompter)
    $elm.teleprompter.on('paste.teleprompter', function () {
      setTimeout(cleanTeleprompter, 100)
    })
    $elm.body.keydown(navigate)
  }

  /**
   * Check for Software Update
   */
  function checkForUpdate () {
    $.getJSON('https://raw.githubusercontent.com/manifestinteractive/teleprompter-app/main/package.json', function (data) {
      if (data && data.version !== version) {
        // Open Software Update Modal
        $('#latest-version').text(data.version)
        $elm.modal.css('display', 'flex')
        $elm.remoteControlModal.hide()
        $elm.softwareUpdate.show()
      }
    })
  }

  /**
   * Get Brightness of Color using HEX or RBG values
   */
  function getBrightness (color) {
    // Variables for red, green, blue values
    let r
    let g
    let b

    // Check the format of the color, HEX or RGB?
    if (color.match(/^rgb/)) {
      // If HEX --> store the red, green, blue values in separate variables
      const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/)

      r = rgb[1]
      g = rgb[2]
      b = rgb[3]
    } else {
      // If RGB --> Convert it to HEX
      const hex = +('0x' + color.slice(1).replace(color.length < 5 && /./g, '$&$&'))

      r = hex >> 16
      g = hex >> 8 & 255
      b = hex & 255
    }

    // HSP Color Brightness
    const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b))

    // Using the HSP value, determine whether the color is light or dark
    return (hsp > 127.5) ? 'text-light' : 'text-dark'
  };

  /**
   * Initialize TelePrompter
   */
  function init () {
    // Exit if already started
    if (initialized) {
      return
    }

    // Startup App
    bindEvents()
    initSettings()
    initUI()
    initRemote()
    checkForUpdate()

    // Track that we've started TelePrompter
    initialized = true

    if (debug) {
      console.log('[TP]', 'TelePrompter Initialized')
    }
  }

  /**
   * Initialize Remote
   */
  function initRemote () {
    // Connect to Remote if Provided
    const currentRemote = localStorage.getItem('teleprompter_remote_id')
    if (currentRemote && currentRemote.length === 6) {
      // Wait a second for socket to load
      setTimeout(function () {
        remoteConnect(currentRemote)
      }, 1000)
    }

    if (debug) {
      console.log('[TP]', 'Remote Initialized', currentRemote ? '( Remote ID: ' + currentRemote + ' )' : '( No Remote )')
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {}, timerExp)
    gaEvent('TP', 'Remote Initialized', currentRemote || 'No Remote')
  }

  /**
   * Initialize Settings ( Pull from URL First, then Local Storage )
   */
  function initSettings () {
    // Check if we've been here before and made changes
    if (localStorage.getItem('teleprompter_background_color')) {
      config.backgroundColor = localStorage.getItem('teleprompter_background_color')

      // Update UI with Custom Background Color
      $elm.backgroundColor.val(config.backgroundColor)
      $elm.backgroundColor[0].jscolor.fromString(config.backgroundColor)
      $elm.teleprompter.css('background-color', config.backgroundColor)
    } else {
      // Update UI with Default Background Color
      $elm.backgroundColor.val(defaultConfig.backgroundColor)
      $elm.backgroundColor[0].jscolor.fromString(defaultConfig.backgroundColor)
      $elm.teleprompter.css('background-color', defaultConfig.backgroundColor)
    }

    if (localStorage.getItem('teleprompter_dim_controls')) {
      config.dimControls = localStorage.getItem('teleprompter_dim_controls') === 'true'

      // Update Indicator
      if (config.dimControls) {
        $elm.buttonDimControls.removeClass('icon-eye-open').addClass('icon-eye-close')
      } else {
        $elm.buttonDimControls.removeClass('icon-eye-close').addClass('icon-eye-open')
      }
    }

    if (localStorage.getItem('teleprompter_flip_x')) {
      config.flipX = localStorage.getItem('teleprompter_flip_x') === 'true'

      // Update Indicator
      if (config.flipX) {
        $elm.buttonFlipX.addClass('active')
      }
    }

    if (localStorage.getItem('teleprompter_flip_y')) {
      config.flipY = localStorage.getItem('teleprompter_flip_y') === 'true'

      // Update Indicator
      if (config.flipY) {
        $elm.buttonFlipY.addClass('active')
      }
    }

    if (localStorage.getItem('teleprompter_fontSize')) {
      config.fontSize = localStorage.getItem('teleprompter_fontSize')
    }

    if (localStorage.getItem('teleprompter_speed')) {
      config.pageSpeed = localStorage.getItem('teleprompter_speed')
    }

    if (localStorage.getItem('teleprompter_text')) {
      $elm.teleprompter.html(localStorage.getItem('teleprompter_text'))
    }

    if (localStorage.getItem('teleprompter_text_color')) {
      config.textColor = localStorage.getItem('teleprompter_text_color')
      $elm.textColor.val(config.textColor)
      $elm.textColor[0].jscolor.fromString(config.textColor)
      $elm.teleprompter.css('color', config.textColor)

      const brightness = getBrightness(config.textColor)

      $elm.teleprompter.removeClass('text-light')
      $elm.teleprompter.removeClass('text-dark')
      $elm.teleprompter.addClass(brightness)
    } else {
      $elm.textColor.val(defaultConfig.textColor)
      $elm.textColor[0].jscolor.fromString(defaultConfig.textColor)
      $elm.teleprompter.css('color', defaultConfig.textColor)

      const brightness = getBrightness(defaultConfig.textColor)

      $elm.teleprompter.removeClass('text-light')
      $elm.teleprompter.removeClass('text-dark')
      $elm.teleprompter.addClass(brightness)
    }

    cleanTeleprompter()
    $('p:empty', $elm.teleprompter).remove()

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {}, timerExp)
    gaEvent('TP', 'Settings Initialized')
  }

  /**
   * Initialize UI
   */
  function initUI () {
    // Create Timer
    timer = $('.clock').timer({
      stopVal: 10000,
      onChange: function (time) {
        if (socket && remote) {
          socket.emit('clientCommand', 'updateTime', time)
        }
      }
    })

    // Update Flip text if Present
    if (config.flipX && config.flipY) {
      $elm.teleprompter.addClass('flip-xy')
    } else if (config.flipX) {
      $elm.teleprompter.addClass('flip-x')
    } else if (config.flipY) {
      $elm.teleprompter.addClass('flip-y')
    }

    // Setup GUI
    $elm.article.stop().animate({
      scrollTop: 0
    }, 100, 'linear', function () {
      $elm.article.clearQueue()
    })

    // Set Overlay and TelePrompter Defaults
    $elm.markerOverlay.fadeOut(0)
    $elm.teleprompter.css({
      'padding-bottom': Math.ceil($elm.window.height() - $elm.header.height()) + 'px'
    })

    // Create Font Size Slider
    $elm.fontSize.slider({
      min: 12,
      max: 100,
      value: config.fontSize,
      orientation: 'horizontal',
      range: 'min',
      animate: true,
      slide: function () {
        updateFontSize(true)
      },
      change: function () {
        updateFontSize(true)
      }
    })

    // Create Speed Slider
    $elm.speed.slider({
      min: 0,
      max: 50,
      value: config.pageSpeed,
      orientation: 'horizontal',
      range: 'min',
      animate: true,
      slide: function () {
        updateSpeed(true)
      },
      change: function () {
        updateSpeed(true)
      }
    })

    // Run initial configuration on sliders
    if (config.fontSize !== defaultConfig.fontSize) {
      updateFontSize(false)
    }

    if (config.pageSpeed !== defaultConfig.pageSpeed) {
      updateSpeed(false)
    }

    // Clean up Empty Paragraph Tags
    $('p:empty', $elm.teleprompter).remove()

    // Update UI with Ready Class
    $elm.teleprompter.addClass('ready')

    if (debug) {
      console.log('[TP]', 'UI Initialized')
    }
  }

  /**
   * ==================================================
   * Core Functions
   * ==================================================
   */

  /**
   * Clean Teleprompter
   */
  function cleanTeleprompter () {
    let text = $elm.teleprompter.html()
    text = text.replace(/<br>+/g, '@@').replace(/@@@@/g, '</p><p>')
    text = text.replace(/@@/g, '<br>')
    text = text.replace(/([a-z])\. ([A-Z])/g, '$1.&nbsp;&nbsp; $2')
    text = text.replace(/<p><\/p>/g, '')

    if (text && text.substr(0, 3) !== '<p>') {
      text = '<p>' + text + '</p>'
    }

    // Final Cleanup to strip out any HTML that is not a P or BR tag
    text = text.replace(/(<\/?(?:p|br)[^>]*>)|<[^>]+>/ig, '$1')

    $elm.teleprompter.html(text)
    $('p:empty', $elm.teleprompter).remove()
  }

  /**
   * Setup Events using Google Analytics
   * @param category
   * @param action
   * @param label
   * @param value
   */
  function gaEvent (category, action, label, value) {
    if (typeof gtag !== 'undefined') {
      gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value
      })
    }

    if (debug) {
      console.log('[GA]', category, action, label, value)
    }
  }

  /**
   * Setup Google Analytics on Links
   * @param event
   */
  function gaLinks (event) {
    let data

    if (typeof event.target !== 'undefined' && typeof event.target.dataset !== 'undefined' && typeof event.target.dataset.ga !== 'undefined') {
      data = event.target.dataset
    } else if (typeof event.target !== 'undefined' && typeof event.target.parentNode !== 'undefined' && typeof event.target.parentNode.dataset !== 'undefined' && typeof event.target.parentNode.dataset.track !== 'undefined') {
      data = event.target.parentNode.dataset
    }

    if (typeof data === 'object' && typeof data.category === 'string' && typeof data.action === 'string' && typeof data.label === 'string') {
      gaEvent(data.category, data.action, data.label, data.value)
    }
  }

  /**
   * Setup Google Analytics on Input
   * @param event
   */
  function gaInput (event) {
    let data

    if (typeof event.target !== 'undefined' && typeof event.target.dataset !== 'undefined' && typeof event.target.dataset.ga !== 'undefined') {
      data = event.target.dataset
    } else if (typeof event.target !== 'undefined' && typeof event.target.parentNode !== 'undefined' && typeof event.target.parentNode.dataset !== 'undefined' && typeof event.target.parentNode.dataset.track !== 'undefined') {
      data = event.target.parentNode.dataset
    }

    if (typeof data === 'object' && typeof data.category === 'string' && typeof data.action === 'string') {
      gaEvent(data.category, data.action, event.target.value, event.target.value.length)
    }
  }

  /**
   * Get App Config
   * @param {String} key
   * @returns Object
   */
  function getConfig (key) {
    return key ? config[key] : config
  }

  /**
   * Handle Background Color
   */
  function handleBackgroundColor () {
    config.backgroundColor = $elm.backgroundColor.val()

    $elm.teleprompter.css('background-color', config.backgroundColor)
    localStorage.setItem('teleprompter_background_color', config.backgroundColor)

    if (socket && remote) {
      clearTimeout(emitTimeout)
      emitTimeout = setTimeout(function () {
        socket.emit('clientCommand', 'updateConfig', config)
      }, timerExp)
    }

    if (debug) {
      console.log('[TP]', 'Background Color Changed:', config.backgroundColor)
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {}, timerExp)
    gaEvent('TP', 'Background Color Changed', config.backgroundColor)
  }

  /**
   * Handle Closing Modal
   */
  function handleCloseModal () {
    // Reset Focus on Remote Button if needed
    if ($elm.remoteControlModal.is(':visible')) {
      $elm.buttonRemote.focus()
    }

    $elm.modal.hide()
    $elm.remoteControlModal.hide()
    $elm.softwareUpdate.hide()

    modalOpen = false
  }

  /**
   * Handle Dimming Layovers
   * @param {Object} evt
   * @param {Boolean} skipUpdate
   */
  function handleDim (evt, skipUpdate) {
    if (config.dimControls) {
      config.dimControls = false
      $elm.buttonDimControls.removeClass('icon-eye-close').addClass('icon-eye-open')
      $elm.headerContent.fadeTo('slow', 1)
      $elm.markerOverlay.fadeOut('slow')
    } else {
      config.dimControls = true
      $elm.buttonDimControls.removeClass('icon-eye-open').addClass('icon-eye-close')

      if (isPlaying) {
        $elm.headerContent.fadeTo('slow', 0.15)
        $elm.markerOverlay.fadeIn('slow')
      }
    }

    localStorage.setItem('teleprompter_dim_controls', config.dimControls)

    if (socket && remote && !skipUpdate) {
      clearTimeout(emitTimeout)
      emitTimeout = setTimeout(function () {
        socket.emit('clientCommand', 'updateConfig', config)
      }, timerExp)
    }

    if (debug) {
      console.log('[TP]', 'Dim Control Changed:', config.dimControls)
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {
      gaEvent('TP', 'Dim Control Changed', config.dimControls)
    }, timerExp)
  }

  /**
   * Handle Flipping Text Horizontally
   * @param {Object} evt
   * @param {Boolean} skipUpdate
   */
  function handleFlipX (evt, skipUpdate) {
    timer.resetTimer()

    if (socket && remote) {
      socket.emit('clientCommand', 'updateTime', '00:00:00')
    }

    // Remove Flip Classes
    $elm.teleprompter.removeClass('flip-x').removeClass('flip-xy')

    if (config.flipX) {
      config.flipX = false

      $elm.buttonFlipX.removeClass('active')
    } else {
      config.flipX = true

      $elm.buttonFlipX.addClass('active')

      if (config.flipY) {
        $elm.teleprompter.addClass('flip-xy')
      } else {
        $elm.teleprompter.addClass('flip-x')
      }
    }

    localStorage.setItem('teleprompter_flip_x', config.flipX)

    if (socket && remote && !skipUpdate) {
      clearTimeout(emitTimeout)
      emitTimeout = setTimeout(function () {
        socket.emit('clientCommand', 'updateConfig', config)
      }, timerExp)
    }

    if (debug) {
      console.log('[TP]', 'Flip X Changed:', config.flipX)
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {
      gaEvent('TP', 'Flip X Changed', config.flipX)
    }, timerExp)
  }

  /**
   * Handle Flipping Text Vertically
   * @param {Object} evt
   * @param {Boolean} skipUpdate
   */
  function handleFlipY (evt, skipUpdate) {
    timer.resetTimer()

    if (socket && remote) {
      socket.emit('clientCommand', 'updateTime', '00:00:00')
    }

    // Remove Flip Classes
    $elm.teleprompter.removeClass('flip-y').removeClass('flip-xy')

    if (config.flipY) {
      config.flipY = false

      $elm.buttonFlipY.removeClass('active')
    } else {
      config.flipY = true

      $elm.buttonFlipY.addClass('active')

      if (config.flipX) {
        $elm.teleprompter.addClass('flip-xy')
      } else {
        $elm.teleprompter.addClass('flip-y')
      }
    }

    localStorage.setItem('teleprompter_flip_y', config.flipY)

    if (config.flipY) {
      $elm.article.stop().animate({
        scrollTop: $elm.teleprompter.height() + 100
      }, 250, 'swing', function () {
        $elm.article.clearQueue()
      })
    } else {
      $elm.article.stop().animate({
        scrollTop: 0
      }, 250, 'swing', function () {
        $elm.article.clearQueue()
      })
    }

    if (socket && remote && !skipUpdate) {
      clearTimeout(emitTimeout)
      emitTimeout = setTimeout(function () {
        socket.emit('clientCommand', 'updateConfig', config)
      }, timerExp)
    }

    if (debug) {
      console.log('[TP]', 'Flip Y Changed:', config.flipY)
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {
      gaEvent('TP', 'Flip Y Changed', config.flipY)
    }, timerExp)
  }

  /**
   * Handle Updating Text Color
   */
  function handleTextColor () {
    config.textColor = $elm.textColor.val()

    $elm.teleprompter.css('color', config.textColor)
    localStorage.setItem('teleprompter_text_color', config.textColor)

    const brightness = getBrightness(config.textColor)

    $elm.teleprompter.removeClass('text-light')
    $elm.teleprompter.removeClass('text-dark')
    $elm.teleprompter.addClass(brightness)

    if (socket && remote) {
      clearTimeout(emitTimeout)
      emitTimeout = setTimeout(function () {
        socket.emit('clientCommand', 'updateConfig', config)
      }, timerExp)
    }

    if (debug) {
      console.log('[TP]', 'Text Color Changed:', config.textColor)
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {
      gaEvent('TP', 'Text Color Changed', config.textColor)
    }, timerExp)
  }

  /**
   * Handle Play Button Press
   */
  function handlePlay () {
    if (!isPlaying) {
      startTeleprompter()
    } else {
      stopTeleprompter()
    }
  }

  /**
   * Handle Remote Button Press
   */
  function handleRemote () {
    if (!socket && !remote) {
      const currentRemote = localStorage.getItem('teleprompter_remote_id')
      remoteConnect(currentRemote)
    } else {
      $elm.modal.css('display', 'flex')
      $elm.remoteControlModal.show()
      $elm.softwareUpdate.hide()
    }

    $elm.buttonRemote.blur()
    modalOpen = true

    if (debug) {
      console.log('[TP]', 'Remote Button Pressed')
    }
  }

  /**
   * Handle Reset Button Press
   */
  function handleReset () {
    stopTeleprompter()
    timer.resetTimer()

    config.pageScrollPercent = 0

    $elm.article.stop().animate({
      scrollTop: 0
    }, 100, 'linear', function () {
      $elm.article.clearQueue()
    })

    if (socket && remote) {
      socket.emit('clientCommand', 'updateTime', '00:00:00')
      clearTimeout(emitTimeout)
      emitTimeout = setTimeout(function () {
        socket.emit('clientCommand', 'updateConfig', config)
      }, timerExp)
    }

    if (debug) {
      console.log('[TP]', 'Reset Button Pressed')
    }
  }

  /**
   * Listen for Keyboard Navigation
   * @param {Object} evt
   * @returns Boolean
   */
  function navigate (evt) {
    const space = 32
    const escape = 27
    const left = 37
    const up = 38
    const right = 39
    const down = 40
    const pageUp = 33
    const pageDown = 34
    const bKey = 66
    const f5Key = 116
    const periodKey = 190
    const tab = 9
    const speed = $elm.speed.slider('value')
    const fontSize = $elm.fontSize.slider('value')

    // Allow text edit if we're inside an input field or tab key press
    if (evt.target.id === 'teleprompter' || evt.keyCode === tab) {
      return
    }

    // Check if Escape Key and Modal Open
    if (evt.keyCode === escape && modalOpen) {
      if ($elm.remoteControlModal.is(':visible')) {
        $elm.buttonRemote.focus()
      }

      $elm.modal.hide()
      modalOpen = false
      evt.preventDefault()
      evt.stopPropagation()
      return false
    }

    // Skip if UI element or Modal Open
    if (modalOpen || evt.target.nodeName === 'INPUT' || evt.target.nodeName === 'BUTTON' || evt.target.nodeName === 'A' || evt.target.nodeName === 'SPAN') {
      return
    }

    // Reset GUI
    if (evt.keyCode === escape) {
      $elm.buttonReset.trigger('click')
      evt.preventDefault()
      evt.stopPropagation()
      return false
    } else if (evt.keyCode === space || [bKey, f5Key, periodKey].includes(evt.keyCode)) {
      // Start Stop Scrolling
      $elm.buttonPlay.trigger('click')
      evt.preventDefault()
      evt.stopPropagation()
      return false
    } else if (evt.keyCode === left || evt.keyCode === pageUp) {
      // Decrease Speed
      $elm.speed.slider('value', speed - 1)
      evt.preventDefault()
      evt.stopPropagation()
      return false
    } else if (evt.keyCode === down) {
      // Decrease Font Size
      $elm.fontSize.slider('value', fontSize - 1)
      evt.preventDefault()
      evt.stopPropagation()
      return false
    } else if (evt.keyCode === up) {
      // Increase Font Size
      $elm.fontSize.slider('value', fontSize + 1)
      evt.preventDefault()
      evt.stopPropagation()
      return false
    } else if (evt.keyCode === right || evt.keyCode === pageDown) {
      // Increase Speed
      $elm.speed.slider('value', speed + 1)
      evt.preventDefault()
      evt.stopPropagation()
      return false
    }
  }

  /**
   * Manage Scrolling Teleprompter
   */
  function pageScroll () {
    const offset = 1
    const animate = 0

    if (config.pageSpeed === 0) {
      $elm.article.stop().clearQueue()
      clearTimeout(scrollDelay)
      scrollDelay = setTimeout(pageScroll, 500)
      return
    }

    clearTimeout(scrollDelay)
    scrollDelay = setTimeout(pageScroll, Math.floor(50 - config.pageSpeed))

    if ($elm.teleprompter.hasClass('flip-y')) {
      $elm.article.stop().animate({
        scrollTop: '-=' + offset + 'px'
      }, animate, 'linear', function () {
        $elm.article.clearQueue()
      })

      // We're at the bottom of the document, stop
      if ($elm.article.scrollTop() === 0) {
        stopTeleprompter()
        setTimeout(function () {
          $elm.article.stop().animate({
            scrollTop: $elm.teleprompter.height() + 100
          }, 500, 'swing', function () {
            $elm.article.clearQueue()
          })
        }, 500)
      }
    } else {
      $elm.article.stop().animate({
        scrollTop: '+=' + offset + 'px'
      }, animate, 'linear', function () {
        $elm.article.clearQueue()
      })

      // We're at the bottom of the document, stop
      if ($elm.article.scrollTop() >= (($elm.article[0].scrollHeight - $elm.window.height()) - 100)) {
        stopTeleprompter()
        setTimeout(function () {
          $elm.article.stop().animate({
            scrollTop: 0
          }, 500, 'swing', function () {
            $elm.article.clearQueue()
          })
        }, 500)
      }
    }

    // Update pageScrollPercent
    clearTimeout(timeout)
    timeout = setTimeout(function () {
      $elm.win = $elm.article[0]
      const scrollHeight = $elm.win.scrollHeight
      const scrollTop = $elm.win.scrollTop
      const clientHeight = $elm.win.clientHeight

      config.pageScrollPercent = Math.round(((scrollTop / (scrollHeight - clientHeight)) + Number.EPSILON) * 100)

      if (socket && remote) {
        clearTimeout(emitTimeout)
        emitTimeout = setTimeout(function () {
          socket.emit('clientCommand', 'updateConfig', config)
        }, timerExp)
      }
    }, animate)
  }

  /**
   * Create Random String for Remote
   * @returns string
   */
  function randomString () {
    const chars = '3456789ABCDEFGHJKLMNPQRSTUVWXY'
    const length = 6
    let string = ''

    for (let i = 0; i < length; i++) {
      const num = Math.floor(Math.random() * chars.length)
      string += chars.substring(num, num + 1)
    }

    return string
  }

  /**
   * Connect to Remote
   * @param {String} currentRemote Current Remote ID
   */
  function remoteConnect (currentRemote) {
    if (typeof io === 'undefined') {
      $elm.buttonRemote.removeClass('active')
      localStorage.removeItem('teleprompter_remote_id')
      return
    }

    socket = io.connect('https://promptr.tv', { path: '/remote/socket.io' })

    remote = (currentRemote) || randomString()

    socket.on('connect', function () {
      const $code = document.getElementById('qr-code')
      $code.innerHTML = ''
      socket.emit('connectToRemote', 'REMOTE_' + remote)

      $elm.remoteURL.text('https://promptr.tv/remote')

      const url = 'https://promptr.tv/remote?id=' + remote

      const generateCode = new QRCode($code, url)
      $elm.remoteID.text(remote)

      if (!generateCode) {
        console.error('Failed to Generate QR Code')
      }

      if (!currentRemote) {
        $elm.modal.css('display', 'flex')
      }

      if (debug) {
        console.log('[IO]', 'Socket Connected')
      }

      clearTimeout(timerGA)
      timerGA = setTimeout(function () {
        gaEvent('IO', 'Socket Connected')
      }, timerExp)
    })

    socket.on('disconnect', function () {
      $elm.buttonRemote.removeClass('active')
      localStorage.removeItem('teleprompter_remote_id')

      if (debug) {
        console.log('[IO]', 'Socket Disconnected')
      }

      clearTimeout(timerGA)
      timerGA = setTimeout(function () {
        gaEvent('IO', 'Socket Disconnected')
      }, timerExp)
    })

    socket.on('connectedToRemote', function () {
      localStorage.setItem('teleprompter_remote_id', remote)
      $elm.buttonRemote.addClass('active')

      clearTimeout(emitTimeout)
      emitTimeout = setTimeout(function () {
        socket.emit('clientCommand', 'updateConfig', config)
      }, timerExp)

      if (debug) {
        console.log('[IO]', 'Remote Connected:', remote)
      }

      clearTimeout(timerGA)
      timerGA = setTimeout(function () {
        gaEvent('IO', 'Remote Connected', remote)
      }, timerExp)
    })

    socket.on('remoteControl', function (command, value) {
      if (debug) {
        console.log('[TP]', 'remoteControl', command, value)
      }

      clearTimeout(timerGA)
      timerGA = setTimeout(function () {
        gaEvent('IO', 'Remote Control', command)
      }, timerExp)

      switch (command) {
        case 'reset':
          handleReset()
          break

        case 'power':
          remoteDisconnect()
          break

        case 'play':
          $elm.buttonPlay.trigger('click')
          break

        case 'hideModal':
          $elm.modal.hide()
          break

        case 'getConfig':
          if (socket && remote) {
            clearTimeout(emitTimeout)
            emitTimeout = setTimeout(function () {
              socket.emit('clientCommand', 'updateConfig', config)
            }, timerExp)
          }
          break

        case 'updateConfig':
          clearTimeout(emitTimeout)
          remoteUpdate(config, value)
          break
      }
    })
  }

  /**
   * Disconnect from Remote
   */
  function remoteDisconnect () {
    if (socket && remote) {
      socket.disconnect()
      remote = null
    }

    if (debug) {
      console.log('[IO]', 'Remote Disconnected')
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {
      gaEvent('IO', 'Remote Disconnected')
    }, timerExp)
  }

  /**
   * Handle Updates from Remote
   * @param {Object} oldConfig
   * @param {Object} newConfig
   */
  function remoteUpdate (oldConfig, newConfig) {
    if (debug) {
      console.log('[IO]', 'Remote Update')
      console.log('[IO]', 'Old Config:', oldConfig)
      console.log('[IO]', 'New Config:', newConfig)
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {
      gaEvent('IO', 'Remote Update')
    }, timerExp)

    if (oldConfig.dimControls !== newConfig.dimControls) {
      handleDim(null, true)
    }

    if (oldConfig.flipX !== newConfig.flipX) {
      handleFlipX(null, true)
    }

    if (oldConfig.flipY !== newConfig.flipY) {
      handleFlipY(null, true)
    }

    if (oldConfig.fontSize !== newConfig.fontSize) {
      $elm.fontSize.slider('value', newConfig.fontSize)
      updateFontSize(true, true)
    }

    if (oldConfig.pageSpeed !== newConfig.pageSpeed) {
      $elm.speed.slider('value', newConfig.pageSpeed)
      updateSpeed(true, true)
    }

    if (oldConfig.pageScrollPercent !== newConfig.pageScrollPercent) {
      config.pageScrollPercent = newConfig.pageScrollPercent

      stopTeleprompter()

      $elm.win = $elm.article[0]
      const scrollHeight = $elm.win.scrollHeight
      const clientHeight = $elm.win.clientHeight

      const maxScrollStop = (scrollHeight - clientHeight)
      const percent = parseInt(config.pageScrollPercent) / 100
      const newScrollTop = maxScrollStop * percent

      $elm.article.stop().animate({
        scrollTop: newScrollTop + 'px'
      }, 0, 'linear', function () {
        $elm.article.clearQueue()
      })
    }
  }

  /**
   * Start Teleprompter
   */
  function startTeleprompter () {
    // Check if Already Playing
    if (isPlaying) {
      return
    }

    if (socket && remote) {
      socket.emit('clientCommand', 'play')
    }

    $elm.teleprompter.attr('contenteditable', false)
    $elm.body.addClass('playing')
    $elm.buttonPlay.removeClass('icon-play').addClass('icon-pause')

    if (config.dimControls) {
      $elm.headerContent.fadeTo('slow', 0.15)
      $elm.markerOverlay.fadeIn('slow')
    }

    timer.startTimer()

    pageScroll()

    isPlaying = true

    if (debug) {
      console.log('[TP]', 'Starting TelePrompter')
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {
      gaEvent('TP', 'Starting TelePrompter')
    }, timerExp)
  }

  /**
   * Stop Teleprompter
   */
  function stopTeleprompter () {
    // Check if Already Stopped
    if (!isPlaying) {
      return
    }

    if (socket && remote) {
      socket.emit('clientCommand', 'stop')
    }

    clearTimeout(scrollDelay)
    $elm.teleprompter.attr('contenteditable', true)

    if (config.dimControls) {
      $elm.headerContent.fadeTo('slow', 1)
      $elm.markerOverlay.fadeOut('slow')
    }

    $elm.buttonPlay.removeClass('icon-pause').addClass('icon-play')
    $elm.body.removeClass('playing')

    timer.stopTimer()

    isPlaying = false

    if (debug) {
      console.log('[TP]', 'Stopping TelePrompter')
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {
      gaEvent('TP', 'Stopping TelePrompter')
    }, timerExp)
  }

  /**
   * Manage Font Size Change
   * @param {Boolean} save
   * @param {Boolean} skipUpdate
   */
  function updateFontSize (save, skipUpdate) {
    config.fontSize = $elm.fontSize.slider('value')

    $elm.teleprompter.css({
      'font-size': config.fontSize + 'px',
      'line-height': Math.ceil(config.fontSize * 1.5) + 'px',
      'padding-bottom': Math.ceil($elm.window.height() - $elm.header.height()) + 'px'
    })

    $('p', $elm.teleprompter).css({
      'padding-bottom': Math.ceil(config.fontSize * 0.25) + 'px',
      'margin-bottom': Math.ceil(config.fontSize * 0.25) + 'px'
    })

    $('label.fontSize_label > span').text('(' + config.fontSize + ')')

    if (save) {
      localStorage.setItem('teleprompter_fontSize', config.fontSize)
    }

    if (socket && remote && !skipUpdate) {
      clearTimeout(emitTimeout)
      emitTimeout = setTimeout(function () {
        socket.emit('clientCommand', 'updateConfig', config)
      }, timerExp)
    }

    if (debug) {
      console.log('[TP]', 'Font Size Changed:', config.fontSize)
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {
      gaEvent('TP', 'Font Size Changed', config.fontSize)
    }, timerExp)
  }

  /**
   * Manage Speed Change
   * @param {Boolean} save
   * @param {Boolean} skipUpdate
   */
  function updateSpeed (save, skipUpdate) {
    config.pageSpeed = $elm.speed.slider('value')
    $('label.speed_label > span').text('(' + $elm.speed.slider('value') + ')')

    if (save) {
      localStorage.setItem('teleprompter_speed', $elm.speed.slider('value'))
    }

    if (socket && remote && !skipUpdate) {
      clearTimeout(emitTimeout)
      emitTimeout = setTimeout(function () {
        socket.emit('clientCommand', 'updateConfig', config)
      }, timerExp)
    }

    if (debug) {
      console.log('[TP]', 'Page Speed Changed:', config.pageSpeed)
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {
      gaEvent('TP', 'Page Speed Changed', config.pageSpeed)
    }, timerExp)
  }

  /**
   * Update Teleprompter Text
   * @param {Object} evt
   * @returns Boolean
   */
  function updateTeleprompter (evt) {
    // Ignore Navigation Keys
    if ((evt.keyCode <= 33 && evt.keyCode >= 40) || evt.keyCode === 91 || evt.keyCode === 16) {
      return
    }

    if (evt.keyCode === 27) {
      $elm.teleprompter.blur()
      evt.preventDefault()
      evt.stopPropagation()
      return false
    }

    localStorage.setItem('teleprompter_text', $elm.teleprompter.html())

    if (debug) {
      console.log('[TP]', 'TelePrompter Text Updated')
    }

    clearTimeout(timerGA)
    timerGA = setTimeout(function () {
      gaEvent('TP', 'TelePrompter Text Updated')
    }, timerExp)
  }

  /* Expose Select Control to Public TelePrompter Object */
  return {
    version: version,
    init: init,
    getConfig: getConfig,
    start: startTeleprompter,
    stop: stopTeleprompter,
    reset: handleReset,
    setDebug: function (bool) {
      debug = !!bool
      return this
    },
    setSpeed: function (speed) {
      speed = Math.min(50, Math.max(0, speed))
      $elm.speed.slider('value', parseInt(speed))
      return this
    },
    setFontSize: function (size) {
      size = Math.min(100, Math.max(12, size))
      $elm.fontSize.slider('value', parseInt(size))
      return this
    },
    setDim: function (bool) {
      config.dimControls = !bool
      handleDim()
      return this
    },
    setFlipX: function (bool) {
      config.flipX = !bool
      handleFlipX()
      return this
    },
    setFlipY: function (bool) {
      config.flipY = !bool
      handleFlipY()
      return this
    }
  }
})()
