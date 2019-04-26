import { noop } from './util';
import { throwIfFalsy } from 'throw-if-arg-empty';

export interface SliderPosition {
  x?: number;
  y?: number;
  mx?: number;
  my?: number;
  dx?: number;
  dy?: number;
}

export type SliderPositionEvent = (
  e?: MouseEvent | TouchEvent,
  position?: SliderPosition,
) => void;

export interface SliderOptions {
  onStart?: SliderPositionEvent;
  onMove?: SliderPositionEvent;
  onEnd?: () => void;
  isSliderEnabled: () => boolean;
}

export default class Slider {
  container: HTMLElement;
  isSliderEnabled: () => boolean;
  onStart: SliderPositionEvent;
  onMove: SliderPositionEvent;
  onEnd: () => void;
  touchMoveEvent?: string;
  touchEndEvent?: string;
  sx: any;
  sy: any;

  constructor(
    container: HTMLElement,
    { onStart, onMove, onEnd, isSliderEnabled }: SliderOptions,
  ) {
    throwIfFalsy(container, 'container');
    this.container = container;
    this.isSliderEnabled = isSliderEnabled;
    this.onStart = onStart || noop;
    this.onMove = onMove || noop;
    this.onEnd = onEnd || noop;
  }

  startHandler: SliderPositionEvent = eStart => {
    if (!this.isSliderEnabled()) {
      return;
    }

    this.removeListeners();
    if (eStart) {
      eStart.preventDefault();

      const { moveHandler, endHandler, onStart } = this;
      const isTouchEvent = eStart.type === 'touchstart';

      this.touchMoveEvent = isTouchEvent ? 'touchmove' : 'mousemove';
      this.touchEndEvent = isTouchEvent ? 'touchend' : 'mouseup';

      this.sx = isTouchEvent
        ? (eStart as TouchEvent).touches[0].clientX
        : (eStart as MouseEvent).clientX;

      this.sy = isTouchEvent
        ? (eStart as TouchEvent).touches[0].clientY
        : (eStart as MouseEvent).clientY;

      onStart(eStart, {
        x: this.sx,
        y: this.sy,
      });

      // add listeners
      if (this.touchMoveEvent) {
        document.addEventListener(
          this.touchMoveEvent,
          moveHandler as EventListener,
        );
      }
      if (this.touchEndEvent) {
        document.addEventListener(
          this.touchEndEvent,
          endHandler as EventListener,
        );
      }
      /*
      add end handler in context menu as well.
      As mouseup event is not trigger on context menu open
      https://bugs.chromium.org/p/chromium/issues/detail?id=506801
    */
      document.addEventListener('contextmenu', endHandler);
    }
  };

  moveHandler: SliderPositionEvent = eMove => {
    if (!this.isSliderEnabled()) {
      return;
    }

    if (eMove) {
      eMove.preventDefault();
      const { sx, sy, onMove } = this;

      const isTouchEvent = this.touchMoveEvent === 'touchmove';

      // get the coordinates
      const mx = isTouchEvent
        ? (eMove as TouchEvent).touches[0].clientX
        : (eMove as MouseEvent).clientX;
      const my = isTouchEvent
        ? (eMove as TouchEvent).touches[0].clientY
        : (eMove as MouseEvent).clientY;

      onMove(eMove, {
        dx: mx - sx,
        dy: my - sy,
        mx,
        my,
      });
    }
  };

  endHandler = () => {
    if (!this.isSliderEnabled()) {
      return;
    }
    this.removeListeners();
    this.onEnd();
  };

  // remove previous events if its not removed
  // - Case when while sliding mouse moved out of document and released there
  removeListeners() {
    if (!this.touchMoveEvent) {
      return;
    }
    if (this.touchMoveEvent) {
      document.removeEventListener(this.touchMoveEvent, this
        .moveHandler as EventListener);
    }
    if (this.touchEndEvent) {
      document.removeEventListener(this.touchEndEvent, this
        .endHandler as EventListener);
    }
    document.removeEventListener('contextmenu', this.endHandler);
  }

  init() {
    ['touchstart', 'mousedown'].forEach(evt => {
      this.container.addEventListener(evt, this.startHandler as EventListener);
    });
  }

  destroy() {
    ['touchstart', 'mousedown'].forEach(evt => {
      this.container.removeEventListener(evt, this
        .startHandler as EventListener);
    });
    this.removeListeners();
  }
}
