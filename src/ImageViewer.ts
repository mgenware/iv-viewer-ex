import {
  createElement,
  addClass,
  removeClass,
  css,
  removeCss,
  wrap,
  unwrap,
  remove,
  easeOutQuart,
  clamp,
  assignEvent,
  getTouchPointsDistance,
  ZOOM_CONSTANT,
  MOUSE_WHEEL_COUNT,
  mustQuerySelector,
} from './util';
import * as imgLoadedProxy from 'imagesloaded';
// Fix F* dumb rollup cannot handle typescript export
const imgLoaded: ImagesLoaded.ImagesLoadedConstructor =
  // tslint:disable-next-line no-any
  (imgLoadedProxy as any).default || imgLoadedProxy;

import Slider, { SliderPosition } from './Slider';

const imageViewHtml = `
  <div class="iv-loader"></div>
  <div class="iv-snap-view">
    <div class="iv-snap-image-wrap">
      <div class="iv-snap-handle"></div>
    </div>
    <div class="iv-zoom-slider">
      <div class="iv-zoom-handle"></div>
    </div>
  </div>
  <div class="iv-image-view" >
    <div class="iv-image-wrap" ></div>
  </div>
`;
const DATA_VIEWER = '_image_viewer';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface ImageViewerOptions {
  zoomValue?: number;
  maxZoom?: number;
  refreshOnResize?: boolean;
  zoomOnMouseWheel?: boolean;
  snapView?: boolean;
}

// Internal option type used when ImageViewerOptions properties are set to default
interface InternalOptions {
  zoomValue: number;
  maxZoom: number;
  refreshOnResize: boolean;
  zoomOnMouseWheel: boolean;
  snapView: boolean;
}

export default class ImageViewer {
  static defaults: InternalOptions = {
    zoomValue: 100,
    snapView: true,
    maxZoom: 500,
    refreshOnResize: true,
    zoomOnMouseWheel: true,
  };

  _elements: {
    container: HTMLElement;
    domElement: HTMLElement;
    snapView: HTMLElement;
    snapImageWrap: HTMLElement;
    imageWrap: HTMLElement;
    snapHandle: HTMLElement;
    zoomHandle: HTMLElement;

    image?: HTMLImageElement;
    snapImage?: HTMLImageElement;

    fullScreen?: HTMLElement; // Used by FullScreen.ts
  };
  _options: InternalOptions;
  _events: { [key: string]: () => void };
  _frames: {
    slideMomentumCheck?: NodeJS.Timeout;
    snapViewTimeout?: NodeJS.Timeout;
    sliderMomentumFrame?: number;
    zoomFrame?: number;
  };
  _sliders: {
    imageSlider: Slider;
    snapSlider: Slider;
    zoomSlider: Slider;
  };
  _state: {
    zoomValue: number;
    zoomSliderLength: number;
    loaded: boolean;

    snapViewVisible?: boolean;
    zooming?: boolean;
    containerDim?: Size;
    imageDim?: Size;
    snapImageDim?: Size;
    snapHandleDim?: Size;
  };
  _images: {
    imageSrc: string;
    hiResImageSrc: string;
  };
  _ev?: () => void;

  constructor(element: HTMLElement, options: ImageViewerOptions = {}) {
    const {
      container,
      domElement,
      imageSrc,
      hiResImageSrc,
    } = this._findContainerAndImageSrc(element);

    this._options = { ...ImageViewer.defaults, ...options };

    // container for all events
    this._events = {};

    // container for all timeout and frames
    this._frames = {};

    // maintain current state
    this._state = {
      zoomValue: this._options.zoomValue,
      zoomSliderLength: 0,
      loaded: true,
    };

    this._images = {
      imageSrc,
      hiResImageSrc,
    };

    // initialize the dom elements
    this._elements = {
      ...this._initDom(container),
      container,
      domElement,
    };

    // initialize slider
    const imageSlider = this._initImageSlider();
    const snapSlider = this._initSnapSlider();
    const zoomSlider = this._initZoomSlider();
    this._sliders = {
      imageSlider,
      snapSlider,
      zoomSlider,
    };

    // enable pinch and zoom feature for touch screens
    this._pinchAndZoom();

    // enable scroll zoom interaction
    this._scrollZoom();

    // enable double tap to zoom interaction
    this._doubleTapToZoom();

    // initialize events
    this._initEvents();

    if (imageSrc) {
      this._loadImages();
    }

    // store reference of imageViewer in domElement
    domElement.dataset[DATA_VIEWER] = 'enabled';
  }

