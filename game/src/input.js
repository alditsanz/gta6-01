// Solmar Heat — input.js
// One job: keyboard and mouse state. The game loop reads this object;
// nothing else in the game touches DOM events directly.

export const KEY_ACTIONS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  steal: ['KeyE'],
  punch: ['KeyF'],
  reload: ['KeyR'],
  handbrake: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  taxi: ['KeyT'],
  delivery: ['KeyL'],
  pause: ['KeyP'],
  mute: ['KeyM'],
  turf: ['KeyG'],
  paint: ['KeyC'],
  board: ['KeyB'],
  confirm: ['Enter'],
};

export function createInput() {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    // True while any of the codes for the action is held.
    held(action) {
      const codes = KEY_ACTIONS[action] || [];
      for (const c of codes) if (this.keys.has(c)) return true;
      return false;
    },
    // True only on the frame the key went down (cleared by endFrame).
    hit(action) {
      const codes = KEY_ACTIONS[action] || [];
      for (const c of codes) if (this.pressed.has(c)) return true;
      return false;
    },
    endFrame() {
      this.pressed.clear();
      this.mouse.clicked = false;
    },
    attach(canvas) {
      window.addEventListener('keydown', (e) => {
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }
        if (!e.repeat) this.pressed.add(e.code);
        this.keys.add(e.code);
      });
      window.addEventListener('keyup', (e) => {
        this.keys.delete(e.code);
      });
      window.addEventListener('blur', () => {
        this.keys.clear();
      });
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
        this.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          // Record the position here too: a click with no prior mousemove
          // must still land on the button under the cursor.
          const rect = canvas.getBoundingClientRect();
          this.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
          this.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
          this.mouse.down = true;
          this.mouse.clicked = true;
        }
      });
      window.addEventListener('mouseup', () => {
        this.mouse.down = false;
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },
  };
  return input;
}
