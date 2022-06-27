
/**
 * canvasEL.toBlob->new File
 * @param {Object} options  配置项
 * @param {HTMLCanvasElement} options.canvasEl  配置项
 * @param {number} options.quality  图像质量
 * @param {String} options.type  图像格式
 * @param {String} options.file_name  图像名称
 * @returns File
 */
export function canvasToFile({
  canvasEl,
  quality = 0.95,
  type = 'image/jpg',
  file_name = 'canvasToBlobFile'
}) {
  return new Promise((resolve, reject) => {
    canvasEl.toBlob(
      function (blob) {
        const file = new File([blob], file_name, { type: type });
        resolve(file);
      },
      type,
      quality
    );
  });
}

/**
 *  base64转文件
 * @param {String} dataurl base64
 * @param {String} filename 文件名
 * @param {String} ext 文件后缀扩展名
 * @returns File
 */
export function dataURLtoFile(dataurl, filename, ext) {
  var arr = dataurl.split(',');
  var mime = arr[0].match(/:(.*?);/)[1];
  if (ext) {
    mime = ext;
  }
  var bstr = Buffer.from(arr[1], 'base64');
  // var bstr = atob(arr[1]);
  var n = bstr.length;
  var u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * // 利用放大模式获取区域数据
 * @param {Object} frame 帧数据
 * @param {Number} zoom 放大倍数
 * @param {Object} clip_result 放大裁剪结果
 */
export function getDataCompute(frame = {}, zoom = 1) {
  const centerX = frame.width / 2;
  const centerY = frame.height / 2;
  let zoomW;
  let zoomH;
  if (zoom >= 1) {
    zoomW = Math.floor(frame.width / zoom);
    zoomH = Math.floor(frame.height / zoom);
  } else {
    zoomH = Math.floor(frame.height * zoom);
  }
  const stepY = frame.width * 4; // 二维数组换行时，在一维数组中Y值增量 即像素width
  const startX = (centerX - zoomW / 2 - 1) * 4; // 二维数组中每行的零到canvasStartX的距离在一维数组中的间隔值
  const startY = stepY * (centerY - zoomH / 2 - 1); // 二维数组中第canvasStartY行在一维数组中的起始index下标
  const get_width = zoomW * 4; // 根据要取的宽度乘以像素点rgba长度4后得出实际要取的像素宽度
  const canvasStart = startY + startX; // 从第canvasStartY行的canvasStartX位置开始读， 即rgba数组的起始点index

  const clip_result = {
    data: [],
    width: zoomW,
    height: zoomH,
  };
  const clamped = frame.data;
  for (var i = 0; i < zoomH; i++) {
    var zzz = canvasStart + i * stepY;
    // 当前下标
    let index = zzz;
    // 每行起点
    const current_x = index % stepY;
    let sX = startX - current_x;
    let eX = get_width;
    let rowSX = index + sX;
    let rowEX = index + eX;
    clip_result.data.push(...clamped.slice(rowSX, rowEX));
  }
  return clip_result;
}

export function getSystemInfo() {
  const screenInfo = window.screen;
  // 所以总结最全的兼容方式获取为
  const w =
    window.innerWidth ||
    document.documentElement.clientWidth ||
    document.body.clientWidth;
  const h =
    window.innerHeight ||
    document.documentElement.clientHeight ||
    document.body.clientHeight;
  const data = {
    pixelRatio: window.devicePixelRatio,
    orientation: screenInfo.orientation,
    windowWidth: screenInfo.availWidth,
    windowHeight: screenInfo.availHeight,
    screenWidth: screenInfo.width,
    screenHeight: screenInfo.height,
    clientWidth: w,
    clientHeight: h,
  };
  return data;
}
export function initCanvas(el) {
  let data = getSystemInfo();
  let width = data.windowWidth * data.pixelRatio;
  let height = data.windowHeight * data.pixelRatio;
  const canvasElement = el;
  const canvas = canvasElement.getContext('2d');
  canvasElement.width = width;
  canvasElement.height = height;
  canvas.scale(data.pixelRatio, data.pixelRatio);
}
// 获取到屏幕倒是是几倍屏。
export const getPixelRatio = function (context) {
  var backingStore =
    context.backingStorePixelRatio ||
    context.webkitBackingStorePixelRatio ||
    context.mozBackingStorePixelRatio ||
    context.msBackingStorePixelRatio ||
    context.oBackingStorePixelRatio ||
    context.backingStorePixelRatio ||
    1;
  return (window.devicePixelRatio || 1) / backingStore;
};

/**
 * 兼容式RequestAnimationFrame
 */
export const CustomRequestAnimationFrame = (function () {
  return (
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    function (callback) {
      // 当前仅按定时器停止
      return setTimeout(callback, 1000 / 30);
    }
  );
})();

/**
 * 调用权限（打开摄像头功能），并返回promise
 * @param {Object} constraints 媒体请求约束
 * @returns 媒体流stream
 */
export function getMediaDevices(constraints) {
  // 旧版本浏览器可能根本不支持mediaDevices，我们首先设置一个空对象
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }
  // 一些浏览器实现了部分mediaDevices，我们不能只分配一个对象
  // 使用getUserMedia，因为它会覆盖现有的属性。
  // 这里，如果缺少getUserMedia属性，就添加它。
  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
      // 首先获取现存的getUserMedia(如果存在)
      const getUserMedia =
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.getUserMedia;
      // 有些浏览器不支持，会返回错误信息
      // 保持接口一致
      if (!getUserMedia) {
        return Promise.reject(
          new Error('getUserMedia is not implemented in this browser')
        );
      }
      // 否则，使用Promise将调用包装到旧的navigator.getUserMedia
      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
  }
  return navigator
    .mediaDevices
    .getUserMedia(constraints)
}

