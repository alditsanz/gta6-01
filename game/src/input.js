// input.js — keyboard and mouse state. One shared object the game
// loop polls; listeners only record, they never act directly.

export function createInput() {
  const keys = {};
  const mouse = { x: 0, y: 0, down: false };
  const pressed = {};
  function attach(target, canvas) {
    target.addEventListener('keydown', (e) => {
      if (!keys[e.code]) pressed[e.code] = true;
      keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    target.addEventListener('keyup', (e) => { keys[e.code] = false; });
    if (canvas) {
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
        mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
      });
      canvas.addEventListener('mousedown', () => { mouse.down = true; });
      canvas.addEventListener('mouseup', () => { mouse.down = false; });
    }
  }
  function wasPressed(code) {
    const v = !!pressed[code];
    pressed[code] = false;
    return v;
  }
  function clearPressed() { for (const k of Object.keys(pressed)) delete pressed[k]; }
  return { keys, mouse, attach, wasPressed, clearPressed };
}

export function moveAxis(keys) {
  const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  return { x, y };
}