  _findContainerAndImageSrc(element: HTMLElement | string) {
    let domElement: HTMLElement | null;
    let imageSrc: string, hiResImageSrc: string;

    if (typeof element === 'string') {
      domElement = document.querySelector(element) as HTMLElement | null;
    } else {
      domElement = element;
    }

    if (!domElement) {
      throw new Error(`Dom element "${element}" not found`);
    }

    // throw error if imageViewer is already assigned
    if (domElement.dataset[DATA_VIEWER]) {
      throw new Error(
        'An image viewer is already being initiated on the element.',
      );
    }

    let container = domElement;
    if (domElement.tagName.toLowerCase() === 'img') {
      imageSrc =
        (domElement as HTMLImageElement).getAttribute('src') || 'NLLLL';
      hiResImageSrc =
        domElement.getAttribute('high-res-src') ||
        domElement.getAttribute('data-high-res-src') ||
        '';

      // wrap the image with iv-container div
      container = wrap(domElement, {
        className: 'iv-container iv-image-mode',
        style: { display: 'inline-block', overflow: 'hidden' },
      });

      // hide the image and add iv-original-img class
      css(domElement, {
        opacity: 0,
        position: 'relative',
        zIndex: -1,
      });
    } else {
      imageSrc =
        domElement.getAttribute('src') ||
        domElement.getAttribute('data-src') ||
        '';
      hiResImageSrc =
        domElement.getAttribute('high-res-src') ||
        domElement.getAttribute('data-high-res-src') ||
        '';
    }

    return {
      container,
      domElement,
      imageSrc,
      hiResImageSrc,
    };
  }

  _initDom(container: HTMLElement) {
    // add image-viewer layout elements
    createElement({
      tagName: 'div',
      className: 'iv-wrap',
      html: imageViewHtml,
      parent: container,
    });

    // add container class on the container
    addClass(container, 'iv-container');

    // if the element is static position, position it relatively
    if (css(container, 'position') === 'static') {
      css(container, { position: 'relative' });
    }

    // save references for later use
    return {
      snapView: mustQuerySelector(container, '.iv-snap-view'),
      snapImageWrap: mustQuerySelector(container, '.iv-snap-image-wrap'),
      imageWrap: mustQuerySelector(container, '.iv-image-wrap'),
      snapHandle: mustQuerySelector(container, '.iv-snap-handle'),
      zoomHandle: mustQuerySelector(container, '.iv-zoom-handle'),
    };
  }

  _initImageSlider(): Slider {
    const { _elements } = this;
    const { imageWrap } = _elements;

    let positions: [SliderPosition | undefined, SliderPosition | undefined],
      currentPos: SliderPosition | undefined;

    /* Add slide interaction to image */
    const imageSlider = new Slider(imageWrap, {
      isSliderEnabled: () => {
        const { loaded, zooming, zoomValue } = this._state;
        return loaded && !zooming && zoomValue > 100;
      },
      onStart: (_, position) => {
        const { snapSlider } = this._sliders;

        // clear all animation frame and interval
        this._clearFrames();
        snapSlider.onStart();

        // reset positions
        positions = [position, position];
        currentPos = undefined;

        this._frames.slideMomentumCheck = setInterval(() => {
          if (!currentPos) {
            return;
          }
          positions.shift();
          positions.push({
            x: currentPos.mx,
            y: currentPos.my,
          });
        }, 50);
      },
      onMove: (e, position) => {
        const { snapImageDim } = this._state;
        const { snapSlider } = this._sliders;
        if (!snapImageDim) {
          throw new Error('Missing size info in state');
        }

        const imageCurrentDim = this._getImageCurrentDim();
        currentPos = position;

        if (!position) {
          return;
        }
        snapSlider.onMove(e, {
          dx: (-(position.dx || NaN) * snapImageDim.w) / imageCurrentDim.w,
          dy: (-(position.dy || NaN) * snapImageDim.h) / imageCurrentDim.h,
        });
      },
      onEnd: () => {
        if (!positions[0] || !positions[1] || !currentPos) {
          return;
        }
        const { snapImageDim } = this._state;
        const { snapSlider } = this._sliders;
        const imageCurrentDim = this._getImageCurrentDim();

        // clear all animation frame and interval
        this._clearFrames();

        let step: number, positionX: number, positionY: number;

        const xDiff = (positions[1].x || NaN) - (positions[0].x || NaN);
        const yDiff = (positions[1].y || NaN) - (positions[0].y || NaN);

        const momentum = () => {
          if (!snapImageDim) {
            throw new Error('Missing size info in state');
          }
          if (step <= 60) {
            this._frames.sliderMomentumFrame = requestAnimationFrame(momentum);
          }

          positionX += easeOutQuart(step, xDiff / 3, -xDiff / 3, 60);
          positionY += easeOutQuart(step, yDiff / 3, -yDiff / 3, 60);

          snapSlider.onMove(undefined, {
            dx: -((positionX * snapImageDim.w) / imageCurrentDim.w),
            dy: -((positionY * snapImageDim.h) / imageCurrentDim.h),
          });

          step++;
        };

        if (Math.abs(xDiff) > 30 || Math.abs(yDiff) > 30) {
          step = 1;
          positionX = currentPos.dx || NaN;
          positionY = currentPos.dy || NaN;

          momentum();
        }
      },
    });

    imageSlider.init();
    return imageSlider;
  }

