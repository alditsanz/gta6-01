// Keyboard + mouse input for Solmar Heat. The listener set is attached
// only when createInput runs, so importing this module is side-effect free.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_RELOAD = 'reload';
export const ACTION_PUNCH = 'punch';
export const ACTION_STEAL = 'steal';
export const ACTION_TAXI = 'taxi';
export const ACTION_HANDBRAKE = 'handbrake';
export const ACTION_SPRINT = 'sprint';

/**
 * Tracks held keys, mouse position in canvas pixels, and edge-triggered
 * presses (a press fires once until the key is released). `onAction` is
 * called for menu-level keys so the game loop stays the only updater.
 */
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };
  let onAction = null;

  function codeOf(e) {
    return e.code;
  }

  function keyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (onAction) {
      if (e.code === 'Enter' || e.code === 'Space') onAction(ACTION_CONFIRM);
      if (e.code === 'KeyP' || e.code === 'Escape') onAction(ACTION_PAUSE);
      if (e.code === 'KeyM') onAction(ACTION_MUTE);
    }
  }

  function keyUp(e) {
    keys.delete(e.code);
  }

  function mouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }

  function mouseDown(e) {
    mouseMove(e);
    mouse.down = true;
    mouse.clicked = true;
    if (onAction && e.button === 0) onAction(ACTION_CONFIRM);
  }

  function mouseUp() {
    mouse.down = false;
  }

  function blur() {
    keys.clear();
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDown);
  window.addEventListener('mouseup', mouseUp);

  return {
    mouse,
    setActionHandler(fn) {
      onAction = fn;
    },
    /** Held right now. */
    down(code) {
      return keys.has(code);
    },
    /** Pressed since the last frame; consumed by reading. */
    wasPressed(code) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    /** WASD / arrows as a -1..1 movement vector. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    /** Mouse click since the last frame; consumed by reading. */
    wasClicked() {
      if (mouse.clicked) {
        mouse.clicked = false;
        return true;
      }
      return false;
    },
    /** Clear per-frame edge state at the end of a frame. */
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
