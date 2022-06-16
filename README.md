# Base_WebRTC_Camera
Simple camera example based on webrtc media stream


1、若对性能分辨率有强需求，可以通过启用webgl选项来启用gpu进行画布渲染；
2、模拟放大功能仅在非webgl下已实现(通过提高分辨率并截取区域)，webgl模式下由于采用了pixi.js,
  可以通过调整video获取的精灵缩放和调整起始点来实现；