  _initSnapSlider(): Slider {
    const { snapHandle } = this._elements;
    let startHandleTop: number, startHandleLeft: number;

    const snapSlider = new Slider(snapHandle, {
      isSliderEnabled: () => {
        return this._state.loaded;
      },
      onStart: () => {
        const { slideMomentumCheck, sliderMomentumFrame } = this._frames;

        startHandleTop = parseFloat(css(snapHandle, 'top') as string);
        startHandleLeft = parseFloat(css(snapHandle, 'left') as string);

        // stop momentum on image
        clearInterval(slideMomentumCheck!);
        cancelAnimationFrame(sliderMomentumFrame!);
      },
      onMove: (_, position) => {
        if (!position) {
          return;
        }
        const { snapHandleDim, snapImageDim } = this._state;
        const { image } = this._elements;
        if (!snapHandleDim || !snapImageDim) {
          throw new Error('Missing size info in state');
        }

        const imageCurrentDim = this._getImageCurrentDim();

        // find handle left and top and make sure they lay between the snap image
        const maxLeft = Math.max(
          snapImageDim.w - snapHandleDim.w,
          startHandleLeft,
        );
        const maxTop = Math.max(
          snapImageDim.h - snapHandleDim.h,
          startHandleTop,
        );
        const minLeft = Math.min(0, startHandleLeft);
        const minTop = Math.min(0, startHandleTop);

        const left = clamp(
          startHandleLeft + (position.dx || NaN),
          minLeft,
          maxLeft,
        );
        const top = clamp(
          startHandleTop + (position.dy || NaN),
          minTop,
          maxTop,
        );

        const imgLeft = (-left * imageCurrentDim.w) / snapImageDim.w;
        const imgTop = (-top * imageCurrentDim.h) / snapImageDim.h;

        css(snapHandle, {
          left: `${left}px`,
          top: `${top}px`,
        });

        if (image) {
          css(image, {
            left: `${imgLeft}px`,
            top: `${imgTop}px`,
          });
        }
      },
    });

    snapSlider.init();
    return snapSlider;
  }

  _initZoomSlider(): Slider {
    const { snapView, zoomHandle } = this._elements;
    // zoom in zoom out using zoom handle
    const sliderElm = mustQuerySelector(snapView, '.iv-zoom-slider');

    let leftOffset: number, handleWidth: number;

    // on zoom slider we have to follow the mouse and set the handle to its position.
    const zoomSlider = new Slider(sliderElm, {
      isSliderEnabled: () => {
        return this._state.loaded;
      },
      onStart: eStart => {
        const { zoomSlider: slider } = this._sliders;
        leftOffset =
          sliderElm.getBoundingClientRect().left + document.body.scrollLeft;
        handleWidth = parseInt(css(zoomHandle, 'width') || '', 10);

        // move the handle to current mouse position
        slider.onMove(eStart);
      },
      onMove: e => {
        const { maxZoom } = this._options;
        const { zoomSliderLength } = this._state;
        const pageX =
          // tslint:disable-next-line no-any
          (e as any).pageX !== undefined
            ? (e as MouseEvent).pageX
            : (e as TouchEvent).touches[0].pageX;
        const newLeft = clamp(
          pageX - leftOffset - handleWidth / 2,
          0,
          zoomSliderLength,
        );

        const zoomValue = 100 + ((maxZoom - 100) * newLeft) / zoomSliderLength;
        this.zoom(zoomValue);
      },
    });

    zoomSlider.init();
    return zoomSlider;
  }

