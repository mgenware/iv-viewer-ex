// constants
export const ZOOM_CONSTANT = 15; // increase or decrease value for zoom on mouse wheel
export const MOUSE_WHEEL_COUNT = 5; // A mouse delta after which it should stop preventing default behavior of mouse wheel

export function noop() {
  /* empty */
}

// ease out method
/*
    t : current time,
    b : initial value,
    c : changed value,
    d : duration
*/
export function easeOutQuart(t: number, b: number, c: number, d: number) {
  t /= d;
  t -= 1;
  return -c * (t * t * t * t - 1) + b;
}

export interface CreateElementOptions {
  tagName: string;
  parent: HTMLElement;

  id?: string;
  html?: string;
  className?: string;
  src?: string;
  style?: string;
  child?: HTMLElement;
  insertBefore?: HTMLElement | Node | ChildNode;
}

export function createElement(options: CreateElementOptions) {
  const elem = document.createElement(options.tagName);
  if (options.id) {
    elem.id = options.id;
  }
  if (options.html) {
    elem.innerHTML = options.html;
  }
  if (options.className) {
    elem.className = options.className;
  }
  if (options.src && options.tagName.toLowerCase() === 'img') {
    (elem as HTMLImageElement).src = options.src;
  }
  if (options.style) {
    elem.style.cssText = options.style;
  }
  if (options.child) {
    elem.appendChild(options.child);
  }

  // Insert before
  if (options.insertBefore) {
    options.parent.insertBefore(elem, options.insertBefore);

    // Standard append
  } else {
    options.parent.appendChild(elem);
  }

  return elem;
}

// method to add class
export function addClass(el: HTMLElement, className: string) {
  const classNameAry = className.split(' ');

  if (classNameAry.length > 1) {
    classNameAry.forEach(classItem => addClass(el, classItem));
  } else if (el.classList) {
    el.classList.add(className);
  } else {
    el.className += ` ${className}`;
  }
}

// method to remove class
export function removeClass(el: HTMLElement, className: string) {
  const classNameAry = className.split(' ');
  if (classNameAry.length > 1) {
    classNameAry.forEach(classItem => removeClass(el, classItem));
  } else if (el.classList) {
    el.classList.remove(className);
  } else {
    el.className = el.className.replace(
      new RegExp(`(^|\\b)${className.split(' ').join('|')}(\\b|$)`, 'gi'),
      ' ',
    );
  }
}

export function toArray(
  list: NodeList | HTMLCollection | HTMLElement,
): HTMLElement[] {
  if (!(list instanceof NodeList || list instanceof HTMLCollection)) {
    return [list];
  }
  return Array.prototype.slice.call(list);
}

export function css(
  elements: NodeList | HTMLCollection | HTMLElement,
  properties: string | { [key: string]: string | number },
): string | undefined {
  const elmArray = toArray(elements);

  if (typeof properties === 'string') {
    return window.getComputedStyle(elmArray[0]).getPropertyValue(properties);
  }

  elmArray.forEach(element => {
    Object.entries(properties).forEach(([key, value]) => {
      element.style[key] = value;
    });
  });

  return undefined;
}

export function removeCss(element: HTMLElement, property: string) {
  element.style.removeProperty(property);
}

export function wrap(
  element: HTMLElement,
  { tag = 'div', className, id, style }: any,
) {
  const wrapper = document.createElement(tag);
  if (className) {
    wrapper.className = className;
  }
  if (id) {
    wrapper.id = id;
  }
  if (style) {
    wrapper.style = style;
  }
  if (element.parentNode) {
    element.parentNode.insertBefore(wrapper, element);
    element.parentNode.removeChild(element);
  }
  wrapper.appendChild(element);
  return wrapper;
}

export function unwrap(element: HTMLElement) {
  const parent = element.parentNode;
  if (parent && parent !== document.body && parent.parentNode) {
    parent.parentNode.insertBefore(element, parent);
    parent.parentNode.removeChild(parent);
  }
}

export function remove(elements: NodeList | HTMLCollection | HTMLElement) {
  const elmArray = toArray(elements);
  elmArray.forEach(element => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });
}

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export function assignEvent(
  element: HTMLElement | Window | Document,
  events: string | string[],
  handler: EventListenerOrEventListenerObject,
) {
  const eventList = typeof events === 'string' ? [events] : events;
  eventList.forEach(event => {
    element.addEventListener(event, handler);
  });

  return () => {
    eventList.forEach(event => {
      element.removeEventListener(event, handler);
    });
  };
}

export function getTouchPointsDistance(touches: TouchList) {
  const touch0 = touches[0];
  const touch1 = touches[1];
  return Math.sqrt(
    Math.pow(touch1.pageX - touch0.pageX, 2) +
      Math.pow(touch1.pageY - touch0.pageY, 2),
  );
}

export function mustQuerySelector(
  element: HTMLElement,
  selector: string,
): HTMLElement {
  const result = element.querySelector(selector);
  if (!result) {
    throw new Error(`The selector "${selector}" does not match any element`);
  }
  return result as HTMLElement;
}
