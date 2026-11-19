// Solmar Heat — input.js
// Keyboard + mouse state. The class only touches the DOM when attach() is
// called by main.js, so importing this module in Node is safe.

export class Input {
  constructor() {
    this.keys = new Set(); // currently held key codes (lowercase)
    this.pressed = new Set(); // keys pressed since the last consume()
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false; // a mouse click since the last consume()
    this._onKeyDown = null;
    this._onKeyUp = null;
    this._onMouseMove = null;
    this._onMouseDown = null;
    this._onMouseUp = null;
    this._onBlur = null;
  }

  attach(canvas) {
    this._onKeyDown = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(k);
      this.keys.add(k);
    };
    this._onKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
    };
    this._onMouseMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    };
    this._onMouseDown = (e) => {
      this.mouseDown = true;
      this.clicked = true;
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    };
    this._onMouseUp = () => { this.mouseDown = false; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  /** Is any of these keys held right now? */
  down(...names) {
    return names.some((n) => this.keys.has(n));
  }

  /** Was any of these keys pressed since the last consume()? */
  wasPressed(...names) {
    return names.some((n) => this.pressed.has(n));
  }

  /** Was the mouse clicked since the last consume()? */
  wasClicked() {
    return this.clicked;
  }

  /** Clear the edge-triggered state (call once per frame, after handling). */
  consume() {
    this.pressed.clear();
    this.clicked = false;
  }

  detach() {
    if (!this._onKeyDown) return;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('mouseup', this._onMouseUp);
  }
}