  _initEvents() {
    this._snapViewEvents();

    // handle window resize
    if (this._options.refreshOnResize) {
      this._events.onWindowResize = assignEvent(window, 'resize', this.refresh);
    }
  }

  _snapViewEvents() {
    const { imageWrap, snapView } = this._elements;
    // show snapView on mouse move
    this._events.snapViewOnMouseMove = assignEvent(
      imageWrap,
      ['touchmove', 'mousemove'],
      () => {
        this.showSnapView(null);
      },
    );

    // keep showing snapView if on hover over it without any timeout
    this._events.mouseEnterSnapView = assignEvent(
      snapView,
      ['mouseenter', 'touchstart'],
      () => {
        this._state.snapViewVisible = false;
        this.showSnapView(true);
      },
    );

    // on mouse leave set timeout to hide snapView
    this._events.mouseLeaveSnapView = assignEvent(
      snapView,
      ['mouseleave', 'touchend'],
      () => {
        this._state.snapViewVisible = false;
        this.showSnapView(null);
      },
    );
  }

  _pinchAndZoom() {
    const { imageWrap, container } = this._elements;

    // apply pinch and zoom feature
    const onPinchStart = (eStart: TouchEvent) => {
      const { loaded, zoomValue: startZoomValue } = this._state;
      const { _events: events } = this;

      if (!loaded) {
        return;
      }

      const touch0 = eStart.touches[0];
      const touch1 = eStart.touches[1];

      if (!(touch0 && touch1)) {
        return;
      }

      this._state.zooming = true;

      const contOffset = container.getBoundingClientRect();

      // find distance between two touch points
      const startDist = getTouchPointsDistance(eStart.touches);

      // find the center for the zoom
      const center = {
        x:
          (touch1.pageX + touch0.pageX) / 2 -
          (contOffset.left + document.body.scrollLeft),
        y:
          (touch1.pageY + touch0.pageY) / 2 -
          (contOffset.top + document.body.scrollTop),
      };

      const moveListener = (eMove: TouchEvent) => {
        const newDist = getTouchPointsDistance(eMove.touches);
        const zoomValue = startZoomValue + (newDist - startDist) / 2;

        this.zoom(zoomValue, center);
      };

      const endListener = () => {
        // unbind events
        events.pinchMove();
        events.pinchEnd();
        this._state.zooming = false;
      };

      // remove events if already assigned
      if (events.pinchMove) {
        events.pinchMove();
      }
      if (events.pinchEnd) {
        events.pinchEnd();
      }

      // assign events
      events.pinchMove = assignEvent(
        document,
        'touchmove',
        moveListener as EventListener,
      );
      events.pinchEnd = assignEvent(document, 'touchend', endListener);
    };

    this._events.pinchStart = assignEvent(
      imageWrap,
      'touchstart',
      onPinchStart as EventListenerOrEventListenerObject,
    );
  }

  _scrollZoom() {
    /* Add zoom interaction in mouse wheel */
    const { _options } = this;
    const { container, imageWrap } = this._elements;

    let changedDelta = 0;

    const onMouseWheel = (e: WheelEvent) => {
      const { loaded, zoomValue } = this._state;
      if (!_options.zoomOnMouseWheel || !loaded) {
        return;
      }

      // clear all animation frame and interval
      this._clearFrames();

      // cross-browser wheel delta
      const delta = Math.max(
        -1,
        // tslint:disable-next-line no-any
        Math.min(1, (e as any).wheelDelta || -e.detail || -e.deltaY),
      );

      const newZoomValue = (zoomValue * (100 + delta * ZOOM_CONSTANT)) / 100;

      if (!(newZoomValue >= 100 && newZoomValue <= _options.maxZoom)) {
        changedDelta += Math.abs(delta);
      } else {
        changedDelta = 0;
      }

      e.preventDefault();

      if (changedDelta > MOUSE_WHEEL_COUNT) {
        return;
      }

      const contOffset = container.getBoundingClientRect();

      const x =
        (e.pageX || e.pageX) - (contOffset.left + document.body.scrollLeft);
      const y =
        (e.pageY || e.pageY) - (contOffset.top + document.body.scrollTop);

      this.zoom(newZoomValue, {
        x,
        y,
      });

      // show the snap viewer
      this.showSnapView(null);
    };

    this._ev = assignEvent(imageWrap, 'wheel', onMouseWheel as EventListener);
  }