export function openURLOnNewWindow(url) {
  const newWindow = window.open("", "_blank");
  const img = new Image();
  img.src = url;
  newWin.document.write(img.outerHTML);
  newWindow.opener = null
}
/**
 * 
 * @param {Object} stream 媒体流
 * @param {HTMLVideoElement} videoEl 应用媒体流的video 
 * @param {Object} options video元素设置
 * @param {Boolean} options.auto video元素立即播放
 * @param {Object} options.attrs video元素setAttribute对象字典
 * @returns 
 */
export function applyStreamToVideo(
  stream,
  videoEl,
  options = { auto: true, attrs: { playsinline: true } }
) {
  return new Promise((resolve, reject) => {
    const autoPlay = options.auto;
    const attrs = options.attrs;
    // 旧的浏览器可能没有srcObject
    if ('srcObject' in videoEl) {
      videoEl.srcObject = stream;
    } else {
      // 避免在新的浏览器中使用它，因为它正在被弃用。
      videoEl.src = window.URL.createObjectURL(stream);
    }
    // required to tell iOS safari we don't want fullscreen
    // videoEl.setAttribute('playsinline',true);
    for (const attr in attrs) {
      if (Object.hasOwnProperty.call(attrs, attr)) {
        videoEl.setAttribute(attr, attrs[attr]);
      }
    }
    videoEl.onloadedmetadata = function (e) {
      if (autoPlay) {
        console.log('paly');
        videoEl.play();
      }
      resolve(stream)
    };
    videoEl.onerror = function (e) {
      console.log('相机错误', e);
      reject(stream)
    };
  });
}

/**
 * 输入原图宽高，返回画布drawImage坐标参数（模拟放大）
 * @param {Object} calcOptions  
 * @param {number} calcOptions.width 现有宽度  
 * @param {number} calcOptions.height 现有高度  
 * @param {number} calcOptions.radio 缩放值  
 * @returns {Array} arr
 */
export function calcCanvasDrawScale({ width, height, radio }) {
  return [
    -width * ((radio - 1) / 2),
    -height * ((radio - 1) / 2),
    width * radio,
    height * radio,
  ];
}
/**
 * 绘制图片、video等元素到canvas
 * @param {Object} drawOptions
 * @param {HTMLCanvasElement} drawOptions.target 承载画布
 * @param {object} drawOptions.sourceEl 被使用资源
 * @param {number} drawOptions.zoom 放大倍数 
 * @param {number} drawOptions.width 被使用资源在画布上的宽 
 * @param {number} drawOptions.height 被使用资源在画布上的高
 *  
 */
export function setElementToCanvas({ target, sourceEl, zoom, width, height }) {
  if (zoom) {
    const drawPoint = calcCanvasDrawScale({
      width,
      height,
      radio: zoom,
    });
    target.drawImage(sourceEl, ...drawPoint);
  } else {
    target.drawImage(sourceEl, 0, 0, width, height);
  }
}

// ImageData切割模拟放大
function testZoom(frame) {
  const that = this;
  const imageData = that.getDataCompute(frame, ZoomConfig.zoom);
  // console.log(imageData);
  that.shotElement.width = imageData.width;
  that.shotElement.height = imageData.height;
  that.shotContext.putImageData(
    new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    ),
    0,
    0
  );
}