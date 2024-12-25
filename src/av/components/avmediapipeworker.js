import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision'
class AVBackgroundRemover {
  static fragmentShaderCodeColor = `#version 300 es
  precision mediump float;
 
  uniform sampler2D image;
  uniform sampler2D mask;
   
  in vec2 texCoord;
  out vec4 fragColor;
  uniform vec4 backgroundColor;
   
  void main() {
     vec4 imageColor = texture(image, texCoord);
     float maskval = texture(mask, texCoord).r;
     float intval = smoothstep(0.6,0.85,maskval);
     fragColor = mix(backgroundColor,imageColor,intval);
  }`

  static fragmentShaderCodeBlur = `#version 300 es
  precision mediump float;
 
  uniform sampler2D image;
  uniform sampler2D mask;
   
  in vec2 texCoord;
  out vec4 fragColor;
   
  void main() {
     vec4 imageColor = texture(image, texCoord);
     float maskval = texture(mask, texCoord).r;
     float intval = smoothstep(0.6,0.85,maskval);
     imageColor = texture(image, texCoord);
     if (intval < 1.0) {
        vec2 texelSize = 1.0 / vec2(textureSize(image, 0));
        float intensity = (1.0 -intval);
        vec2 rad = texelSize * intensity * intensity * 20.5;
        // poor man's not so gaussian blur
        imageColor = texture(image, texCoord + vec2(rad.s, 0));
        imageColor += texture(image, texCoord + vec2(0, rad.t));
        imageColor += texture(image, texCoord + vec2(-rad.s, 0));
        imageColor += texture(image, texCoord + vec2(0, -rad.t));
        imageColor += texture(image, texCoord + 0.70710 * vec2(rad.s, rad.t));
        imageColor += texture(image, texCoord + 0.70710 * vec2(-rad.s, -rad.t));
        imageColor += texture(image, texCoord + 0.70710 * vec2(rad.s, -rad.t));
        imageColor += texture(image, texCoord + 0.70710 * vec2(-rad.s, rad.t));
        rad *= 2.0;
        imageColor += texture(image, texCoord + vec2(rad.s, 0));
        imageColor += texture(image, texCoord + vec2(0, rad.t));
        imageColor += texture(image, texCoord + vec2(-rad.s, 0));
        imageColor += texture(image, texCoord + vec2(0, -rad.t));
        imageColor += texture(image, texCoord + 0.70710 * vec2(rad.s, rad.t));
        imageColor += texture(image, texCoord + 0.70710 * vec2(-rad.s, -rad.t));
        imageColor += texture(image, texCoord + 0.70710 * vec2(rad.s, -rad.t));
        imageColor += texture(image, texCoord + 0.70710 * vec2(-rad.s, rad.t));
        imageColor*=1.0/16.0;
     }
     fragColor = imageColor;
  }`

  static vertexShaderCode = `#version 300 es
  in vec4 aPosition;
  in vec2 aTexCoord;
  out vec2 texCoord;
 
  void main() {
    gl_Position = aPosition;
    texCoord = aTexCoord;
  }
  `
  constructor(args) {
    this.mpworkid = args.mpworkid
    this.canvas = new OffscreenCanvas(320, 240)
    this.type = 'blur' // can be 'blur or 'color'
    this.color = { r: 1, g: 0, b: 0 }
    this.initGlObjects()

    this.segmenter = this.initSegmenter()
    this.segmenter.catch((error) => {
      console.log('Problem creating Image segmenter', error)
    })
  }