  _doubleTapToZoom() {
    const { imageWrap } = this._elements;
    // handle double tap for zoom in and zoom out
    let touchTime = 0;
    let point = {
      x: 0,
      y: 0,
    };

    const onDoubleTap = (e: MouseEvent) => {
      if (touchTime === 0) {
        touchTime = Date.now();
        point = {
          x: e.pageX,
          y: e.pageY,
        };
      } else if (
        Date.now() - touchTime < 500 &&
        Math.abs(e.pageX - point.x) < 50 &&
        Math.abs(e.pageY - point.y) < 50
      ) {
        if (this._state.zoomValue === this._options.zoomValue) {
          this.zoom(200);
        } else {
          this.resetZoom();
        }
        touchTime = 0;
      } else {
        touchTime = 0;
      }
    };

    assignEvent(
      imageWrap,
      'click',
      onDoubleTap as EventListenerOrEventListenerObject,
    );
  }

  _getImageCurrentDim() {
    const { zoomValue, imageDim } = this._state;
    if (!imageDim) {
      throw new Error('Missing size info in state');
    }
    return {
      w: imageDim.w * (zoomValue / 100),
      h: imageDim.h * (zoomValue / 100),
    };
  }

  _loadImages() {
    const { _images, _elements } = this;
    const { imageSrc, hiResImageSrc } = _images;
    const { container, snapImageWrap, imageWrap } = _elements;

    const ivLoader = container.querySelector(
      '.iv-loader',
    ) as HTMLElement | null;

    // remove old images
    remove(container.querySelectorAll('.iv-snap-image, .iv-image'));

    // add snapView image
    const snapImage = createElement({
      tagName: 'img',
      className: 'iv-snap-image',
      src: imageSrc,
      insertBefore: snapImageWrap
        ? snapImageWrap.firstChild || undefined
        : undefined,
      parent: snapImageWrap,
    }) as HTMLImageElement;

    // add image
    const image = createElement({
      tagName: 'img',
      className: 'iv-image iv-small-image',
      src: imageSrc,
      parent: imageWrap,
    }) as HTMLImageElement;

    this._state.loaded = false;

    // store image reference in _elements
    this._elements.image = image;
    this._elements.snapImage = snapImage;

    if (ivLoader) {
      css(ivLoader, { display: 'block' });
    }

    // keep visibility hidden until image is loaded
    css(image, { visibility: 'hidden' });

    // hide snap view if open
    this.hideSnapView();

    imgLoaded(image, () => {
      if (ivLoader) {
        // hide the iv loader
        css(ivLoader, { display: 'none' });
      }

      // show the image
      css(image, { visibility: 'visible' });

      // load high resolution image if provided
      if (hiResImageSrc) {
        this._loadHighResImage(hiResImageSrc);
      }

      // set loaded flag to true
      this._state.loaded = true;

      // calculate the dimension
      this._calculateDimensions();

      // reset the zoom
      this.resetZoom();
    });
  }

  _loadHighResImage(hiResImageSrc: string) {
    const { imageWrap } = this._elements;
    const lowResImg = this._elements.image;
    const lowResImgStyleText = lowResImg ? lowResImg.style.cssText : undefined;

    const hiResImage = createElement({
      tagName: 'img',
      className: 'iv-image iv-large-image',
      src: hiResImageSrc,
      parent: imageWrap,
      style: lowResImgStyleText,
    }) as HTMLImageElement;

    // add all the style attributes from lowResImg to highResImg
    if (lowResImgStyleText) {
      hiResImage.style.cssText = lowResImgStyleText;
    }

    // TODO: Not sure what it's going on here, results of querySelectorAll is an array and why not set hiResImageSrc to _elements.image?
    // this._elements.image = container.querySelectorAll('.iv-image');

    imgLoaded(hiResImage, () => {
      // remove the low size image and set this image as default image
      if (lowResImg) {
        remove(lowResImg);
      }
      this._elements.image = hiResImage;
      this._calculateDimensions();
    });
  }

