import "./styles.css";
import { CameraImpl } from '../camera.js';


export default class Camera extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      imgSrc: '',
      pixelRatio: 1,
      draw: true,
    };
    this.camerImpl = null;
    this.videoEl = React.createRef();
    this.canvasCamera = React.createRef();
    this.canvasShot = React.createRef();
  }
  componentDidMount() {
    this.init();
  }

  componentWillUnmount() {
    this.camerImpl.stopNavigator();
    this.camerImpl.closeWindowListener();
  }
  init() {
    const _that = this;
    _that.camerImpl = new CameraImpl(
      _that.canvasCamera,
      _that.canvasShot,
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
  }
  getCanvasImageData() {
    return this.camerImpl.getCanvasImageData();
  }
  canvasResizetoFile() {
    return this.camerImpl.canvasResizetoFile();
  }
  // 相机错误抛出
  camerError(error) {
    console.log(error, 'camera Error');
    this.$emit('error', error);
  }
  render() {
    const isShowCanvas = `display: ${this.state.draw ? 'block' : 'hidden'};`
    return (
      <div class="camera_outer">
        <canvas ref={this.canvasCamera} class="video-canvas-ctx" style={isShowCanvas}></canvas>
        <canvas ref={this.canvasShot} class="video-shot-ctx"></canvas>
        <video
          ref={this.videoEl}
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
        {this.state.imgSrc && (<div class="img_bg_camera">
          <img src={this.state.imgSrc} alt="" class="tx_img" />
        </div>)
        }
      </div>
    );
  }
}