  initGlObjects() {
    try {
      const gl = this.canvas.getContext('webgl2')
      this.gl = gl
      // init shaders
      this.vShader = gl.createShader(gl.VERTEX_SHADER)
      gl.shaderSource(this.vShader, AVBackgroundRemover.vertexShaderCode)
      gl.compileShader(this.vShader)

      if (!gl.getShaderParameter(this.vShader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(this.vShader)
        throw new Error(
          `Could not compile BackgroundVertexShader program. \n\n${info}`
        )
      }
      this.fShaderColor = gl.createShader(gl.FRAGMENT_SHADER)
      gl.shaderSource(
        this.fShaderColor,
        AVBackgroundRemover.fragmentShaderCodeColor
      )
      gl.compileShader(this.fShaderColor)

      if (!gl.getShaderParameter(this.fShaderColor, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(this.fShaderColor)
        throw new Error(
          `Could not compile BackgroundFragmentShader Color program. \n\n${info}`
        )
      }

      this.fShaderBlur = gl.createShader(gl.FRAGMENT_SHADER)
      gl.shaderSource(
        this.fShaderBlur,
        AVBackgroundRemover.fragmentShaderCodeBlur
      )
      gl.compileShader(this.fShaderBlur)

      if (!gl.getShaderParameter(this.fShaderBlur, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(this.fShaderBlur)
        throw new Error(
          `Could not compile BackgroundFragmentShader Clur program. \n\n${info}`
        )
      }

      this.programColor = gl.createProgram()

      gl.attachShader(this.programColor, this.vShader)
      gl.attachShader(this.programColor, this.fShaderColor)

      gl.linkProgram(this.programColor)

      if (!gl.getProgramParameter(this.programColor, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(this.programColor)
        throw new Error(`Could not link Background program color. \n\n${info}`)
      }

      this.programBlur = gl.createProgram()

      gl.attachShader(this.programBlur, this.vShader)
      gl.attachShader(this.programBlur, this.fShaderBlur)

      gl.linkProgram(this.programBlur)

      if (!gl.getProgramParameter(this.programBlur, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(this.programBlur)
        throw new Error(`Could not link Background program blur. \n\n${info}`)
      }

      this.selectProgram()

      const texture = gl.createTexture()
      this.texture = texture

      const texturemask = gl.createTexture()
      this.texturemask = texturemask
      gl.bindTexture(gl.TEXTURE_2D, texturemask)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      gl.enableVertexAttribArray(this.posAttrLoc)
      this.posBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer)
      gl.vertexAttribPointer(this.posAttrLoc, 2, gl.FLOAT, false, 0, 0)

      const positions = [-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0]
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW
      )

      gl.enableVertexAttribArray(this.texCoordAttrLoc)
      this.texCoordBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
      gl.vertexAttribPointer(this.texCoordAttrLoc, 2, gl.FLOAT, false, 0, 0)

      const texCoords = [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0]
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(texCoords),
        gl.STATIC_DRAW
      )
    } catch (error) {
      console.log('MEDIAPIPE: error', error)
    }
  }

  selectProgram() {
    const gl = this.gl

    if (this.type === 'blur') this.program = this.programBlur
    else this.program = this.programColor
    gl.useProgram(this.program)

    this.imageLoc = gl.getUniformLocation(this.program, 'image')
    this.maskLoc = gl.getUniformLocation(this.program, 'mask')
    this.posAttrLoc = gl.getAttribLocation(this.program, 'aPosition')
    this.texCoordAttrLoc = gl.getAttribLocation(this.program, 'aTexCoord')

    if (this.type === 'color') {
      this.backColLoc = gl.getUniformLocation(this.program, 'backgroundColor')
      gl.uniform4f(
        this.backColLoc,
        this.color.r,
        this.color.g,
        this.color.b,
        1.0
      )
    }
  }

  async initSegmenter() {
    let wasmFileSet
    if (await FilesetResolver.isSimdSupported()) {
      wasmFileSet = {
        wasmLoaderPath: new URL(
          '../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js',
          import.meta.url
        ).pathname,
        wasmBinaryPath: new URL(
          '../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm',
          import.meta.url
        ).pathname
      }
    } else {
      wasmFileSet = {
        wasmLoaderPath: new URL(
          '../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js',
          import.meta.url
        ).pathname,
        wasmBinaryPath: new URL(
          '../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm',
          import.meta.url
        ).pathname
      }
    }

    return ImageSegmenter.createFromOptions(wasmFileSet, {
      baseOptions: {
        modelAssetPath: new URL(
          './models/selfie_segmenter_landscape.tflite',
          import.meta.url
        )
      },
      canvas: this.canvas,
      outputCategoryMask: false,
      outputConfidenceMasks: true,
      runningMode: 'VIDEO',
      delegate: 'GPU'
    })
  }

  async processFrame({ frame, requestid }) {
    try {
      const gl = this.gl
      // may be also add the frame to be keyed, well it is the same...
      if (
        frame.displayWidth !== this.canvas.width ||
        frame.displayHeight !== this.canvas.height
      ) {
        this.canvas.width = frame.displayWidth
        this.canvas.height = frame.displayHeight
        gl.viewport(0, 0, this.canvas.width, this.canvas.height)
      }
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame)

      const segmenter = await this.segmenter
      if (this.inprogress) await this.inprogress
      // TODO we need to make sure, that they are in order
      const { duration, timestamp, visibleRect, displayHeight, displayWidth } =
        frame

      const inprogress = new Promise((resolve, reject) => {
        segmenter.segmentForVideo(
          frame,
          timestamp,
          {},
          ({ confidenceMasks }) => {
            try {
              // now apply the mask to the image aka video frame
              if (this.type === 'blur') gl.useProgram(this.programBlur)
              else gl.useProgram(this.programColor)
              gl.uniform1i(this.imageLoc, 0)
              gl.uniform1i(this.maskLoc, 1)

              gl.activeTexture(gl.TEXTURE0)
              gl.bindTexture(gl.TEXTURE_2D, this.texture)
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
              gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_WRAP_S,
                gl.CLAMP_TO_EDGE
              )
              gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_WRAP_T,
                gl.CLAMP_TO_EDGE
              )
              gl.activeTexture(gl.TEXTURE1)
              const myMask = confidenceMasks[0]
              if (myMask.hasWebGLTexture()) {
                gl.bindTexture(gl.TEXTURE_2D, myMask.getAsWebGLTexture())
              } else if (myMask.hasUint8Array()) {
                gl.bindTexture(gl.TEXTURE_2D, this.texturemask)
                gl.texImage2D(
                  gl.TEXTURE_2D,
                  0,
                  gl.R8,
                  myMask.width,
                  myMask.height,
                  0,
                  gl.RED,
                  gl.UNSIGNED_BYTE,
                  myMask.getAsUint8Array(),
                  0
                )
              } else if (myMask.hasFloat32Array()) {
                gl.bindTexture(gl.TEXTURE_2D, this.texturemask)
                gl.texImage2D(
                  gl.TEXTURE_2D,
                  0,
                  gl.R32F,
                  myMask.width,
                  myMask.height,
                  0,
                  gl.RED,
                  gl.FLOAT,
                  myMask.getAsFloat32Array(),
                  0
                )
              }
              myMask.close()
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
              gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_WRAP_S,
                gl.CLAMP_TO_EDGE
              )
              gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_WRAP_T,
                gl.CLAMP_TO_EDGE
              )

              gl.clearColor(0.0, 0.5, 0.0, 1.0)
              gl.clear(gl.COLOR_BUFFER_BIT)
              gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

              avmpworker.sendMessage({
                // eslint-disable-next-line no-undef
                frame: new VideoFrame(this.canvas, {
                  duration,
                  timestamp,
                  visibleRect,
                  displayHeight,
                  displayWidth
                }),
                requestid
              })
              resolve()
            } catch (error) {
              console.log('processFrame SgV problem', error)
              resolve()
            }
          }
        )
      })
      this.inprogress = inprogress

      await inprogress
      frame.close()
    } catch (error) {
      console.log('Image problem 2', error)
      avmpworker.sendMessage({ frame, requestid })
    }
  }

  changeConfig({ color, type }) {
    let change = false
    if (type !== this.type) change = true
    if (type === 'blur' || type === 'color') {
      this.type = type
    }
    if (this.type === 'color' && color) change = true
    if (color) {
      const { r, g, b } = color
      this.color = { r: r / 255, g: g / 255, b: b / 255 }
    }
    if (change) {
      this.selectProgram()
    }
  }
}