  _calculateDimensions() {
    const {
      image,
      container,
      snapView,
      snapImage,
      zoomHandle,
    } = this._elements;

    if (!image) {
      return;
    }

    // calculate content width of image and snap image
    const imageWidth = parseInt(css(image, 'width') as string, 10);
    const imageHeight = parseInt(css(image, 'height') as string, 10);

    const contWidth = parseInt(css(container, 'width') as string, 10);
    const contHeight = parseInt(css(container, 'height') as string, 10);

    const snapViewWidth = snapView.clientWidth;
    const snapViewHeight = snapView.clientHeight;

    // set the container dimension
    this._state.containerDim = {
      w: contWidth,
      h: contHeight,
    };

    // set the image dimension
    let imgWidth;
    let imgHeight;

    const ratio = imageWidth / imageHeight;

    imgWidth =
      (imageWidth > imageHeight && contHeight >= contWidth) ||
      ratio * contHeight > contWidth
        ? contWidth
        : ratio * contHeight;

    imgHeight = imgWidth / ratio;

    this._state.imageDim = {
      w: imgWidth,
      h: imgHeight,
    };

    // reset image position and zoom
    css(image, {
      width: `${imgWidth}px`,
      height: `${imgHeight}px`,
      left: `${(contWidth - imgWidth) / 2}px`,
      top: `${(contHeight - imgHeight) / 2}px`,
      maxWidth: 'none',
      maxHeight: 'none',
    });

    // set the snap Image dimension
    const snapWidth =
      imgWidth > imgHeight
        ? snapViewWidth
        : (imgWidth * snapViewHeight) / imgHeight;
    const snapHeight =
      imgHeight > imgWidth
        ? snapViewHeight
        : (imgHeight * snapViewWidth) / imgWidth;

    this._state.snapImageDim = {
      w: snapWidth,
      h: snapHeight,
    };

    if (snapImage) {
      css(snapImage, {
        width: `${snapWidth}px`,
        height: `${snapHeight}px`,
      });
    }

    // calculate zoom slider area
    this._state.zoomSliderLength = snapViewWidth - zoomHandle.offsetWidth;
  }

  resetZoom(animate = true) {
    const { zoomValue } = this._options;

    if (!animate) {
      this._state.zoomValue = zoomValue;
    }

    this.zoom(zoomValue);
  }

  zoom = (perc: number, point?: Point) => {
    const { _options, _elements, _state } = this;
    const {
      zoomValue: curPerc,
      imageDim,
      containerDim,
      zoomSliderLength,
    } = _state;
    const { image, zoomHandle } = _elements;
    const { maxZoom } = _options;
    if (!image) {
      return;
    }
    if (!containerDim || !imageDim) {
      throw new Error('Missing size info in state');
    }

    perc = Math.round(Math.max(100, perc));
    perc = Math.min(maxZoom, perc);

    point = point || {
      x: containerDim.w / 2,
      y: containerDim.h / 2,
    };

    const curLeft = parseFloat(css(image, 'left') as string);
    const curTop = parseFloat(css(image, 'top') as string);

    // clear any panning frames
    this._clearFrames();

    let step = 0;
    const baseLeft = (containerDim.w - imageDim.w) / 2;
    const baseTop = (containerDim.h - imageDim.h) / 2;
    const baseRight = containerDim.w - baseLeft;
    const baseBottom = containerDim.h - baseTop;

    const zoom = () => {
      // point is guaranteed not undefined above, TypeScript just loses analysis cross function boundaries
      if (!point) {
        return;
      }
      step++;
      if (step < 16) {
        this._frames.zoomFrame = requestAnimationFrame(zoom);
      }

      const tickZoom = easeOutQuart(step, curPerc, perc - curPerc, 16);
      const ratio = tickZoom / curPerc;

      const imgWidth = (imageDim.w * tickZoom) / 100;
      const imgHeight = (imageDim.h * tickZoom) / 100;

      let newLeft = -((point.x - curLeft) * ratio - point.x);
      let newTop = -((point.y - curTop) * ratio - point.y);

      // fix for left and top
      newLeft = Math.min(newLeft, baseLeft);
      newTop = Math.min(newTop, baseTop);

      // fix for right and bottom
      if (newLeft + imgWidth < baseRight) {
        newLeft = baseRight - imgWidth; // newLeft - (newLeft + imgWidth - baseRight)
      }

      if (newTop + imgHeight < baseBottom) {
        newTop = baseBottom - imgHeight; // newTop + (newTop + imgHeight - baseBottom)
      }

      css(image, {
        height: `${imgHeight}px`,
        width: `${imgWidth}px`,
        left: `${newLeft}px`,
        top: `${newTop}px`,
      });

      this._state.zoomValue = tickZoom;
      this._resizeSnapHandle(imgWidth, imgHeight, newLeft, newTop);

      // update zoom handle position
      css(zoomHandle, {
        left: `${((tickZoom - 100) * zoomSliderLength) / (maxZoom - 100)}px`,
      });
    };

    zoom();
  };

