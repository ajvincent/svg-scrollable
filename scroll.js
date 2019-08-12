function SVGScroll(element) {
  if (!(element instanceof SVGGElement) || !element.hasAttribute("id"))
    return;
  this.group = element;
  element.scroller = this;

  this.hasScrollX = element.classList.contains("scroll-x");
  this.hasScrollY = element.classList.contains("scroll-y");
  [this.outerX, this.outerY] = element.dataset.outer.split(" ").map(parseFloat);
  [this.innerX, this.innerY] = element.dataset.inner.split(" ").map(parseFloat);
  this.outerClipBox = this.buildClip("outer");
  this.innerClipBox = this.buildClip("inner");
  const SVG_NS = "http://www.w3.org/2000/svg";
  this.scrollTransform = document.createElementNS(SVG_NS, "g");
  this.scrollTransform.classList.add("scrollTransform");
  this.innerClipRect = this.innerClipBox.getElementsByTagName("rect")[0];

  this.horizontal = this.addScrollbar(true);
  this.vertical   = this.addScrollbar(false);
  this.insertContent();

  if (this.horizontal)
    this.horizontal.listenOnThumb();
  if (this.vertical)
    this.vertical.listenOnThumb();

  this.updateInnerPosition();
}

SVGScroll.map = new Map(/*
  SVGGElement: new SVGScroll()
*/);

SVGScroll.cloneElement = function(id) {
  const elem = document.getElementById(id).cloneNode(true);
  elem.removeAttribute("id");
  return elem;
};


SVGScroll.initialize = function() {
  const h = Array.from(document.getElementsByClassName("scroll-x"));
  const v = Array.from(document.getElementsByClassName("scroll-y"));
  const elements = Array.from(new Set(h.concat(v)));
  elements.forEach((element) => new SVGScroll(element));
};

SVGScroll.Bar = function(props, scroller) {
  this.props = props;
  this.scroller = scroller;

  this.barGroup = SVGScroll.cloneElement("scrollbar");
  this.divider    = this.barGroup.getElementsByClassName("divider")[0];
  this.scrollBase = this.barGroup.getElementsByClassName("base")[0];
  this.thumb      = this.barGroup.getElementsByClassName("thumb")[0];

  this.divider.setAttribute("width", this.props.divider);
  this.scrollBase.setAttribute("width", this.props.baseWidth);

  let transform = "", rect = this.scroller.innerClipRect;
  if (props.isHorizontal) {
    transform = `translate(0 ${props.translate})`;
    rect.setAttribute("width", this.props.outer);
  }
  else {
    transform = `translate(${props.translate} 0) rotate(90)`;
    rect.setAttribute("height", this.props.outer);
  }
  this.barGroup.setAttribute("transform", transform);
};

SVGScroll.Bar.prototype.listenOnThumb = function() {
  let min = 0, max = 0;
  {
    const baseRect = this.scrollBase.getBoundingClientRect();
    const thumbRect = this.thumb.getBoundingClientRect();
    if (this.props.isHorizontal) {
      min = baseRect.left;
      max = baseRect.right - thumbRect.width;
    }
    else {
      min = baseRect.top;
      max = baseRect.bottom - thumbRect.height;
    }
  }
  
  const startScrolling = () => {
    window.addEventListener("mousemove", setPosition, true);
    window.addEventListener("mouseup", stopScroll, true);
  };
  
  const setPosition = (event) => {
    let pos = this.props.isHorizontal ? event.clientX : event.clientY;
    if (pos < min)
      pos = min;
    else if (pos > max)
      pos = max;
    pos -= min;
    this.thumb.setAttribute("x", pos);

    this.scroller.updateInnerPosition();
  };

  const stopScroll = (event) => {
    setPosition(event);
    window.removeEventListener("mousemove", setPosition, true);
    window.removeEventListener("mouseup", stopScroll, true);
  };

  this.thumb.addEventListener("mousedown", startScrolling, true);
  this.scrollBase.addEventListener("mousedown", startScrolling, true);
};

SVGScroll.prototype.buildClip = function(idPart) {
  const rv = SVGScroll.cloneElement("scroll-clip");
  rv.setAttribute("id", `scroll-clip-${idPart}-${this.group.id}`);
  const rect = rv.getElementsByTagName("rect")[0];
  rect.setAttribute("width", this.outerX);
  rect.setAttribute("height", this.outerY);
  return rv;
};

SVGScroll.prototype.addScrollbar = function(isHorizontal) {
  const props = isHorizontal ?
  {
    // horizontal bar properties
    hasScroll: this.hasScrollX,
    divider: this.outerX,
    outer: this.outerX - (this.hasScrollY ? 10 : 0),
    baseWidth: this.outerX - (this.hasScrollY ? 20 : 0),
    translate: this.outerY - 10,
  }
  :
  {
    // vertical bar properties
    hasScroll: this.hasScrollY,
    divider: this.outerY,
    baseWidth: this.outerY - (this.hasScrollX ? 10 : 0),
    outer: this.outerY - (this.hasScrollX ? 10 : 0),
    translate: this.outerX - 10,
  };
  props.isHorizontal = isHorizontal;

  return props.hasScroll ? new SVGScroll.Bar(props, this) : null;
};

SVGScroll.prototype.insertContent = function() {
  const id = this.group.id;
  const range = document.createRange();
  range.selectNodeContents(this.group);
  const SVG_NS = "http://www.w3.org/2000/svg";

  const outerBox = document.createElementNS(SVG_NS, "g");
  outerBox.classList.add("scrollbox-outer");
  outerBox.setAttribute(
    "clip-path", `url(#scroll-clip-outer-${id})`
  );

  const innerBox = document.createElementNS(SVG_NS, "g");
  innerBox.classList.add("scrollbox-inner");
  innerBox.setAttribute(
    "clip-path", `url(#scroll-clip-inner-${id})`
  );
  
  innerBox.appendChild(this.scrollTransform);

  outerBox.appendChild(innerBox);
  outerBox.appendChild(this.horizontal.barGroup);
  outerBox.appendChild(this.vertical.barGroup);

  this.group.appendChild(this.outerClipBox);
  this.group.appendChild(this.innerClipBox);
  this.group.appendChild(outerBox);

  this.scrollTransform.appendChild(range.extractContents());
};

SVGScroll.prototype.updateInnerPosition = function() {
  let xRatio = 0, yRatio = 0;
  if (this.horizontal) {
    const scrollRect = this.horizontal.scrollBase.getBoundingClientRect();
    const thumbRect  = this.horizontal.thumb.getBoundingClientRect();
    const max = scrollRect.width - thumbRect.width;
    const x = thumbRect.left - scrollRect.left;
    xRatio = x / max;
  }
  if (this.vertical) {
    const scrollRect = this.vertical.scrollBase.getBoundingClientRect();
    const thumbRect  = this.vertical.thumb.getBoundingClientRect();
    const max = scrollRect.height - thumbRect.height;
    const y = thumbRect.top - scrollRect.top;
    yRatio = y / max;
  }

  {
    const x = -xRatio * (this.innerX - this.outerX),
          y = -yRatio * (this.innerY - this.outerY);
    this.scrollTransform.setAttribute("transform", `translate(${x} ${y})`);
  }
};

window.addEventListener("load", SVGScroll.initialize, true);
