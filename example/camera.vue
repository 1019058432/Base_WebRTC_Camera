<template>
  <div class="camera_outer">
    <canvas v-show="draw" id="canvasCamera" class="video-canvas-ctx"></canvas>
    <canvas id="canvasShot" class="video-shot-ctx"></canvas>
    <video
      ref="videoCamera"
      class="video-ctx"
      style="
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        border: none;
        object-fit: cover;
      "
      autoplay
    ></video>
    <div v-if="imgSrc" class="img_bg_camera">
      <img :src="imgSrc" alt="" class="tx_img" />
    </div>
  </div>
</template>
<script>
import { CameraImpl } from '../camera.js';

export default {
  name: 'camera',
  data() {
    return {
      imgSrc: '',
      pixelRatio: 1,
      draw: true,
      camerImpl: null,
    };
  },
  created() {},
  mounted() {
    this.videoEl = this.$refs['videoCamera'];
    this.canvasElement = document.getElementById('canvasCamera');
    this.shotElement = document.getElementById('canvasShot');
    this.init();
  },
  methods: {
    init() {
      const _that = this;
      _that.camerImpl = new CameraImpl(
        _that.canvasElement,
        _that.shotElement,
        _that.videoEl
      );
      const camerImplListener = _that.camerImpl.listener;
      camerImplListener.$on('initdone', () => {
        _that.$emit('initdone', _that);
      });
      camerImplListener.$on('streamLoadError', (err) => {
        console.log('媒体流初始化失败: ', err);
        _that.camerError(err);
      });
      camerImplListener.$on('error', (err) => {
        console.log('camer error: ', err);
        _that.camerError(err);
      });
    },
    getCanvasImageData() {
      return this.camerImpl.getCanvasImageData();
    },
    canvasResizetoFile() {
      return this.camerImpl.canvasResizetoFile();
    },
    // 相机错误抛出
    camerError(error) {
      console.log(error, 'camera Error');
      this.$emit('error', error);
    },
  },
  beforeDestroy() {
    this.camerImpl.stopNavigator();
    this.camerImpl.closeWindowListener();
  },
};
</script>

<style scoped>
.video-canvas-ctx {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  z-index: 1;
}
.video-shot-ctx {
  position: fixed;
  /* left: 100vw; */
  top: 0;
  height: 100vh;
  left: 0;
  z-index: 2;
}
.video-ctx {
  position: fixed;
  width: 100%;
  top: 0;
  left: 100vw;
  /* z-index: 10; */
}
.camera_outer {
  margin: 0;
}
</style>
