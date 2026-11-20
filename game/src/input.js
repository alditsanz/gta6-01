// Solmar Heat — input.js
// Keyboard + mouse state. Key names are always lowercased (a past bug
// kept 'Enter'/'ArrowUp' capitalised so those keys never fired).

export function keyName(e) {
  if (!e) return '';
  let k = e.key != null ? String(e.key) : '';
  if (k === ' ') k = 'space';
  return k.toLowerCase();
}

export class Input {
  constructor(target) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.target = target || null;
    this._kd = (e) => {
      const k = keyName(e);
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space'].includes(k)) e.preventDefault();
    };
    this._ku = (e) => { this.keys.delete(keyName(e)); };
    this._mm = (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
    this._md = () => { this.mouse.down = true; this.mouse.clicked = true; };
    this._mu = () => { this.mouse.down = false; };
    if (target && target.addEventListener) {
      target.addEventListener('keydown', this._kd);
      target.addEventListener('keyup', this._ku);
      target.addEventListener('mousemove', this._mm);
      target.addEventListener('mousedown', this._md);
      target.addEventListener('mouseup', this._mu);
    }
  }
  down(...names) { return names.some((n) => this.keys.has(n)); }
  wasPressed(...names) { return names.some((n) => this.pressed.has(n)); }
  axisX() { return (this.down('d', 'arrowright') ? 1 : 0) - (this.down('a', 'arrowleft') ? 1 : 0); }
  axisY() { return (this.down('s', 'arrowdown') ? 1 : 0) - (this.down('w', 'arrowup') ? 1 : 0); }
  endFrame() { this.pressed.clear(); this.mouse.clicked = false; }
}