  _clearFrames = () => {
    const { slideMomentumCheck, sliderMomentumFrame, zoomFrame } = this._frames;
    clearInterval(slideMomentumCheck!);
    cancelAnimationFrame(sliderMomentumFrame!);
    cancelAnimationFrame(zoomFrame!);
  };

  _resizeSnapHandle = (
    imgWidth: number,
    imgHeight: number,
    imgLeft: number,
    imgTop: number,
  ) => {
    const { _elements, _state } = this;
    const { snapHandle, image } = _elements;
    if (!image) {
      return;
    }
    const { imageDim, containerDim, zoomValue, snapImageDim } = _state;
    if (!imageDim || !snapImageDim || !containerDim) {
      throw new Error(`Missing size info in state`);
    }

    const imageWidth = imgWidth || (imageDim.w * zoomValue) / 100;
    const imageHeight = imgHeight || (imageDim.h * zoomValue) / 100;
    const imageLeft = imgLeft || parseFloat(css(image, 'left') as string);
    const imageTop = imgTop || parseFloat(css(image, 'top') as string);

    const left = (-imageLeft * snapImageDim.w) / imageWidth;
    const top = (-imageTop * snapImageDim.h) / imageHeight;

    const handleWidth = (containerDim.w * snapImageDim.w) / imageWidth;
    const handleHeight = (containerDim.h * snapImageDim.h) / imageHeight;

    css(snapHandle, {
      top: `${top}px`,
      left: `${left}px`,
      width: `${handleWidth}px`,
      height: `${handleHeight}px`,
    });

    this._state.snapHandleDim = {
      w: handleWidth,
      h: handleHeight,
    };
  };

  showSnapView = (noTimeout: boolean | null) => {
    const { snapViewVisible, zoomValue, loaded } = this._state;
    const { snapView } = this._elements;

    if (!this._options.snapView) {
      return;
    }
    if (snapViewVisible || zoomValue <= 100 || !loaded) {
      return;
    }

    clearTimeout(this._frames.snapViewTimeout!);
    this._state.snapViewVisible = true;
    css(snapView, { opacity: 1, pointerEvents: 'inherit' });

    if (!noTimeout) {
      this._frames.snapViewTimeout = setTimeout(this.hideSnapView, 1500);
    }
  };

  hideSnapView = () => {
    const { snapView } = this._elements;
    css(snapView, { opacity: 0, pointerEvents: 'none' });
    this._state.snapViewVisible = false;
  };

  refresh = () => {
    this._calculateDimensions();
    this.resetZoom();
  };

  load(imageSrc: string, hiResImageSrc: string) {
    this._images = {
      imageSrc,
      hiResImageSrc,
    };

    this._loadImages();
  }

  destroy() {
    const { container, domElement } = this._elements;
    // destroy all the sliders
    Object.values(this._sliders).forEach(slider => {
      slider.destroy();
    });

    // unbind all events
    Object.values(this._events).forEach(unbindEvent => {
      unbindEvent();
    });

    // clear all the frames
    this._clearFrames();

    // remove html from the container
    const ivWrap = container.querySelector('.iv-wrap');
    if (ivWrap) {
      remove(ivWrap as HTMLElement);
    }

    // remove iv-container class from container
    removeClass(container, 'iv-container');

    // remove added style from container
    removeCss(document.querySelector('html') as HTMLElement, 'relative');

    // if container has original image, unwrap the image and remove the class
    // which will happen when domElement is not the container
    if (domElement !== container) {
      unwrap(domElement);
    }

    // remove imageViewer reference from dom element
    delete domElement.dataset[DATA_VIEWER];
  }
}
