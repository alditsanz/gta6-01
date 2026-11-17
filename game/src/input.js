// input.js — keyboard and mouse state, plus the on-screen touch of the bindings.
// The game reads this, never the raw events, so play-tests can drive it too.
import { CONTROLS } from './config.js';

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    };
    this._onMouseDown = (e) => {
      this.mouse.down = true;
      this.mouse.clicked = true;
      this._onMouseMove(e);
    };
    this._onMouseUp = () => {
      this.mouse.down = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  held(code) {
    return this.keys.has(code);
  }

  tapped(code) {
    return this.pressed.has(code);
  }

  axis(codes) {
    let v = 0;
    if (codes.some((c) => this.keys.has(c))) v += 1;
    return v;
  }

  moveX() {
    return this.axis(CONTROLS.right) - this.axis(CONTROLS.left);
  }

  moveY() {
    return this.axis(CONTROLS.down) - this.axis(CONTROLS.up);
  }

  sprinting() {
    return this.keys.has(CONTROLS.sprint) || this.keys.has('ShiftRight');
  }

  // Call once per frame after the game has read the input.
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
  }
}

// A scripted stand-in for headless play-tests: feed it key/mouse states directly.
export class ScriptedInput {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 640, y: 400, down: false, clicked: false };
  }
  held(code) { return this.keys.has(code); }
  tapped(code) { return this.pressed.has(code); }
  moveX() { return (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0); }
  moveY() { return (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0); }
  sprinting() { return this.keys.has('ShiftLeft'); }
  press(code) { this.keys.add(code); this.pressed.add(code); }
  release(code) { this.keys.delete(code); }
  endFrame() { this.pressed.clear(); this.mouse.clicked = false; }
}
