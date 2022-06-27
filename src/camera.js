import * as PIXI from 'pixi.js';

import {
  canvasToFile,
  dataURLtoFile,
  getSystemInfo,
  CustomRequestAnimationFrame,
  getMediaDevices,
  openURLOnNewWindow,
  applyStreamToVideo,
  calcCanvasDrawScale,
  setElementToCanvas,
} from './utils.js';

// 事件管理器
class EventBus {
  constructor() {
    //定义事件总线对象
    this.eventList = {};
    this.store = new Map();
  }
  //监听，或者说是发布
  $on(event, fn, goodHorse) {
    let eventCallBacks = this.eventList[event];
    if (!eventCallBacks) {
      this.eventList[event] = (eventCallBacks = [])
    }
    eventCallBacks.push(fn)
    if (!goodHorse) {
      const args = this.store.get(event)
      if (args) {
        this.$emit(event, args)
      }
    }
  }
  //触发，订阅
  $emit(event, ...args) {
    this.eventList[event] && this.eventList[event].forEach(fn => {
      fn(...args)
    });
    this.store.set(event, args)
  }
  $off(event) {
    this.eventList[event] = null;
  }
}

class UserMedia {
  constructor(sync) {
    this.globalWindow = window
    // 媒体流相关句柄
    this._stream = undefined;
    this._track = undefined;
    this._imageCapture = undefined;
    // 请求媒体流相关约束
    this.CONSTRAINTS = {
      // audio: false,
      video: {
        facingMode: 'environment', // 选择摄像头
        // width: { ideal: 1280 }, // 纯数字简单值、ideal 理想值(不影响使用)，min/max、exact(即min=max) 强制值(无法响应该值时抛出异常)
        // height: { ideal: 720 }
        width: 1920,
        height: 1080,
        zoom: 1,
        // width: 3840,
        // height: 2160,
      },
    }
    if (sync) {
      this.init()
    }
  };
  get stream() {
    return this._stream
  }
  set stream(stream) {
    this._stream = stream
  }
  get track() {
    if (!this._track) {
      this.track = this.stream.getVideoTracks()[0];
    }
    return this._track
  }
  set track(track) {
    this._track = track
  }
  get imageCapture() {
    if (!this._imageCapture) {
      // 如果存在ImageCapture则可以从该对象获取像素帧而不经过画布，由于是实验性api,未处理
      if ('ImageCapture' in this.globalWindow) {
        this.imageCapture = new ImageCapture(this.track);
      }
    }
    return this._imageCapture
  }
  set imageCapture(imageCapture) {
    this._imageCapture = imageCapture
  }
  setMediaConfig(config) {
    this.CONSTRAINTS = config
  }
  getCompetence() {
    const _this = this
    // 调用权限（打开摄像头功能）
    return getMediaDevices(_this.CONSTRAINTS).then(stream => {
      _this.stream = stream
      // _this.setZoom(6)
    })
  }
  checkZoom() {
    const capabilities = this.track.getCapabilities();
    // Check whether zoom is supported or not.
    return (!!capabilities.zoom)
  }
  /**
   * 原生放大API封装，兼容性不好
   * @param {number} value 放大倍数
   */
  async setZoom(value) {
    try {
      const a = await this.track.applyConstraints({ ['zoom']: value });
      console.info('applyConstraints() success: ', a);
    } catch (err) {
      console.error('applyConstraints() failed: ', err);
    }
  }
  async init() {
    const _this = this;
    try {
      await _this.getCompetence()
    } catch (err) {
      console.error('媒体流初始化失败: ', err);
    }
  }
  pause() {
    this.track.enabled = false
  }
  start() {
    this.track.enabled = true
  }
  stop() {
    this.track.stop();
  }
  queryPermission(permissions = []) {
    // const permissions = ['geolocation', 'notifications', 'camera'];
    const tasks = []
    for (let index = 0, len = permissions.length; index < len; index++) {
      const name = permissions[index];
      let promiseTemp = navigator.permissions
        .query({ name })
        .then((status) => {
          return {
            name: status.name,
            state: status.state
          };
        })
      tasks.push(promiseTemp)
    }
    return Promise.allsettled(tasks)
  }
  /**
   * ImageCapture实验性API使用示例
   * @returns Promise<grabFrame>
   */
  fetchImageData() {
    const track = _that.userMedia.track;
    const imageCapture = _that.userMedia.imageCapture;
    return new Promise((resolve, reject) => {
      if (track.readyState == 'live') {
        resolve(imageCapture.grabFrame());
      } else {
        reject('camera is stop !!!');
      }
    });
  }
}

function safeElement(el, tag) {
  if (el) {
    return el
  }
  return document.createElement(tag)
}
export class CameraImpl {

