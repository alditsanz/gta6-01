// main.js — the game itself: state machine, frame loop, wiring between the
// world, the renderer, the sound bank and the player's input. No game logic
// lives here; it lives in world.js, render.js, combat.js, sidejobs.js and
// collectibles.js.
import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { applyShot } from './shots.js';
import { MISSIONS, SEED_DEFAULT, SAVE_KEY } from './config.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.sound = new SoundBank();
    const params = new URLSearchParams(window.location.search);
    this.seed = Number(params.get('seed') || SEED_DEFAULT);
    this.shot = params.get('shot');
    this.world = new World(this.seed);
    this.state = 'start'; // start | story | board | play | pause | wasted | complete
    this.saveExists = false;
    try {
      this.saveExists = !!localStorage.getItem(SAVE_KEY);
    } catch {
      this.saveExists = false;
    }
    if (this.saveExists) {
      const saved = World.load();
      if (saved) this.world.applySave(saved);
    }
    this.world.onShoot = () => this.sound.shoot();
    this.world.onPickup = () => this.sound.pickup();
    this.world.onCoin = () => this.sound.coin();
    this.world.onNearMiss = () => this.sound.nearMiss();
    this.world.onCrash = () => this.sound.crash();
    this.world.onMissionDone = () => this.sound.missionDone();
    this.world.onWasted = () => this.sound.busted();
    this.completeShown = false;
    this.lastTime = performance.now();
    this.autosaveTimer = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (this.shot) {
      const hint = document.getElementById('hint');
      if (hint) hint.remove();
      applyShot(this, this.shot, this.seed);
      this.renderer.follow(this.world.player.x, this.world.player.y);
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.step(dt);
    this.draw();
    this.input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }

  step(dt) {
    const input = this.input;
    const world = this.world;
    if (input.tapped('KeyM')) {
      const muted = this.sound.toggleMute();
      world.flash(muted ? 'Sound muted' : 'Sound on');
    }
    if (this.state === 'start') {
      if (input.tapped('Enter') || input.mouse.clicked || input.tapped('NumpadEnter')) {
        this.sound.ensure();
        this.sound.startMusic();
        this.state = 'story';
      } else if (input.tapped('KeyC') && this.saveExists) {
        this.sound.ensure();
        this.sound.startMusic();
        this.state = 'play';
      }
      return;
    }
    if (this.state === 'story') {
      if (input.tapped('Enter') || input.mouse.clicked) this.state = 'board';
      return;
    }
    if (this.state === 'board') {
      for (let i = 0; i < MISSIONS.length; i++) {
        if (input.tapped(`Digit${i + 1}`) || input.tapped(`Numpad${i + 1}`)) {
          if (i <= world.missionIndex) {
            world.startMission(i);
            this.sound.missionStart();
            this.state = 'play';
            return;
          }
        }
      }
      if (input.tapped('Escape')) this.state = 'play';
      return;
    }
    if (this.state === 'pause') {
      if (input.tapped('KeyP') || input.tapped('Escape')) this.state = 'play';
      if (input.tapped('KeyS')) world.save();
      if (input.tapped('KeyQ')) this.state = 'start';
      return;
    }
    if (this.state === 'wasted') {
      if (input.tapped('Enter') || input.mouse.clicked) {
        world.respawn();
        this.state = 'play';
      }
      return;
    }
    if (this.state === 'complete') {
      if (input.tapped('Enter') || input.mouse.clicked) this.state = 'play';
      return;
    }
    // play
    if (input.tapped('KeyP') || input.tapped('Escape')) {
      this.state = 'pause';
      return;
    }
    if (input.tapped('Tab')) {
      this.state = 'board';
      return;
    }
    // aim with the mouse when on foot: the shot follows the cursor in the world
    if (world.player.onFoot && input.mouse.down) {
      const target = this.renderer.screenToWorld(input.mouse.x, input.mouse.y);
      const aim = Math.atan2(target.y - world.player.y, target.x - world.player.x);
      if (world.player.shootCooldown <= 0) world.shoot(aim);
    }
    world.update(input, dt);
    if (world.wasted) {
      this.state = 'wasted';
      return;
    }
    if (world.storyComplete && !this.completeShown) {
      this.completeShown = true;
      this.state = 'complete';
      return;
    }
    const car = world.player.car;
    this.sound.engine(car ? car.speed : 0, car ? 350 : 1, !world.player.onFoot);
    this.sound.siren(world.police.length > 0);
    this.autosaveTimer += dt;
    if (this.autosaveTimer > 30) {
      this.autosaveTimer = 0;
      world.save();
    }
  }

  draw() {
    const r = this.renderer;
    const world = this.world;
    r.follow(world.player.x, world.player.y);
    if (this.state === 'start') {
      r.drawStart(world, this.saveExists);
      return;
    }
    r.drawWorld(world);
    if (this.state === 'story') {
      r.drawStory(world);
    } else if (this.state === 'board') {
      r.drawMissionBoard(world);
    } else if (this.state === 'pause') {
      r.drawPause(world);
    } else if (this.state === 'wasted') {
      r.drawWasted(world);
    } else if (this.state === 'complete') {
      r.drawComplete(world);
    } else {
      r.drawHud(world);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  if (canvas) new Game(canvas);
});