class AVMediaPipeWorker {
  constructor(args) {
    this.onMessage = this.onMessage.bind(this)
    this.objects = {}
  }

  sendMessage(message) {
    const transfer = []
    if (message.frame) transfer.push(message.frame)
    globalThis.postMessage(message, transfer)
  }

  onMessage(event) {
    const task = event.data.task
    if (!event.data.mpworkid && task !== 'networkControl')
      throw new Error('no mpworkid specified')

    switch (task) {
      case 'openAVBackgroundRemover':
        {
          const newobj = new AVBackgroundRemover({
            mpworkid: event.data.mpworkid
          })
          this.objects[event.data.mpworkid] = newobj
        }
        break

      case 'processFrame':
        {
          const object = this.objects[event.data.mpworkid]
          if (object && event.data.frame) {
            object.processFrame({
              frame: event.data.frame,
              requestid: event.data.requestid
            })
          }
        }
        break

      case 'changeConfig':
        {
          const object = this.objects[event.data.mpworkid]
          if (object) {
            const { color, type } = event.data
            object.changeConfig({
              color,
              type
            })
          }
        }
        break

      case 'cleanUpObject':
        {
          const object = this.objects[event.data.mpworkid]
          if (object) {
            if (object.finalize) object.finalize()
            delete this.objects[event.data.mpworkid]
          }
        }
        break
      default:
        console.log('Unhandled message task (AVMediaPipeWorker):', task)
    }
  }
}

console.log('AVMediaPipeWorker inited')
const avmpworker = new AVMediaPipeWorker()
globalThis.addEventListener('message', avmpworker.onMessage)
console.log('AVMediaPipeWorker started')
