import * as THREE from 'three';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 3D background: neural network sphere + particle field ---------- */
const canvas = document.getElementById('bg3d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070b16, 0.045);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 9);

const cyan = new THREE.Color(0x38e1ff);
const violet = new THREE.Color(0x8b5cf6);

// Network sphere: nodes on a sphere, connected to near neighbours
const brain = new THREE.Group();
scene.add(brain);
const NODE_COUNT = window.innerWidth < 700 ? 110 : 180;
const R = 3.1;
const nodes = [];
for (let i = 0; i < NODE_COUNT; i++) {
  // Fibonacci sphere for even spread
  const y = 1 - (i / (NODE_COUNT - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const theta = Math.PI * (3 - Math.sqrt(5)) * i;
  const jitter = 1 + (Math.random() - 0.5) * 0.18;
  nodes.push(new THREE.Vector3(Math.cos(theta) * r * R * jitter, y * R * jitter, Math.sin(theta) * r * R * jitter));
}
const nodeColors = [];
nodes.forEach((n) => {
  const c = cyan.clone().lerp(violet, (n.y / R + 1) / 2);
  nodeColors.push(c.r, c.g, c.b);
});
const nodeGeo = new THREE.BufferGeometry().setFromPoints(nodes);
nodeGeo.setAttribute('color', new THREE.Float32BufferAttribute(nodeColors, 3));
const dotTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
brain.add(new THREE.Points(nodeGeo, new THREE.PointsMaterial({
  size: 0.16, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
})));

const linePos = [];
const lineCol = [];
const MAX_D = 1.15;
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    if (nodes[i].distanceTo(nodes[j]) < MAX_D) {
      linePos.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z);
      const ci = nodeColors.slice(i * 3, i * 3 + 3);
      const cj = nodeColors.slice(j * 3, j * 3 + 3);
      lineCol.push(...ci, ...cj);
    }
  }
}
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineCol, 3));
brain.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
  vertexColors: true, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false,
})));

// Inner glowing wireframe core
const core = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.25, 1),
  new THREE.MeshBasicMaterial({ color: 0x8b5cf6, wireframe: true, transparent: true, opacity: 0.35 })
);
brain.add(core);

// Signal pulses travelling along random edges
const PULSES = 26;
const edgeCount = linePos.length / 6;
const pulseGeo = new THREE.BufferGeometry();
const pulseArr = new Float32Array(PULSES * 3);
pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulseArr, 3));
const pulses = Array.from({ length: PULSES }, () => ({ e: Math.floor(Math.random() * edgeCount), t: Math.random(), s: 0.004 + Math.random() * 0.01 }));
brain.add(new THREE.Points(pulseGeo, new THREE.PointsMaterial({
  size: 0.26, map: dotTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
})));

// Far particle field
const STARS = 900;
const starArr = new Float32Array(STARS * 3);
for (let i = 0; i < STARS; i++) {
  starArr[i * 3] = (Math.random() - 0.5) * 50;
  starArr[i * 3 + 1] = (Math.random() - 0.5) * 50;
  starArr[i * 3 + 2] = -Math.random() * 30 - 2;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starArr, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.06, color: 0x9fb6ff, transparent: true, opacity: 0.7 }));
scene.add(stars);

// Layout: sphere on the right on desktop, centred behind content on mobile
function place() {
  const w = window.innerWidth;
  brain.position.set(w > 900 ? 3.4 : 0, w > 900 ? 0.2 : 0.8, 0);
  brain.scale.setScalar(w > 900 ? 1 : 0.8);
}
place();

const mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  place();
});

const clock = new THREE.Clock();
function frame() {
  const t = clock.getElapsedTime();
  const scrollK = window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);

  brain.rotation.y = t * 0.12 + mouse.x * 0.4 + scrollK * Math.PI * 1.5;
  brain.rotation.x = Math.sin(t * 0.2) * 0.15 + mouse.y * 0.25;
  core.rotation.x = -t * 0.3;
  core.rotation.z = t * 0.2;
  camera.position.z = 9 + scrollK * 3;
  stars.rotation.z = t * 0.01;
  stars.position.y = scrollK * 4;

  for (let i = 0; i < PULSES; i++) {
    const p = pulses[i];
    p.t += p.s;
    if (p.t > 1) { p.t = 0; p.e = Math.floor(Math.random() * edgeCount); }
    const o = p.e * 6;
    pulseArr[i * 3] = linePos[o] + (linePos[o + 3] - linePos[o]) * p.t;
    pulseArr[i * 3 + 1] = linePos[o + 1] + (linePos[o + 4] - linePos[o + 1]) * p.t;
    pulseArr[i * 3 + 2] = linePos[o + 2] + (linePos[o + 5] - linePos[o + 2]) * p.t;
  }
  pulseGeo.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
  if (!reduceMotion) requestAnimationFrame(frame);
}
frame();

/* ---------- Typed role text ---------- */
const roles = ['Full Stack Developer', 'AI / ML Engineer', 'Generative AI Engineer', 'Team Lead', 'Co-Founder, EduData365'];
const typed = document.getElementById('typed');
if (!reduceMotion) {
  let ri = 0, ci = roles[0].length, del = true;
  const tick = () => {
    const word = roles[ri];
    ci += del ? -1 : 1;
    typed.textContent = word.slice(0, ci);
    let wait = del ? 40 : 80;
    if (!del && ci === word.length) { del = true; wait = 1800; }
    else if (del && ci === 0) { del = false; ri = (ri + 1) % roles.length; wait = 300; }
    setTimeout(tick, wait);
  };
  setTimeout(tick, 2000);
}

/* ---------- Reveal on scroll + counters ---------- */
const countUp = (el) => {
  const target = parseFloat(el.dataset.count);
  const dec = parseInt(el.dataset.dec || '0', 10);
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / 1400);
    el.textContent = (target * (1 - Math.pow(1 - k, 3))).toFixed(dec);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    e.target.querySelectorAll('[data-count]').forEach(countUp);
    io.unobserve(e.target);
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* ---------- Project filters ---------- */
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    const f = chip.dataset.filter;
    document.querySelectorAll('.card').forEach((card) => {
      card.classList.toggle('hide', f !== 'all' && !card.dataset.tags.includes(f));
    });
  });
});

/* ---------- 3D tilt on project cards ---------- */
if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

document.getElementById('yr').textContent = new Date().getFullYear();
