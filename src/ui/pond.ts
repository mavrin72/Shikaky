import gsap from 'gsap';
import { AdvancedBloomFilter, GodrayFilter } from 'pixi-filters';
import { Application, BlurFilter, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { CHAIN, FINAL_TIER, frogData, Pond } from '../core/pond';
import { basketBest, recordBasket } from '../core/storage';
import { clamp, h } from './dom';
import { buzz, confetti, motionOff, toast } from './fx';
import {
  bokehCanvas,
  frogCanvas,
  glassCanvas,
  isLight,
  lighten,
  lilyCanvas,
  pondBackdropCanvas,
  shadowCanvas,
  TEX_SCALE,
} from './frogArt';
import { sfx } from './sound';

const INK = 0x1a1410;
const CREAM = 0xfffdf6;

type Mood = 'idle' | 'scared' | 'happy' | 'hit' | 'dizzy' | 'worried';

interface EyeRig {
  root: Container;
  pupil: Graphics;
  lid: Graphics;
}

interface FrogView {
  root: Container;
  shadow: Sprite;
  body: Sprite;
  face: Container;
  eyes: EyeRig[];
  mouth: Graphics;
  tier: number;
  r: number;
  mood: Mood;
  moodUntil: number;
  nextBlink: number;
  px: number;
  py: number;
}

export interface PondCallbacks {
  onScore: (score: number, best: number) => void;
  onNext: (tier: number, after: number) => void;
  onReach: (tier: number) => void;
  onCombo: (combo: number, left: number) => void;
  onShakes: (left: number) => void;
  onOver: (score: number, best: number) => void;
}

export interface PondViewHandles {
  el: HTMLElement;
  pond: Pond;
  restart: () => void;
  shake: () => void;
  destroy: () => void;
}

export function createPondView(cb: PondCallbacks): PondViewHandles {
  const pond = new Pond();
  const wrap = h('div', { class: 'pond' }) as HTMLDivElement;
  const app = new Application();
  const views = new Map<number, FrogView>();

  const world = new Container();
  const bgLayer = new Container();
  const shadowLayer = new Container();
  const frogLayer = new Container();
  const fxLayer = new Container();
  const fgLayer = new Container();
  const uiLayer = new Container();
  world.addChild(bgLayer, shadowLayer, frogLayer, fxLayer, fgLayer, uiLayer);

  const textures = new Map<number, Texture>();
  let shadowTexture: Texture | null = null;
  let aimX = pond.width / 2;
  let clock = 0;
  let ready = false;
  let disposed = false;
  let shownScore = -1;
  let shownNext = -1;
  let shownTop = -1;
  let shownShakes = -1;
  let preview: FrogView | null = null;
  let guide: Graphics | null = null;
  let dangerLine: Graphics | null = null;
  let godray: GodrayFilter | null = null;
  let surface: Graphics | null = null;

  const textureFor = (tier: number): Texture => {
    const cached = textures.get(tier);
    if (cached) return cached;
    const texture = Texture.from(frogCanvas(tier, pond.radiusOf(tier)));
    textures.set(tier, texture);
    return texture;
  };

  // ------------------------------------------------------------- the pond
  function buildBackground(): void {
    const rich = !motionOff();

    const backdrop = new Sprite(Texture.from(pondBackdropCanvas(pond.width, pond.height)));
    backdrop.width = pond.width;
    backdrop.height = pond.height;
    bgLayer.addChild(backdrop);

    // Sun shafts: a real godray shader over the upper water.
    if (rich) {
      const rays = new Graphics();
      rays.rect(0, 0, pond.width, pond.height).fill({ color: 0xffffff, alpha: 0.001 });
      godray = new GodrayFilter({ alpha: 0.32, gain: 0.35, lacunarity: 2.4, angle: -32, parallel: true });
      rays.filters = [godray];
      bgLayer.addChild(rays);
    }

    // The surface: a moving water line the frogs fall through.
    surface = new Graphics();
    bgLayer.addChild(surface);

    // Bokeh motes rising through the water.
    const moteTexture = Texture.from(bokehCanvas());
    const fireflyTexture = Texture.from(bokehCanvas('255, 226, 130'));
    const motes = rich ? 22 : 8;
    for (let i = 0; i < motes; i++) {
      const mote = new Sprite(moteTexture);
      mote.anchor.set(0.5);
      const size = 6 + Math.random() * 16;
      mote.width = size;
      mote.height = size;
      mote.alpha = 0.1 + Math.random() * 0.3;
      mote.blendMode = 'add';
      bgLayer.addChild(mote);
      const drift = (): void => {
        const x = 12 + Math.random() * (pond.width - 24);
        mote.position.set(x, pond.height + 10);
        gsap.to(mote, {
          y: pond.lineY - 20 - Math.random() * 60,
          x: x + (Math.random() - 0.5) * 60,
          duration: 7 + Math.random() * 9,
          delay: Math.random() * 6,
          ease: 'none',
          onComplete: drift,
        });
      };
      drift();
    }

    // Fireflies over the water, blinking on their own schedule.
    if (rich) {
      for (let i = 0; i < 4; i++) {
        const fly = new Sprite(fireflyTexture);
        fly.anchor.set(0.5);
        fly.width = 20;
        fly.height = 20;
        fly.alpha = 0;
        fly.blendMode = 'add';
        fgLayer.addChild(fly);
        const wander = (): void => {
          gsap.to(fly, {
            x: 20 + Math.random() * (pond.width - 40),
            y: pond.lineY * 0.4 + Math.random() * pond.height * 0.5,
            duration: 3 + Math.random() * 4,
            ease: 'sine.inOut',
            onComplete: wander,
          });
        };
        fly.position.set(Math.random() * pond.width, Math.random() * pond.height * 0.6);
        wander();
        gsap.to(fly, {
          alpha: 0.85,
          duration: 0.6 + Math.random(),
          repeat: -1,
          yoyo: true,
          delay: Math.random() * 3,
          ease: 'sine.inOut',
        });
      }
    }

    // Foreground lily pads, thrown out of focus.
    for (const [x, y, r, rot] of [[-10, pond.height - 30, 80, 0.2], [pond.width + 8, pond.height - 64, 64, -0.5]] as const) {
      const lily = new Sprite(Texture.from(lilyCanvas(r)));
      lily.anchor.set(0.5);
      lily.position.set(x, y);
      lily.rotation = rot;
      lily.alpha = 0.85;
      lily.scale.y = 0.6;
      fgLayer.addChild(lily);
    }

    // Glass sheen and vignette on top of the whole scene.
    const glass = new Sprite(Texture.from(glassCanvas(pond.width, pond.height)));
    glass.width = pond.width;
    glass.height = pond.height;
    fgLayer.addChild(glass);

    if (rich) {
      fxLayer.filters = [new AdvancedBloomFilter({ threshold: 0.55, bloomScale: 1.1, brightness: 1, blur: 5 })];
      const haze = new BlurFilter({ strength: 0.6 });
      backdrop.filters = [haze];
    }

    dangerLine = new Graphics();
    for (let x = 0; x < pond.width; x += 18) {
      dangerLine.rect(x, pond.lineY - 1.5, 10, 3);
    }
    dangerLine.fill({ color: 0xff4d4d });
    uiLayer.addChild(dangerLine);

    guide = new Graphics();
    guide.rect(-1.5, 0, 3, pond.height).fill({ color: 0xffffff, alpha: 0.22 });
    uiLayer.addChild(guide);
  }

  /** The water line ripples all the time — a still surface looks like a picture. */
  function drawSurface(): void {
    if (!surface) return;
    const y = pond.lineY + 6;
    surface.clear();
    surface.moveTo(0, y);
    for (let x = 0; x <= pond.width; x += 10) {
      surface.lineTo(x, y + Math.sin(x / 28 + clock * 1.6) * 2.4 + Math.sin(x / 11 - clock * 2.3) * 1.1);
    }
    surface.stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
    surface.moveTo(0, y + 5);
    for (let x = 0; x <= pond.width; x += 10) {
      surface.lineTo(x, y + 5 + Math.sin(x / 22 - clock * 1.1) * 2);
    }
    surface.stroke({ width: 1.2, color: 0xffffff, alpha: 0.18 });
  }

  // --------------------------------------------------------------- a frog
  function buildFace(tier: number, r: number): { face: Container; eyes: EyeRig[]; mouth: Graphics } {
    const item = CHAIN[tier];
    const face = new Container();
    const eyes: EyeRig[] = [];
    if (tier === 0) return { face, eyes, mouth: new Graphics() };
    const tiny = tier === 1;
    const domeR = r * (tiny ? 0.26 : 0.34);
    const eyeX = r * (tiny ? 0.34 : 0.46);
    const eyeY = -r * (tiny ? 0.3 : 0.54);

    for (const side of [-1, 1]) {
      const root = new Container();
      root.position.set(side * eyeX, eyeY);
      const pupil = new Graphics();
      const lid = new Graphics();

      {
        const dome = new Graphics();
        dome.circle(0, 0, domeR).fill({ color: Number(`0x${lighten(item.fill, 0.24).match(/\d+/g)!.map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`) });
        dome.circle(0, 0, domeR).stroke({ width: Math.max(1.6, r * 0.05), color: INK });
        const sclera = new Graphics();
        sclera.circle(0, 0, domeR * 0.72).fill({ color: CREAM });
        pupil.circle(0, 0, domeR * 0.44).fill({ color: INK });
        pupil.circle(domeR * 0.16, -domeR * 0.16, domeR * 0.15).fill({ color: CREAM });
        lid.circle(0, 0, domeR * 0.8).fill({ color: INK, alpha: 0.92 });
        lid.scale.y = 0;
        root.addChild(dome, sclera, pupil, lid);
      }

      face.addChild(root);
      eyes.push({ root, pupil, lid });
    }

    const mouth = new Graphics();
    face.addChild(mouth);
    return { face, eyes, mouth };
  }

  function paintMouth(view: FrogView): void {
    const { mouth, r, mood } = view;
    const ink = isLight(CHAIN[view.tier].fill) ? INK : 0x2a1f2e;
    mouth.clear();
    if (view.tier === 0) return;
    const y = r * 0.16;
    const width = Math.max(2, r * 0.09);
    if (mood === 'happy') {
      mouth.moveTo(-r * 0.4, y - r * 0.05)
        .quadraticCurveTo(0, y + r * 0.42, r * 0.4, y - r * 0.05)
        .quadraticCurveTo(0, y + r * 0.12, -r * 0.4, y - r * 0.05)
        .fill({ color: ink });
    } else if (mood === 'scared' || mood === 'hit') {
      mouth.ellipse(0, y + r * 0.1, r * 0.16, r * 0.2).fill({ color: ink });
    } else if (mood === 'worried') {
      mouth.moveTo(-r * 0.26, y)
        .quadraticCurveTo(-r * 0.1, y - r * 0.12, 0, y)
        .quadraticCurveTo(r * 0.1, y + r * 0.12, r * 0.26, y)
        .stroke({ width, color: ink, cap: 'round' });
    } else {
      mouth.moveTo(-r * 0.36, y)
        .quadraticCurveTo(0, y + r * 0.26, r * 0.36, y)
        .stroke({ width, color: ink, cap: 'round' });
    }
    // Nostrils.
    if (view.tier >= 3) {
      mouth.circle(-r * 0.12, -r * 0.08, r * 0.045).circle(r * 0.12, -r * 0.08, r * 0.045).fill({ color: ink, alpha: 0.7 });
    }
  }

  function makeFrog(tier: number, r: number): FrogView {
    const root = new Container();
    const body = new Sprite(textureFor(tier));
    body.anchor.set(0.5);
    const texR = Math.max(24, pond.radiusOf(tier) * TEX_SCALE);
    body.scale.set(r / texR);
    root.addChild(body);

    const { face, eyes, mouth } = buildFace(tier, r);
    root.addChild(face);

    const shadow = new Sprite(shadowTexture ?? Texture.WHITE);
    shadow.anchor.set(0.5);
    shadow.width = r * 2.5;
    shadow.height = r * 1.1;
    shadow.alpha = 0.5;
    shadowLayer.addChild(shadow);

    const view: FrogView = {
      root, shadow, body, face, eyes, mouth,
      tier, r,
      mood: 'idle',
      moodUntil: 0,
      nextBlink: clock + 1 + Math.random() * 3,
      px: 0,
      py: 0,
    };
    paintMouth(view);
    frogLayer.addChild(root);
    return view;
  }

  function setMood(view: FrogView, mood: Mood, seconds: number): void {
    if (view.mood === mood) {
      view.moodUntil = clock + seconds;
      return;
    }
    view.mood = mood;
    view.moodUntil = clock + seconds;
    paintMouth(view);
    if (mood === 'dizzy' || mood === 'happy') {
      for (const eye of view.eyes) gsap.to(eye.lid.scale, { y: 1, duration: 0.12 });
    } else {
      for (const eye of view.eyes) gsap.to(eye.lid.scale, { y: 0, duration: 0.12 });
    }
  }

  function blink(view: FrogView): void {
    if (view.mood === 'happy' || view.mood === 'dizzy') return;
    for (const eye of view.eyes) {
      gsap.timeline()
        .to(eye.lid.scale, { y: 1, duration: 0.07, ease: 'power2.in' })
        .to(eye.lid.scale, { y: 0, duration: 0.09, ease: 'power2.out' });
    }
  }

  // ------------------------------------------------------------- effects
  function burst(x: number, y: number, r: number, color: number): void {
    if (motionOff()) return;
    const ring = new Graphics();
    ring.circle(0, 0, r).stroke({ width: 6, color: CREAM });
    ring.position.set(x, y);
    fxLayer.addChild(ring);
    gsap.to(ring.scale, { x: 2.1, y: 2.1, duration: 0.42, ease: 'power2.out' });
    gsap.to(ring, { alpha: 0, duration: 0.42, onComplete: () => ring.destroy() });

    for (let i = 0; i < 9; i++) {
      const bit = new Graphics();
      const size = r * 0.24;
      bit.roundRect(-size / 2, -size / 2, size, size, size * 0.3).fill({ color }).stroke({ width: 2, color: INK });
      bit.position.set(x, y);
      fxLayer.addChild(bit);
      const angle = (i / 9) * Math.PI * 2;
      gsap.to(bit, {
        x: x + Math.cos(angle) * r * 2.4,
        y: y + Math.sin(angle) * r * 2.4 - 10,
        rotation: (Math.random() - 0.5) * 6,
        alpha: 0,
        duration: 0.55,
        ease: 'power2.out',
        onComplete: () => bit.destroy(),
      });
    }
  }

  function splash(x: number, y: number, r: number): void {
    if (motionOff()) return;
    for (let i = 0; i < 5; i++) {
      const drop = new Graphics();
      drop.circle(0, 0, 2 + Math.random() * 3).fill({ color: 0xffffff, alpha: 0.75 });
      drop.position.set(x + (Math.random() - 0.5) * r, y + r * 0.7);
      fxLayer.addChild(drop);
      gsap.to(drop, {
        x: drop.x + (Math.random() - 0.5) * r * 2,
        y: drop.y - 12 - Math.random() * 20,
        alpha: 0,
        duration: 0.4,
        ease: 'power1.out',
        onComplete: () => drop.destroy(),
      });
    }
  }

  function shakeStage(strength: number): void {
    if (motionOff()) return;
    gsap.fromTo(
      world,
      { x: -strength },
      { x: 0, duration: 0.45, ease: 'elastic.out(1, 0.25)' },
    );
  }

  // ---------------------------------------------------------------- loop
  function syncFrogs(dt: number): void {
    const alive = new Set<number>();
    let faller: Matter.Body | null = null;
    for (const body of pond.frogs) {
      if (body.velocity.y > 4 && (!faller || body.velocity.y > faller.velocity.y)) faller = body;
    }
    const pendingR = pond.radiusOf(pond.next);
    const aimPoint = { x: clamp(aimX, pendingR, pond.width - pendingR), y: pond.lineY - pendingR };

    for (const body of pond.frogs) {
      alive.add(body.id);
      const data = frogData(body);
      let view = views.get(body.id);
      if (!view) {
        view = makeFrog(data.tier, body.circleRadius ?? pond.radiusOf(data.tier));
        views.set(body.id, view);
      }
      view.root.position.set(body.position.x, body.position.y);
      view.root.rotation = body.angle;
      // Eyes stay on top of the head no matter how the frog has rolled.
      view.face.rotation = -body.angle;
      view.shadow.position.set(body.position.x, Math.min(body.position.y + view.r * 0.95, pond.height - 8));
      view.shadow.alpha = 0.45;

      if (clock > view.nextBlink) {
        view.nextBlink = clock + 1.4 + Math.random() * 3.4;
        blink(view);
      }
      if (view.mood !== 'idle' && clock > view.moodUntil) setMood(view, 'idle', 0);

      const watching = faller && faller !== body && faller.position.y < body.position.y ? faller : null;
      const target = watching ?? (pond.canDrop && !pond.over ? aimPoint : null);
      let tx = 0;
      let ty = 0;
      if (target) {
        const dx = (target === watching ? watching.position.x : aimPoint.x) - body.position.x;
        const dy = (target === watching ? watching.position.y : aimPoint.y) - body.position.y;
        const dist = Math.hypot(dx, dy) || 1;
        tx = dx / dist;
        ty = dy / dist;
      } else {
        tx = Math.sin(clock * 0.7 + body.id) * 0.5;
        ty = Math.sin(clock * 0.45 + body.id * 2) * 0.3;
      }
      view.px += (tx - view.px) * Math.min(1, dt * 9);
      view.py += (ty - view.py) * Math.min(1, dt * 9);
      const reach = view.r * (view.tier === 1 ? 0.09 : 0.14);
      for (const eye of view.eyes) eye.pupil.position.set(view.px * reach, view.py * reach);

      if (view.mood === 'idle' || view.mood === 'worried' || view.mood === 'scared') {
        const incoming =
          watching &&
          Math.abs(watching.position.x - body.position.x) < ((watching.circleRadius ?? 0) + view.r) * 1.15 &&
          body.position.y - watching.position.y < view.r * 6;
        if (incoming) setMood(view, 'scared', 0.3);
        else if (data.age > 0.7 && body.position.y - view.r < pond.lineY + view.r * 0.8) setMood(view, 'worried', 0.4);
      }
    }

    for (const [id, view] of views) {
      if (alive.has(id)) continue;
      views.delete(id);
      view.shadow.destroy();
      view.root.destroy({ children: true });
    }
  }

  function updatePreview(): void {
    if (!ready) return;
    const show = !pond.over && pond.canDrop;
    if (preview && preview.tier !== pond.next) {
      preview.root.destroy({ children: true });
      preview.shadow.destroy();
      preview = null;
    }
    if (!show) {
      if (preview) preview.root.visible = false;
      if (guide) guide.visible = false;
      return;
    }
    const r = pond.radiusOf(pond.next);
    if (!preview) {
      preview = makeFrog(pond.next, r);
      preview.shadow.visible = false;
    }
    preview.root.visible = true;
    const x = clamp(aimX, r + 2, pond.width - r - 2);
    preview.root.position.set(x, pond.lineY - r - 10 + Math.sin(clock * 3.2) * 3);
    for (const eye of preview.eyes) eye.pupil.position.set(0, r * 0.05);
    if (guide) {
      guide.visible = true;
      guide.position.set(x, pond.lineY);
      guide.alpha = 0.5;
    }
  }

  function handleEvents(): void {
    for (const event of pond.drain()) {
      if (event.type === 'drop') {
        sfx.tap();
      } else if (event.type === 'land') {
        const view = views.get(event.id);
        if (view) {
          setMood(view, 'hit', 0.26);
          if (!motionOff()) {
            gsap.fromTo(view.body.scale, { x: view.body.scale.x * 1.18, y: view.body.scale.y * 0.82 }, { x: view.body.scale.x, y: view.body.scale.y, duration: 0.32, ease: 'elastic.out(1, 0.4)' });
            splash(view.root.x, view.root.y, view.r);
          }
        }
      } else if (event.type === 'shake') {
        sfx.erase();
        buzz([14, 30, 14]);
        shakeStage(16);
        for (const view of views.values()) setMood(view, 'dizzy', 1.2 + Math.random() * 0.5);
        cb.onShakes(pond.shakesLeft);
      } else if (event.type === 'merge') {
        sfx.merge(event.tier);
        buzz(event.tier > 6 ? 18 : 8);
        burst(event.x, event.y, pond.radiusOf(event.tier), Number(`0x${CHAIN[event.tier].fill.slice(1)}`));
        shakeStage(Math.min(14, 3 + event.tier));
        popup(event.x, event.y, `+${event.gain}`, event.combo);
        const view = views.get(event.id);
        if (view) {
          setMood(view, 'happy', 0.9);
          gsap.fromTo(view.root.scale, { x: 0.45, y: 0.45 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2.4)' });
        }
        cb.onCombo(pond.combo, pond.comboLeft);
      } else if (event.type === 'final') {
        sfx.win();
        const box = app.canvas.getBoundingClientRect();
        confetti({
          x: box.left + (event.x / pond.width) * box.width,
          y: box.top + (event.y / pond.height) * box.height,
        });
        toast('Цар-Жаб зібраний!');
      } else if (event.type === 'over') {
        sfx.wrong();
        const { best } = recordBasket(pond.score);
        cb.onOver(pond.score, best);
      }
    }
  }

  function popup(x: number, y: number, text: string, combo: number): void {
    const label = h('div', { class: 'pond__popup' }, text) as HTMLDivElement;
    if (combo > 1) label.append(h('b', {}, `КОМБО ×${combo}`));
    const box = app.canvas.getBoundingClientRect();
    const wrapBox = wrap.getBoundingClientRect();
    label.style.left = `${box.left - wrapBox.left + (x / pond.width) * box.width}px`;
    label.style.top = `${box.top - wrapBox.top + (y / pond.height) * box.height}px`;
    wrap.append(label);
    gsap.to(label, { y: -46, opacity: 0, duration: 0.95, ease: 'power1.out', onComplete: () => label.remove() });
  }

  function resize(): void {
    if (!ready) return;
    const width = wrap.clientWidth || 340;
    const height = width * (pond.height / pond.width);
    app.renderer.resize(width, height);
    world.scale.set(width / pond.width);
  }

  let dragging = false;
  const worldX = (clientX: number): number => {
    const box = app.canvas.getBoundingClientRect();
    return clamp(((clientX - box.left) / box.width) * pond.width, 0, pond.width);
  };

  function bindInput(): void {
    const canvas = app.canvas;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      dragging = true;
      aimX = worldX(event.clientX);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (dragging || event.pointerType === 'mouse') aimX = worldX(event.clientX);
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!dragging) return;
      dragging = false;
      aimX = worldX(event.clientX);
      pond.drop(aimX);
    });
    canvas.addEventListener('pointercancel', () => {
      dragging = false;
    });
  }

  void app
    .init({
      width: 360,
      height: 440,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2.5),
      autoDensity: true,
      preference: 'webgl',
    })
    .then(() => {
      if (disposed) return;
      ready = true;
      shadowTexture = Texture.from(shadowCanvas());
      app.stage.addChild(world);
      buildBackground();
      wrap.append(app.canvas);
      bindInput();
      resize();

      // Matter integrates with delta squared, so the step has to be fixed —
      // feeding it whatever the frame took makes gravity come and go.
      const FIXED = 1 / 60;
      let accumulator = 0;
      app.ticker.add((ticker) => {
        const dt = Math.min(ticker.deltaMS / 1000, 1 / 15);
        clock += dt;
        accumulator += dt;
        let steps = 0;
        while (accumulator >= FIXED && steps < 5) {
          pond.step(FIXED);
          accumulator -= FIXED;
          steps++;
        }
        syncFrogs(dt);
        updatePreview();
        handleEvents();

        if (pond.score !== shownScore) {
          shownScore = pond.score;
          cb.onScore(pond.score, Math.max(basketBest(), pond.score));
        }
        if (pond.next !== shownNext) {
          shownNext = pond.next;
          cb.onNext(pond.next, pond.queued);
        }
        if (pond.shakesLeft !== shownShakes) {
          shownShakes = pond.shakesLeft;
          cb.onShakes(pond.shakesLeft);
        }
        const top = pond.frogs.reduce((max, body) => Math.max(max, frogData(body).tier), -1);
        if (top > shownTop) {
          shownTop = top;
          cb.onReach(top);
        }
        cb.onCombo(pond.combo, pond.comboLeft);

        drawSurface();
        if (godray) godray.time += dt * 0.5;
        const danger = pond.frogs.some((body) => frogData(body).age > 0.7 && body.position.y - (body.circleRadius ?? 0) < pond.lineY);
        if (dangerLine) dangerLine.alpha = danger ? 0.5 + 0.5 * Math.sin(clock * 9) : 0.8;
        world.alpha = pond.over ? 0.55 : 1;
      });
    });

  const observer = new ResizeObserver(() => resize());
  observer.observe(wrap);

  return {
    el: wrap,
    pond,
    restart: () => {
      pond.reset();
      for (const [, view] of views) {
        view.shadow.destroy();
        view.root.destroy({ children: true });
      }
      views.clear();
      world.alpha = 1;
      shownScore = -1;
      shownNext = -1;
      shownTop = -1;
      shownShakes = -1;
    },
    shake: () => {
      if (!pond.shake()) toast('Струси закінчились');
    },
    destroy: () => {
      disposed = true;
      if (pond.score > 0) recordBasket(pond.score);
      observer.disconnect();
      gsap.globalTimeline.clear();
      if (ready) app.destroy(true, { children: true });
    },
  };
}

export { CHAIN, FINAL_TIER };