  constructor(canvasElement, shotElement, videoEl) {
    this.userMedia = new UserMedia()
    this.listener = new EventBus()
    this.canvasElement = safeElement(canvasElement, 'canvas')
    this.canvasContext = null
    this.shotElement = safeElement(shotElement, 'canvas')
    this.shotContext = null
    this.videoEl = safeElement(videoEl, 'video')
    // 摄像头配置
    this.config = {
      facingMode: 'environment', // 选择摄像头
      width: { ideal: 1280 }, // 纯数字简单值、ideal 理想值(不影响使用)，min/max、exact(即min=max) 强制值(无法响应该值时抛出异常)
      height: { ideal: 720 },
      // width: 1920,
      // height: 1080,
      zoom: 1,
      // pixelRatio: 1
      // width: 3840,
      // height: 2160,
    }
    // canvas2d config
    this.drawFrameConfig = { // videoToCanvas
      interval: undefined,
      // 使用requestAnimationFrame时防止短时间重复调用等配置
      diffTime: 90,
      prevTimestamp: 0,
    }
    // webgl config
    this.PixiHandle = {
      app: undefined,
      renderer: undefined,
      video: undefined
    }
    this.openWebGl = true;
    // this.openWebGl = false;
    this.draw = true;
    this.init()
  };
  init() {
    const _that = this;
    _that.openWindowListener();
    if (!_that.openWebGl) {
      _that.canvasContext = _that.canvasElement.getContext('2d');
      _that.shotContext = _that.shotElement.getContext('2d');
    }
    _that.userMedia.getCompetence()
      .then(() => {
        _that.listener.$emit('streamLoad')
        return applyStreamToVideo(_that.userMedia.stream, _that.videoEl)
      }).then(() => {
        _that.camerLoaded()
      }).catch(err => {
        console.log('媒体流初始化失败', err);
        _that.listener.$emit('streamLoadError', err)
      })
  }
  camerLoaded() {
    const _that = this
    const systemInfo = getSystemInfo();
    if (this.openWebGl) {
      this.initPixi(
        this.videoEl,
        this.canvasElement,
        systemInfo.clientWidth,
        systemInfo.clientHeight
      );
    } else {
      this.videoToCanvas();
    }
    _that.listener.$emit('initdone')
  }
  initPixi(videoEl, canvasCameraEl, width, height) {
    const videoWidth = videoEl.videoWidth;
    const videoHeight = videoEl.videoHeight;
    const dpr = window.devicePixelRatio;

    const app = new PIXI.Application({
      width: width,
      height: height,
      view: canvasCameraEl,
      resolution: dpr,
      antialias: true,
      preserveDrawingBuffer: true, // 保留缓冲区的imageData，对于获取像素和toDataURL必要
    });
    const video_texture = new PIXI.BaseTexture.from(videoEl, {
      scaleMode: PIXI.SCALE_MODES.NEAREST,
      resolution: dpr,
    });
    const texture = new PIXI.Texture(video_texture);
    const sprite = new PIXI.Sprite(texture);
    // sprite.position.set(app.stage.width / 2, app.stage.height / 2)
    console.log(app.stage.width, app.stage.height, 'position');
    app.stage.addChild(sprite);
    sprite.anchor.set(0.5); // 这会将原点设置为居中。(0.5)与(0.5, 0.5)相同。
    app.stage.position.set(app.stage.width / 2, app.stage.height / 2);
    // app.stage.position.set(0, 0);
    sprite.position.set(0, 0)
    app.renderer.resize(width, height);
    // app.renderer.autoDensity = true;
    this.PixiHandle.app = app;
    this.PixiHandle.video = sprite;
    this.PixiHandle.renderer = app.renderer;
  }
  setGlZoom() {
    const zoomVal = this.config.zoom
    const renderer = this.PixiHandle.renderer;
    const app = this.PixiHandle.app;
    const videoSprite = this.PixiHandle.video;
    videoSprite.scale.set(zoomVal, zoomVal);

    // videoSprite.position.set(x, y)
    // gsap.to(videoSprite, 0.5, {
    //   zoom: 2,
    //   // ease: Cubic.easeOut
    // })
  }
  /**
   * 从webgl获取像素数组,宽高从目标对象上(如精灵，舞台容器等)获取
   * @returns RGBA Array
   */
  glToPixel() {
    const renderer = this.PixiHandle.renderer;
    const pixels = renderer.plugins.extract.pixels(app.stage);
    const pixelArr = Uint8ClampedArray.from(pixels);
    // 像素数组在3200x2160时长度为一千余万
    // console.log(pixelArr.length);
    return pixelArr;
  }
  glToCanvas() {
    const renderer = this.PixiHandle.renderer;
    const app = this.PixiHandle.app;
    const newCanvasElement = renderer.plugins.extract.canvas(app.stage);
    // openURLOnNewWindow(base64);
    return newCanvasElement;
  }
  glToURL() {
    const renderer = this.PixiHandle.renderer;
    const app = this.this.PixiHandle.app;
    const base64 = renderer.plugins.extract.base64(app.stage);
    // openURLOnNewWindow(base64);
    return base64;
  }
  // video转印到Canvas,用于对ImageData做处理时的中间层
  /**
   * 1、获取当前时间点与程序开始执行时的时间差: timestamp
   *  videoToCanvas函数是作为requestAnimationFrame方法的回调函数使用的
   * 因此videoToCanvas函数的签名必须是(timestamp: number) => void
   */
  videoToCanvas() {
    const _that = this;
    return (function loop(timestamp) {
      if (_that.draw) {
        let scopDrawFrameConfig = _that.drawFrameConfig;
        let prevTimestamp = scopDrawFrameConfig.prevTimestamp;
        let diffTime = scopDrawFrameConfig.diffTime;
        // 当前时间-上次执行时间如果大于diffTime，那么执行动画，并更新上次执行时间
        if (timestamp - prevTimestamp > diffTime) {
          _that.drawFrameConfig.prevTimestamp = timestamp;
          const drawOptions = {
            target: _that.canvasContext,
            sourceEl: _that.videoEl,
            width: _that.videoEl.videoWidth,
            height: _that.videoEl.videoHeight,
            zoom: _that.config.zoom,
          };
          _that.canvasElement.height = _that.videoEl.videoHeight;
          _that.canvasElement.width = _that.videoEl.videoWidth;
          setElementToCanvas(drawOptions);
        }
        _that.drawFrameConfig.interval = CustomRequestAnimationFrame(loop);
      }
    })(0);
  }
  // canvas->base64
  shot() {
    const _that = this;
    if (!this.draw) {
      const setImageParams = {
        target: _that.shotContext,
        sourceEl: _that.videoEl,
        width: _that.videoEl.videoWidth,
        height: _that.videoEl.videoHeight,
      };
      _that.shotElement.height = _that.videoEl.videoHeight;
      _that.shotElement.width = _that.videoEl.videoWidth;
      setElementToCanvas(setImageParams);
    }

    // 获取图片base64链接
    var image = _that.shotElement.toDataURL('image/png');
    _that.imgSrc = image;
    return image;
  }
  // canvas->base64->file
  getImageFile(filename, extend) {
    const base64 = this.shot();
    const imgFile = dataURLtoFile(base64, filename, extend);
    return imgFile;
  }
  /**
   * 获取RGBA像素数组
   * @returns ImageData
   */
  getCanvasImageData() {
    var _this = this;
    let targetElment;
    let targetContext;
    targetElment = _this.canvasElement;
    targetContext = _this.canvasContext;
    var imageData = targetContext.getImageData(
      0,
      0,
      targetElment.width,
      targetElment.height
    );
    return imageData;
  }
  // 生成文件并返回
  canvasResizetoFile(
    quality = 0.95,
    type = 'image/jpg',
    file_name = 'image.jpg'
  ) {
    const that = this;
    const targetElment = that.config.zoom !== 1
      ? that.shotElement
      : that.canvasElement;
    return canvasToFile({
      canvasEl: targetElment,
      quality,
      type,
      file_name,
    });
  }
  setZoom(value) {
    const oldZoom = this.config.zoom
    if (oldZoom !== value) {
      this.config.zoom = value
      if (this.userMedia.checkZoom()) {
        this.userMedia.setZoom(value)
      } else {
        if (this.openWebGl) {
          // todo 缩放及重置起点
          this.setGlZoom()
        } else {
          // 在画布drwa时已经使用该zoom
        }
      }
    }
  }
  // 关闭摄像头
  stopNavigator() {
    this.draw && (this.draw = false);
    _that.drawFrameConfig.interval && clearTimeout(_that.drawFrameConfig.interval); // 当前仅按定时器停止
    this.userMedia.stop();
  }
  // 相机错误抛出
  camerError(error) {
    console.log(error, 'camera Error');
    this.listener.$emit('error', error);
  }
  // 目前仅监听窗口处于前/后台状态
  openWindowListener() {
    const that = this;
    that.listenerFun = that.listenerFun.bind(that); // 解决this指向和removeEventListener失效问题
    document.addEventListener('visibilitychange', that.listenerFun);
  }
  closeWindowListener() {
    const that = this;
    document.removeEventListener('visibilitychange', that.listenerFun);
  }
  // 页面前后台切换监听处理函数
  listenerFun(e) {
    const that = this;
    if (document.visibilityState == 'visible') {
      //do something
      that.onShow(e);
    }
    if (document.visibilityState == 'hidden') {
      //do something else
      that.onHiden(e);
    }
  }
  onHiden(e) {
    this.draw = false;
  }
  onShow(e) {
    this.draw = true;
    // this.videoEl.play();
  }
}