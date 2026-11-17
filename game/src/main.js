// SOLMAR HEAT — main.js
// The game loop and the screen state machine: title -> play -> pause /
// wasted / busted / complete. Wires input, audio, the world and the
// renderer together, and honours ?shot=<name>&seed=<n> for screenshots.

import { GAME, VIEW_W, VIEW_H } from './config.js';
import { createWorld, stepWorld, startMission, saveGame, loadSave, applySave } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { render } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || GAME.seed) || GAME.seed;

let world;
let saveExists = !!loadSave();

if (shotName) {
  // Screenshot mode: stage the scene deterministically, draw once.
  world = stageShot(shotName, seed);
  saveExists = false;
  render(ctx, world, { mouse: { x: 640, y: 360, down: false, clicked: false } }, saveExists);
  document.title = `SOLMAR HEAT — shot ${shotName}`;
} else {
  world = createWorld(seed);
  world.saveExists = saveExists;
  const input = createInput(canvas);
  const audio = createAudio();
  let last = performance.now();

  function mouseWorld() {
    const cam = world.camera;
    return {
      x: cam.x - VIEW_W / 2 + input.mouse.x,
      y: cam.y - VIEW_H / 2 + input.mouse.y,
    };
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (input.wasPressed('m')) {
      const muted = audio.toggleMute();
      document.getElementById('mute-note').textContent = muted ? 'MUTED (M)' : '';
    }

    if (world.screen === 'title') {
      if (input.wasPressed('enter') || input.wasPressed(' ')) {
        audio.unlock();
        world.screen = 'play';
        if (world.missionState === 'idle') startMission(world, audio);
      } else if (input.wasPressed('c') && saveExists) {
        audio.unlock();
        const save = loadSave();
        if (save) applySave(world, save);
        world.screen = 'play';
      }
    } else if (world.screen === 'play') {
      if (input.wasPressed('p') || input.wasPressed('escape')) {
        world.screen = 'pause';
      } else {
        stepWorld(world, input, audio, dt, mouseWorld());
      }
    } else if (world.screen === 'pause') {
      if (input.wasPressed('enter') || input.wasPressed('p') || input.wasPressed('escape')) {
        world.screen = 'play';
      } else if (input.wasPressed('s')) {
        saveGame(world);
        world.saveExists = true;
      } else if (input.wasPressed('t')) {
        world.screen = 'title';
      }
    } else if (world.screen === 'wasted' || world.screen === 'busted' || world.screen === 'complete') {
      if (input.wasPressed('enter')) {
        world.screen = 'play';
        world.banner = null;
        if (world.screen === 'play' && world.missionState === 'idle' && !world.storyDone) {
          startMission(world, audio);
        }
      }
    }

    // The title screen pans over the city on its own clock.
    if (world.screen === 'title') world.clock += dt;

    render(ctx, world, input, saveExists || world.saveExists);
    input.endFrame();
    requestAnimationFrame(frame);
  }

  // Any first click/keypress unlocks audio (browsers require a gesture).
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  requestAnimationFrame(frame);
}
