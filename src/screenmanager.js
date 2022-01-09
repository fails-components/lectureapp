export class ScreenManager {
  constructor(args) {
    this.inited = false
    this.nextotherscreenid = 0
    if (args && args.informScreenChange)
      this.informScreenChange = args.informScreenChange
  }

  isFullscreen() {
    /* console.log(
        'FS element',
        document.fullscreenElement,
        document.webkitFullscreenElement
      ) */
    if (document.fullscreenElement) return true
    else if (document.webkitFullscreenElement) return true
    return false
  }

  async exitFullscreen() {
    if (document.exitFullscreen) await document.exitFullscreen()
    else if (document.webkitExitFullscreen)
      await document.webkitExitFullscreen()
    else console.log('exit fullscreen failed')
  }

  async requestFullscreen() {
    if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen()
    else if (document.documentElement.webkitRequestFullscreen)
      await document.documentElement.webkitRequestFullscreen()
  }

  getScreens() {
    const cur = this.screens.currentScreen
    // console.log('get screens debug', this.screens)
    const retobj = this.screens.screens.map((el, index) => ({
      screen: el,
      isCurrent: el === cur,
      number: index,
      toggle: () => {
        if (document.documentElement.requestFullscreen)
          document.documentElement.requestFullscreen({ screen: el })
        else if (document.documentElement.webkitRequestFullscreen)
          document.documentElement.webkitRequestFullscree({ screen: el })
      }
    }))
    return retobj
  }

  async initializeScreenInfo() {
    if ('getScreens' in window) {
      // The Multi-Screen Window Placement API is supported.
      console.log('multi screen supported!')
      this.multiscreen = true
      try {
        this.screens = await window.getScreens()
      } catch (error) {
        console.log('getScreens fails', error)
        this.screens = {}
        this.screens.screens = [window.screen]
      }
      const isextended = window.screen.isExtended
      if (!this.inited) {
        window.screen.addEventListener('change', () => {
          if (isextended !== window.screen.isExtended)
            this.initializeScreenInfo(true)
        })
        document.addEventListener('fullscreenchange', () => {
          this.statusChanged()
        })
      }
    } else {
      console.log('multi screen unsupported!')
      this.multiscreen = false
      this.screens = {}
      this.screens.screens = [window.screen]
      if (!this.inited) {
        document.addEventListener('fullscreenchange', () => {
          this.statusChanged()
        })
      }
      window.screen.isExtended = false
    }
    // console.log('Available screens', this.screens)
    this.inited = true
    this.statusChanged()
  }

  statusChanged() {
    if (this.informScreenChange) this.informScreenChange()
  }

  async toggleFullscreen() {
    if (this.isFullscreen()) {
      await this.exitFullscreen()
      return { status: 'ready' }
    }
    await this.initializeScreenInfo()
    if (!window.screen.isExtended) {
      console.log('screen is not extended', this.screens)
      this.requestFullscreen()
      return { status: 'ready' }
    }
    const cur = this.screens.currentScreen

    const retobj = {
      screens: this.screens.screens.map((el, index) => ({
        screen: el,
        isCurrent: el === cur,
        number: index,
        toggle: () => {
          if (document.documentElement.requestFullscreen)
            document.documentElement.requestFullscreen({ screen: el })
          else if (document.documentElement.webkitRequestFullscreen)
            document.documentElement.webkitRequestFullscree({ screen: el })
        }
      })),
      status: 'selector'
    }

    return retobj
  }
}
