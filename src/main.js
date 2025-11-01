import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

// =============================
// Radial Text Overlay Settings
// =============================
// These factors control the position and size of the radial text overlays relative to the wheel's width.
const TEXT_RADIUS_FACTOR = 0.5; // Distance from wheel center as a fraction of wheel width
const TEXT_WIDTH_FACTOR = 0.15; // Overlay width as a fraction of wheel width
const TEXT_HEIGHT_FACTOR = 0.04; // Overlay height as a fraction of wheel width
const TEXT_OVERLAY_Z_OFFSET = 0; // Z offset to keep overlays in front of wheel

// =============================
// Animation and State Variables
// =============================
let wheelRef = null; // Reference to wheel object for animation and overlays
let camInitial;
let cameraDirection = "forward"; // 'forward' or 'backward'
let overlayShouldShow = false;
let wheelRotatingToOriginal = false;
let wheelRotationStart = 0;
let wheelRotationTarget = 0;
let wheelRotationProgress = 0;
let cameraAnimating = false;
let camStart = null;
let camTarget = null;
let textFadeProgress = 0; // 0 = fully transparent, 1 = fully opaque

// Screen state: "start", "main", "overlay"
let currentScreen = "start";

const TEXT_FADE_IN_SPEED = 0.025; // Adjust for slower/faster fade
const MAIN_SCREEN_POS = new THREE.Vector3(0.75, 0, 1); // match camTarget
const MAIN_SCREEN_THRESHOLD = 0.08; // match camera arrival threshold

// Highlighted Mandal index (0-based)
let highlightedMandalIndex = 0;
const HIGHLIGHT_GLOW_COLOR = "#00eaff"; // Tron blue
const HIGHLIGHT_GLOW_SIZE = 1.5; // Larger for neon effect
const HIGHLIGHT_GLOW_OPACITY = 0.85; // More visible

// =============================
// Scene, Renderer, Camera, Loaders
// =============================
const app = document.getElementById("app");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000009);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

// Camera
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 0, 5);
camInitial = camera.position.clone();

// Bloom composer setup
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.32,
  0.9,
  0.01
);
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// Draco and KTX2 loader setup
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
);
const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath(
  "https://unpkg.com/three@0.159.0/examples/jsm/libs/basis/"
);
ktx2Loader.detectSupport(renderer);

// GLTF loader setup
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setKTX2Loader(ktx2Loader);

// Lighting - subtle fill
scene.add(new THREE.AmbientLight(0xffffff, 0.1));
const dirLight = new THREE.DirectionalLight(0xfff8e1, 0.45);
dirLight.position.set(10, 20, 18);
scene.add(dirLight);

// Helper functions
function makeGlowMaterial(color, emissive, opacity = 0.92, size = 1.0) {
  return new THREE.MeshPhysicalMaterial({
    color: color,
    emissive: emissive,
    emissiveIntensity: 1.2,
    roughness: 0.12,
    metalness: 0.0,
    transmission: 0.0,
    transparent: true,
    opacity: opacity,
    depthWrite: true,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
  });
}

function generateRadialTexture(hex) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  const c = new THREE.Color(hex);
  const rgba = (r, g, b, a) =>
    `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(
      b * 255
    )},${a})`;
  grad.addColorStop(0, rgba(c.r, c.g, c.b, 0.95));
  grad.addColorStop(0.2, rgba(c.r, c.g, c.b, 0.55));
  grad.addColorStop(0.45, rgba(c.r, c.g, c.b, 0.25));
  grad.addColorStop(1, rgba(c.r * 0.1, c.g * 0.1, c.b * 0.1, 0.0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeStarSpheres(count, radiusMin, radiusMax, size, color, emissive) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const r = radiusMin + Math.random() * (radiusMax - radiusMin);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    const mat = makeGlowMaterial(color, emissive, 0.92, size);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 16), mat);
    mesh.position.set(x, y, z);
    mesh.userData.phase = Math.random() * Math.PI * 2;
    group.add(mesh);
  }
  return group;
}

// Scene decorations
const farStars = makeStarSpheres(1200, 200, 700, 0.18, 0x223344, 0x7fdfff);
const midStars = makeStarSpheres(700, 60, 300, 0.32, 0x222233, 0x8ecaff);
const nearStars = makeStarSpheres(180, 8, 120, 0.5, 0x333344, 0xffffff);
scene.add(farStars, midStars, nearStars);

function makeNebula(colorHex, size = 160, depth = 0, opacity = 0.55) {
  const tex = generateRadialTexture(colorHex);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size, size, 1);
  sp.position.set(
    (Math.random() - 0.5) * 160,
    (Math.random() - 0.5) * 80,
    depth
  );
  return sp;
}

const nebulaGroup = new THREE.Group();
nebulaGroup.add(makeNebula("#3fb8a2", 420, -40, 0.5));
nebulaGroup.add(makeNebula("#6a4fb5", 360, -20, 0.42));
nebulaGroup.add(makeNebula("#2f6fb6", 520, 0, 0.45));
nebulaGroup.add(makeNebula("#b569ff", 280, 30, 0.35));
nebulaGroup.add(makeNebula("#57d9ff", 200, 60, 0.22));
scene.add(nebulaGroup);

function makeFogPlane(
  colorHex,
  width = 800,
  height = 200,
  z = 0,
  opacity = 0.06
) {
  const tex = generateRadialTexture(colorHex);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    blending: THREE.NormalBlending,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(width, height, 1);
  sp.position.z = z;
  sp.position.x = (Math.random() - 0.5) * 60;
  sp.position.y = (Math.random() - 0.5) * 30 + 10;
  return sp;
}

scene.add(makeFogPlane("#2f6fb6", 900, 260, -60, 0.08));
scene.add(makeFogPlane("#6a4fb5", 900, 200, -20, 0.06));
scene.add(makeFogPlane("#3fb8a2", 900, 320, 40, 0.05));
scene.fog = new THREE.FogExp2(0x0a0a1a, 0.008);

let time = 0;

// =============================
// Create Radial Text Sprites for Wheel
// =============================
function createRadialTextSprites(wheel, labels) {
  if (wheel.userData.textSprites) {
    wheel.userData.textSprites.forEach((sprite) => scene.remove(sprite));
  }
  wheel.userData.textSprites = [];
  const spokeCount = labels.length;
  wheel.updateMatrixWorld();
  const wheelWorldPos = new THREE.Vector3();
  wheel.getWorldPosition(wheelWorldPos);
  const wheelWidth = wheel.userData.cachedWidth;
  const wheelRadius = wheel.userData.cachedRadius;
  const textRadius = Math.max(wheelRadius * TEXT_RADIUS_FACTOR, 0.5);
  const textWidth = Math.max(wheelWidth * TEXT_WIDTH_FACTOR, 0.5);
  const textHeight = Math.max(wheelWidth * TEXT_HEIGHT_FACTOR, 0.15);
  for (let i = 0; i < spokeCount; i++) {
    let canvasWidth = 1024,
      canvasHeight = 256,
      fontSize = 112,
      margin = 64;
    if (camera && wheel) {
      const wheelPos = new THREE.Vector3();
      wheel.getWorldPosition(wheelPos);
      const camDist = camera.position.distanceTo(wheelPos);
      if (camDist < 2.5) {
        canvasWidth = 2048;
        canvasHeight = 512;
        fontSize = 224;
        margin = 128;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffd700";
    ctx.strokeStyle = "#332200";
    ctx.lineWidth = Math.floor(fontSize / 14);
    ctx.strokeText(labels[i], margin, canvas.height / 2);
    ctx.fillText(labels[i], margin, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(textWidth, textHeight, 1);
    const angle = (i / spokeCount) * Math.PI * 2;
    const x = wheelWorldPos.x + Math.cos(angle) * textRadius;
    const y = wheelWorldPos.y + Math.sin(angle) * textRadius;
    const z = wheelWorldPos.z + TEXT_OVERLAY_Z_OFFSET;
    sprite.position.set(x, y, z);
    sprite.center.set(0.5, 0.5);
    sprite.material.rotation = angle;
    sprite.renderOrder = 999;
    sprite.visible = false;
    scene.add(sprite);
    wheel.userData.textSprites.push(sprite);
  }
}

function setTextSpritesVisibility(visible) {
  if (wheelRef && wheelRef.userData.textSprites) {
    wheelRef.userData.textSprites.forEach((sprite) => {
      sprite.visible = visible;
      sprite.material.opacity = visible ? 1.0 : 0.0;
    });
  }
}
function hideTextSpritesCompletely() {
  if (wheelRef && wheelRef.userData.textSprites)
    wheelRef.userData.textSprites.forEach((s) => {
      s.visible = false;
      s.material.opacity = 0;
    });
}
function setTextSpritesVisibilityByFade() {
  if (!wheelRef || !wheelRef.userData.textSprites) return;
  wheelRef.userData.textSprites.forEach((sprite) => {
    sprite.visible = textFadeProgress > 0.01;
    sprite.material.opacity = textFadeProgress;
  });
}

let wheelTargetRotation = null;
let wheelRotationAnimating = false;
let wheelRotationAnimStart = 0;
let wheelRotationAnimEnd = 0;
let wheelRotationAnimProgress = 0;
const WHEEL_ROTATE_STEP = (Math.PI * 2) / 10;
const WHEEL_ROTATE_ANIM_SPEED = 0.08;
function rotateWheelByStep(direction) {
  if (!wheelRef || wheelRotationAnimating) return;
  wheelRotationAnimStart = wheelRef.rotation.z;
  wheelRotationAnimEnd = wheelRef.rotation.z + direction * WHEEL_ROTATE_STEP;
  wheelRotationAnimProgress = 0;
  wheelRotationAnimating = true;
}
function updateRadialTextSpriteTransformsWithOffset(offsetAngle = 0) {
  if (!wheelRef || !wheelRef.userData.textSprites) return;
  const wheelWidth = wheelRef.userData.cachedWidth;
  const wheelRadius = wheelRef.userData.cachedRadius;
  const textRadius = Math.max(wheelRadius * TEXT_RADIUS_FACTOR, 0.5);
  const textWidth = Math.max(wheelWidth * TEXT_WIDTH_FACTOR, 0.5);
  const textHeight = Math.max(wheelWidth * TEXT_HEIGHT_FACTOR, 0.15);
  const spokeCount = wheelRef.userData.textSprites.length;
  for (let i = 0; i < spokeCount; i++) {
    const initialOffset = Math.PI / 10;
    const angle = (i / spokeCount) * Math.PI * 2 + offsetAngle - initialOffset;
    const x = wheelRef.position.x + Math.cos(angle) * textRadius;
    const y = wheelRef.position.y + Math.sin(angle) * textRadius;
    const z = wheelRef.position.z + TEXT_OVERLAY_Z_OFFSET;
    const sprite = wheelRef.userData.textSprites[i];
    sprite.position.set(x, y, z);
    sprite.scale.set(textWidth, textHeight, 1);
    sprite.material.rotation = angle;
  }
}

// =============================
// Mandal Detail Overlay Logic (top-level)
// =============================
let mandalOverlay = null;
let mandalOverlayVisible = false;
let selectedMandalIndex = null;
// Manifest data (loaded at startup)
let manifestData = null;

// Fetch and cache manifest.json on startup
fetch("/assets/mandalas/manifest.json")
  .then((res) => {
    if (!res.ok) throw new Error("Failed to fetch manifest");
    return res.json();
  })
  .then((json) => {
    manifestData = json;
    console.log("Loaded manifest.json", manifestData);
  })
  .catch((err) => {
    console.warn("Could not load manifest.json:", err);
    manifestData = null;
  });
function createMandalOverlay() {
  if (document.getElementById("mandal-overlay")) return;
  mandalOverlay = document.createElement("div");
  mandalOverlay.id = "mandal-overlay";
  mandalOverlay.style.position = "fixed";
  mandalOverlay.style.top = "0";
  mandalOverlay.style.left = "0";
  mandalOverlay.style.width = "100vw";
  mandalOverlay.style.height = "100vh";
  mandalOverlay.style.background = "rgba(10,10,30,0.97)";
  mandalOverlay.style.zIndex = "9999";
  mandalOverlay.style.display = "none";
  mandalOverlay.style.justifyContent = "flex-start";
  mandalOverlay.style.alignItems = "center";
  mandalOverlay.style.flexDirection = "column";
  mandalOverlay.style.color = "#ffd700";
  mandalOverlay.style.fontFamily = "sans-serif";
  mandalOverlay.style.overflowY = "auto";
  mandalOverlay.style.padding = "32px 32px 64px 32px";
  mandalOverlay.style.boxSizing = "border-box";
  mandalOverlay.style.transition = "opacity 0.3s";
  mandalOverlay.style.opacity = "0";
  mandalOverlay.style.display = "flex";
  const closeBtn = document.createElement("button");
  closeBtn.innerText = "×";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "32px";
  closeBtn.style.right = "48px";
  closeBtn.style.fontSize = "2.5rem";
  closeBtn.style.background = "none";
  closeBtn.style.border = "none";
  closeBtn.style.color = "#ffd700";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.zIndex = "10001";
  closeBtn.addEventListener("click", hideMandalOverlay);
  mandalOverlay.appendChild(closeBtn);
  const content = document.createElement("div");
  content.id = "mandal-overlay-content";
  content.style.maxWidth = "600px";
  content.style.width = "100%";
  content.style.background = "rgba(30,30,60,0.98)";
  content.style.borderRadius = "18px";
  content.style.boxShadow = "0 0 32px #222";
  content.style.padding = "40px 32px 32px 32px";
  content.style.position = "relative";
  content.style.display = "flex";
  content.style.flexDirection = "column";
  content.style.alignItems = "center";
  content.style.marginTop = "32px"; // Add top margin to prevent clipping at top
  content.style.marginBottom = "32px"; // Add bottom margin for breathing room
  mandalOverlay.appendChild(content);
  document.body.appendChild(mandalOverlay);
  // Close overlay on Escape
  document.addEventListener("keydown", (e) => {
    if (mandalOverlayVisible && e.key === "Escape") {
      hideMandalOverlay();
    }
  });
  // Close overlay when clicking/tapping outside the content box
  mandalOverlay.addEventListener("pointerdown", (ev) => {
    // If user clicked the overlay container but not the content area, close
    if (!ev.target) return;
    // If target is the overlay itself or an element outside #mandal-overlay-content
    const contentEl = document.getElementById("mandal-overlay-content");
    if (!contentEl) return;
    if (!contentEl.contains(ev.target)) {
      hideMandalOverlay();
    }
  });
}

// Simple image lightbox for thumbnails
function showImageLightbox(src) {
  // remove existing if any
  const existing = document.getElementById("mandal-lightbox");
  if (existing) existing.remove();
  const lb = document.createElement("div");
  lb.id = "mandal-lightbox";
  lb.style.position = "fixed";
  lb.style.left = "0";
  lb.style.top = "0";
  lb.style.width = "100vw";
  lb.style.height = "100vh";
  lb.style.display = "flex";
  lb.style.alignItems = "center";
  lb.style.justifyContent = "center";
  lb.style.background = "rgba(0,0,0,0.85)";
  lb.style.zIndex = "10010";
  const img = document.createElement("img");
  img.src = src;
  img.style.maxWidth = "92vw";
  img.style.maxHeight = "92vh";
  img.style.borderRadius = "8px";
  img.style.boxShadow = "0 8px 40px rgba(0,0,0,0.6)";
  lb.appendChild(img);
  lb.addEventListener("pointerdown", () => lb.remove());
  document.body.appendChild(lb);
}
function showMandalOverlay(mandalIndex) {
  createMandalOverlay();
  selectedMandalIndex = mandalIndex;
  mandalOverlayVisible = true;
  const overlay = document.getElementById("mandal-overlay");
  overlay.style.display = "flex";
  setTimeout(() => {
    overlay.style.opacity = "1";
  }, 10);
  populateMandalOverlay(mandalIndex);
  currentScreen = "overlay";
  updateMainCloseBtnVisibility();
  updateControlsOverlayVisibility();
}
function hideMandalOverlay() {
  mandalOverlayVisible = false;
  const overlay = document.getElementById("mandal-overlay");
  if (overlay) {
    // save current playback markers and stop any media playback inside the overlay
    try {
      const audios = overlay.querySelectorAll("audio");
      audios.forEach((a) => {
        try {
          // save playback position to localStorage (mandal-specific)
          const mandalKey = a.dataset && a.dataset.mandal ? a.dataset.mandal : String(selectedMandalIndex + 1);
          if (mandalKey) {
            try {
              const t = parseFloat(a.currentTime) || 0;
              localStorage.setItem(`mandal_playback_${mandalKey}`, String(t));
            } catch (e) {}
          }
          a.pause();
          // clear src to stop network fetches for streamed media
          a.removeAttribute("src");
          a.load && a.load();
        } catch (e) {}
      });
      const videos = overlay.querySelectorAll("video");
      videos.forEach((v) => {
        try {
          const mandalKey = v.dataset && v.dataset.mandal ? v.dataset.mandal : String(selectedMandalIndex + 1);
          if (mandalKey) {
            try {
              const t = parseFloat(v.currentTime) || 0;
              localStorage.setItem(`mandal_playback_${mandalKey}`, String(t));
            } catch (e) {}
          }
          v.pause();
          v.removeAttribute("src");
          v.load && v.load();
          v.style.display = "none"; // hide video if open
        } catch (e) {}
      });
    } catch (e) {
      // ignore
    }
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.style.display = "none";
    }, 300);
  }
  currentScreen = "main";
  // Restore text sprites visibility when returning to main screen
  textFadeProgress = 1.0;
  setTextSpritesVisibilityByFade();
  updateMainCloseBtnVisibility();
  updateControlsOverlayVisibility();
}
function populateMandalOverlay(mandalIndex) {
  const content = document.getElementById("mandal-overlay-content");
  if (!content) return;
  content.innerHTML = "";
  const mandalLabel = `Mandal ${mandalIndex + 1}`;
  const title = document.createElement("h2");
  title.innerText = mandalLabel;
  title.style.marginBottom = "18px";
  title.style.color = "#ffd700";
  content.appendChild(title);
  // Determine podcast src from manifest if available (manifest uses 1-based mandal keys)
  let podcastSrc = "podcast.mp3"; // fallback
  try {
    const mandalKey = String(mandalIndex + 1);
    if (manifestData && manifestData.Podcasts && manifestData.Podcasts[mandalKey]) {
      podcastSrc = manifestData.Podcasts[mandalKey];
    }
  } catch (e) {
    // keep fallback
  }
  const audio = document.createElement("audio");
  audio.controls = true;
  // Don't preload audio until user interacts (saves bandwidth on mobile)
  audio.preload = "none";
  audio.src = podcastSrc;
  // Tag with mandal id so hide/restore routines know which mandal this belongs to
  audio.dataset.mandal = String(mandalIndex + 1);
  // Restore saved playback time if present when metadata is loaded
  audio.addEventListener("loadedmetadata", () => {
    try {
      const key = `mandal_playback_${audio.dataset.mandal}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const t = parseFloat(saved);
        if (!isNaN(t) && t > 0 && t < audio.duration) {
          audio.currentTime = t;
        }
      }
    } catch (e) {}
  });
  // Keep localStorage updated during playback
  audio.addEventListener("timeupdate", () => {
    try {
      const key = `mandal_playback_${audio.dataset.mandal}`;
      localStorage.setItem(key, String(audio.currentTime || 0));
    } catch (e) {}
  });
  // Clear marker when playback ends
  audio.addEventListener("ended", () => {
    try {
      const key = `mandal_playback_${audio.dataset.mandal}`;
      localStorage.removeItem(key);
    } catch (e) {}
  });
  audio.style.width = "100%";
  audio.style.marginBottom = "18px";
  content.appendChild(audio);

  // If we have a saved marker, show a small resume button and indicator
  try {
    const resumeKey = `mandal_playback_${String(mandalIndex + 1)}`;
    const savedRaw = localStorage.getItem(resumeKey);
    if (savedRaw) {
      const savedT = parseFloat(savedRaw);
      if (!isNaN(savedT) && savedT > 0) {
        const resumeBtn = document.createElement("button");
        resumeBtn.innerText = `Resume from ${formatTime(savedT)}`;
        resumeBtn.style.background = "transparent";
        resumeBtn.style.color = "#ffd700";
        resumeBtn.style.border = "1px solid rgba(255,215,0,0.14)";
        resumeBtn.style.padding = "6px 10px";
        resumeBtn.style.borderRadius = "6px";
        resumeBtn.style.marginBottom = "12px";
        resumeBtn.addEventListener("click", () => {
          try {
            // set src if not loaded (preload none)
            if (!audio.src || audio.src === "") audio.src = podcastSrc;
            audio.currentTime = savedT;
            audio.play().catch(() => {});
          } catch (e) {}
        });
        content.appendChild(resumeBtn);
      }
    }
  } catch (e) {}

  // Helper to format seconds to mm:ss
  function formatTime(sec) {
    const s = Math.floor(sec || 0);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  const videoContainer = document.createElement("div");
  videoContainer.style.width = "100%";
  videoContainer.style.marginBottom = "18px";
  const videoToggle = document.createElement("button");
  videoToggle.innerText = "Show Video";
  videoToggle.style.background = "#ffd700";
  videoToggle.style.color = "#222";
  videoToggle.style.border = "none";
  videoToggle.style.padding = "8px 18px";
  videoToggle.style.borderRadius = "8px";
  videoToggle.style.cursor = "pointer";
  videoToggle.style.marginBottom = "8px";
  videoContainer.appendChild(videoToggle);
  const video = document.createElement("video");
  video.controls = true;
  video.src = "";
  video.dataset.mandal = String(mandalIndex + 1);
  video.addEventListener("loadedmetadata", () => {
    try {
      const key = `mandal_playback_${video.dataset.mandal}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const t = parseFloat(saved);
        if (!isNaN(t) && t > 0 && t < video.duration) {
          video.currentTime = t;
        }
      }
    } catch (e) {}
  });
  video.addEventListener("timeupdate", () => {
    try {
      const key = `mandal_playback_${video.dataset.mandal}`;
      localStorage.setItem(key, String(video.currentTime || 0));
    } catch (e) {}
  });
  video.addEventListener("ended", () => {
    try {
      const key = `mandal_playback_${video.dataset.mandal}`;
      localStorage.removeItem(key);
    } catch (e) {}
  });
  video.style.width = "100%";
  video.style.maxHeight = "60vh"; // Limit video height to prevent overflow
  video.style.borderRadius = "8px";
  video.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
  video.style.display = "none";
  video.style.marginTop = "12px";
  videoContainer.appendChild(video);
  videoToggle.addEventListener("click", () => {
    if (video.style.display === "none") {
      video.style.display = "block";
      videoToggle.innerText = "Hide Video";
      // set video src lazily if manifest provides it
      try {
        const mk = String(mandalIndex + 1);
        if (manifestData && manifestData.Videos && manifestData.Videos[mk]) {
          video.src = manifestData.Videos[mk];
        }
      } catch (e) {}
      // Scroll the video into view smoothly when shown
      setTimeout(() => {
        try {
          video.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (e) {}
      }, 100);
    } else {
      video.style.display = "none";
      videoToggle.innerText = "Show Video";
    }
  });
  content.appendChild(videoContainer);
  // Flashcards download button if present in manifest
  try {
    const mk = String(mandalIndex + 1);
    if (manifestData && manifestData.Flashcards && manifestData.Flashcards[mk]) {
      const flashBtn = document.createElement("a");
      flashBtn.href = manifestData.Flashcards[mk];
      flashBtn.innerText = "View Flashcards";
      flashBtn.target = "_blank";
      flashBtn.rel = "noopener noreferrer";
      flashBtn.style.display = "inline-block";
      flashBtn.style.background = "#ffd700";
      flashBtn.style.color = "#222";
      flashBtn.style.padding = "8px 18px";
      flashBtn.style.borderRadius = "8px";
      flashBtn.style.textDecoration = "none";
      flashBtn.style.marginBottom = "12px";
      content.appendChild(flashBtn);
    }
  } catch (e) {}
  // Determine download text file from manifest OriginalText mapping if available
  let textFile = `rigveda/book${mandalIndex + 1}.txt`;
  try {
    const mandalKey = String(mandalIndex + 1);
    if (manifestData && manifestData.OriginalText && manifestData.OriginalText[mandalKey]) {
      textFile = manifestData.OriginalText[mandalKey];
    }
  } catch (e) {
    // keep fallback
  }
  const viewLink = document.createElement("a");
  viewLink.href = textFile;
  viewLink.innerText = "View Full Text";
  viewLink.target = "_blank";
  viewLink.rel = "noopener noreferrer";
  viewLink.style.background = "#ffd700";
  viewLink.style.color = "#222";
  viewLink.style.padding = "8px 18px";
  viewLink.style.borderRadius = "8px";
  viewLink.style.textDecoration = "none";
  viewLink.style.marginBottom = "18px";
  content.appendChild(viewLink);
  // Thumbnails / gallery from manifest Mandals
  try {
    const mk = String(mandalIndex + 1);
    if (manifestData && manifestData.Mandals && Array.isArray(manifestData.Mandals[mk]) && manifestData.Mandals[mk].length > 0) {
      const gallery = document.createElement("div");
      gallery.style.display = "flex";
      gallery.style.gap = "8px";
      gallery.style.marginTop = "12px";
      manifestData.Mandals[mk].forEach((imgPath) => {
        try {
          const img = document.createElement("img");
          img.src = imgPath;
          img.style.width = "96px";
          img.style.height = "96px";
          img.style.objectFit = "cover";
          img.style.borderRadius = "8px";
          img.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
          img.style.cursor = "pointer";
          img.addEventListener("click", () => showImageLightbox(imgPath));
          gallery.appendChild(img);
        } catch (e) {}
      });
      content.appendChild(gallery);
    }
  } catch (e) {}
    // Clear playback marker button
    try {
      const mk = String(mandalIndex + 1);
      const key = `mandal_playback_${mk}`;
      const clearBtn = document.createElement("button");
      clearBtn.innerText = "Clear saved playback";
      clearBtn.style.background = "transparent";
      clearBtn.style.color = "#ffd700";
      clearBtn.style.border = "1px solid rgba(255,215,0,0.14)";
      clearBtn.style.padding = "6px 10px";
      clearBtn.style.borderRadius = "6px";
      clearBtn.style.marginLeft = "8px";
      clearBtn.addEventListener("click", () => {
        try {
          localStorage.removeItem(key);
          // Also pause and reset any media elements
          try { audio && (audio.currentTime = 0); audio && audio.pause(); } catch (e) {}
          try { video && (video.currentTime = 0); video && video.pause(); } catch (e) {}
          // remove resume button if present
          const resume = content.querySelector("button");
          if (resume && resume.innerText && resume.innerText.startsWith("Resume from")) resume.remove();
        } catch (e) {}
      });
      content.appendChild(clearBtn);
    } catch (e) {}
  const desc = document.createElement("p");
  desc.innerText = getMandalDescription(mandalIndex);
  desc.style.marginTop = "24px";
  desc.style.fontSize = "1.1rem";
  desc.style.color = "#fff8b0";
  content.appendChild(desc);
}
function getMandalDescription(idx) {
  const descs = [
    "The first Mandal introduces the Rigveda and contains hymns to Agni, Indra, and other deities.",
    "The second Mandal focuses on hymns dedicated to Agni and Indra, with philosophical themes.",
    "The third Mandal features the famous Gayatri mantra and hymns to Agni, Indra, and Vishvamitra.",
    "The fourth Mandal contains hymns attributed to Vamadeva and praises to Agni and Indra.",
    "The fifth Mandal is known for hymns to the Visvedevas and Maruts, with family connections.",
    "The sixth Mandal includes hymns to Agni, Indra, and the Ashvins, with a focus on prosperity.",
    "The seventh Mandal is attributed to Vasishtha and contains hymns to Varuna and Indra.",
    "The eighth Mandal is diverse, with hymns to various deities and philosophical reflections.",
    "The ninth Mandal is dedicated almost entirely to Soma, the sacred ritual drink.",
    "The tenth Mandal contains philosophical hymns, including the Purusha Sukta and creation hymns.",
  ];
  return descs[idx] || "";
}

// =============================
// Raycaster and Mandal sprite click wiring
// =============================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!wheelRef || !wheelRef.userData.textSprites) return;
  // On mobile/touch, support left/center/right regions for navigation
  const clientX = event.clientX;
  const width = renderer.domElement.clientWidth;
  const region = getTouchRegion(clientX, width);
  if (region === "left") {
    // act as ArrowLeft
    if (currentScreen === "main" && !wheelRotationAnimating) {
      rotateWheelByStep(+1);
      highlightedMandalIndex = (highlightedMandalIndex + 9) % 10;
      updateHighlightedMandalSprite();
    }
    return;
  }
  if (region === "right") {
    // act as ArrowRight
    if (currentScreen === "main" && !wheelRotationAnimating) {
      rotateWheelByStep(-1);
      highlightedMandalIndex = (highlightedMandalIndex + 1) % 10;
      updateHighlightedMandalSprite();
    }
    return;
  }
  if (region === "center") {
    // act as Enter / open overlay when in main
    if (currentScreen === "main") {
      showMandalOverlay(highlightedMandalIndex);
      currentScreen = "overlay";
      return;
    }
  }

  // Fallback: perform raycast for clicks on sprites (desktop or precise touch)
  mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
  mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(wheelRef.userData.textSprites);
  if (intersects.length > 0) {
    const sprite = intersects[0].object;
    if (typeof sprite.onClick === "function") sprite.onClick();
  }
});

function getTouchRegion(clientX, width) {
  // Divide screen into three equal vertical regions: left, center, right
  const third = width / 3;
  if (clientX < third) return "left";
  if (clientX > 2 * third) return "right";
  return "center";
}

function setupMandalOverlayAfterWheel() {
  addMandalSpriteClickEvents();
}
function addMandalSpriteClickEvents() {
  if (!wheelRef || !wheelRef.userData.textSprites) return;
  wheelRef.userData.textSprites.forEach((sprite, idx) => {
    sprite.onClick = () => {
      showMandalOverlay(idx);
    };
    sprite.cursor = "pointer";
    sprite.userData.mandalIndex = idx;
  });
}

// Highlight Mandal Sprite Glow
function updateHighlightedMandalSprite() {
  if (!wheelRef || !wheelRef.userData.textSprites) return;
  wheelRef.userData.textSprites.forEach((sprite, idx) => {
    if (sprite.userData.glowSprite) {
      scene.remove(sprite.userData.glowSprite);
      sprite.userData.glowSprite = null;
    }
    if (idx === highlightedMandalIndex) {
      const tex = generateRadialTexture(HIGHLIGHT_GLOW_COLOR);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: HIGHLIGHT_GLOW_OPACITY,
      });
      const glow = new THREE.Sprite(mat);
      glow.scale.set(
        sprite.scale.x * HIGHLIGHT_GLOW_SIZE,
        sprite.scale.y * HIGHLIGHT_GLOW_SIZE,
        1
      );
      glow.position.copy(sprite.position);
      glow.material.rotation = sprite.material.rotation;
      glow.renderOrder = sprite.renderOrder - 1;
      glow.visible = sprite.visible;
      scene.add(glow);
      sprite.userData.glowSprite = glow;
    }
  });
}
function updateHighlightedGlowInAnimation() {
  if (!wheelRef || !wheelRef.userData.textSprites) return;
  const sprite = wheelRef.userData.textSprites[highlightedMandalIndex];
  if (sprite && sprite.userData.glowSprite) {
    const glow = sprite.userData.glowSprite;
    glow.position.copy(sprite.position);
    glow.material.rotation = sprite.material.rotation;
    glow.scale.set(
      sprite.scale.x * HIGHLIGHT_GLOW_SIZE,
      sprite.scale.y * HIGHLIGHT_GLOW_SIZE,
      1
    );
    glow.visible = sprite.visible;
  }
}

// =============================
// Mobile / Main-close helpers
// =============================
// Main close button that returns the user to the start screen
const mainCloseBtn = document.createElement("button");
mainCloseBtn.id = "main-close-btn";
mainCloseBtn.innerText = "← Back";
mainCloseBtn.style.position = "fixed";
mainCloseBtn.style.left = "18px";
mainCloseBtn.style.top = "18px";
mainCloseBtn.style.zIndex = "10002";
mainCloseBtn.style.background = "rgba(0,0,0,0.45)";
mainCloseBtn.style.color = "#ffd700";
mainCloseBtn.style.border = "1px solid rgba(255,215,0,0.18)";
mainCloseBtn.style.padding = "8px 12px";
mainCloseBtn.style.borderRadius = "8px";
mainCloseBtn.style.fontSize = "1rem";
mainCloseBtn.style.cursor = "pointer";
mainCloseBtn.style.display = "none"; // hidden by default
mainCloseBtn.addEventListener("click", () => {
  if (currentScreen === "main") returnToStart();
});
document.body.appendChild(mainCloseBtn);

function updateMainCloseBtnVisibility() {
  if (!mainCloseBtn) return;
  mainCloseBtn.style.display = currentScreen === "main" ? "block" : "none";
}

function returnToStart() {
  if (cameraAnimating) return;
  cameraAnimating = true;
  cameraDirection = "backward";
  camStart = camera.position.clone();
  camTarget = camInitial.clone();
  overlayShouldShow = true;
  if (wheelRef) wheelRef.userData.spinning = true;
  /* reset highlighted mandal to first when returning to start */
  highlightedMandalIndex = 0;
  updateHighlightedMandalSprite();
  currentScreen = "start";
  updateMainCloseBtnVisibility();
  updateControlsOverlayVisibility();
}

// Load and add the golden chariot wheel model
gltfLoader.load(
  "assets/models/golden-chariot-wheel-draco-ktx2.glb",
  (gltf) => {
    const wheel = gltf.scene;
    wheel.position.set(0, 0, 0);
    wheel.scale.set(2.5, 2.5, 2.5);
    wheel.rotation.set(0, 0, Math.PI / 10);
    wheel.userData.initialRotationZ = wheel.rotation.z;
    wheel.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(wheel);
    wheel.userData.cachedWidth = box.max.x - box.min.x;
    wheel.userData.cachedRadius = wheel.userData.cachedWidth / 2;

    wheel.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshPhysicalMaterial({
          color: 0xffd700,
          metalness: 1.0,
          roughness: 0.22,
          clearcoat: 1.0,
          clearcoatRoughness: 0.09,
          transmission: 0.0,
          emissive: 0x332200,
          emissiveIntensity: 0.08,
          transparent: false,
          opacity: 1.0,
          envMapIntensity: 1.2,
        });
      }
    });

    const auraLayers = [
      { color: "#ffd700", scale: 4.2, opacity: 0.18 },
      { color: "#fff8b0", scale: 5.6, opacity: 0.11 },
      { color: "#ffe066", scale: 7.1, opacity: 0.07 },
    ];
    wheel.userData.auras = [];
    auraLayers.forEach((layer) => {
      const tex = generateRadialTexture(layer.color);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: layer.opacity,
      });
      const aura = new THREE.Sprite(mat);
      aura.scale.set(layer.scale, layer.scale, 1);
      aura.position.set(0, 0, 0);
      wheel.add(aura);
      wheel.userData.auras.push(aura);
    });

    // If the user already switched to the main screen before the model loaded,
    // keep the wheel stopped. Otherwise allow it to spin on the start screen.
    wheel.userData.spinning = currentScreen === "start";
    wheelRef = wheel;
    scene.add(wheel);

    createRadialTextSprites(wheel, [
      "Mandal 1",
      "Mandal 2",
      "Mandal 3",
      "Mandal 4",
      "Mandal 5",
      "Mandal 6",
      "Mandal 7",
      "Mandal 8",
      "Mandal 9",
      "Mandal 10",
    ]);
    hideTextSpritesCompletely();
    setupMandalOverlayAfterWheel();
    highlightedMandalIndex = 0;
    updateHighlightedMandalSprite();
  },
  undefined,
  (err) => {
    console.error("Failed to load wheel model:", err);
  }
);

// =============================
// Controls Help Overlay
// =============================
const controlsOverlay = document.createElement("div");
controlsOverlay.id = "controls-overlay";
controlsOverlay.style.position = "fixed";
controlsOverlay.style.bottom = "18px";
controlsOverlay.style.right = "18px";
controlsOverlay.style.zIndex = "10003";
controlsOverlay.style.background = "rgba(20, 20, 40, 0.85)";
controlsOverlay.style.color = "#ffe066";
controlsOverlay.style.border = "1px solid #ffd70055";
controlsOverlay.style.borderRadius = "10px";
controlsOverlay.style.padding = "14px 22px";
controlsOverlay.style.fontFamily = "'Segoe UI', 'Arial', sans-serif";
controlsOverlay.style.fontSize = "1.1rem";
controlsOverlay.style.boxShadow = "0 2px 16px #222";
controlsOverlay.style.userSelect = "none";
controlsOverlay.style.pointerEvents = "none";
controlsOverlay.style.transition = "opacity 0.2s, box-shadow 0.2s, border-color 0.2s";
controlsOverlay.innerHTML = `
  <div style="display: flex; flex-direction: column; gap: 7px;">
    <span id="ctrl-enter"><b>Enter</b>: Select</span>
    <span id="ctrl-left"><b>← Left Arrow</b>: Previous</span>
    <span id="ctrl-right"><b>→ Right Arrow</b>: Next</span>
  </div>
`;
document.body.appendChild(controlsOverlay);

function highlightControl(key) {
  let el = null;
  if (key === "Enter") el = document.getElementById("ctrl-enter");
  if (key === "ArrowLeft") el = document.getElementById("ctrl-left");
  if (key === "ArrowRight") el = document.getElementById("ctrl-right");
  if (!el) return;
  el.style.background = "#ffd70022";
  el.style.borderRadius = "6px";
  el.style.transition = "background 0.2s";
  controlsOverlay.style.boxShadow = "0 0 32px #ffd700";
  controlsOverlay.style.borderColor = "#ffd700";
  setTimeout(() => {
    el.style.background = "none";
    controlsOverlay.style.boxShadow = "0 2px 16px #222";
    controlsOverlay.style.borderColor = "#ffd70055";
  }, 220);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  time += 0.0007;
  if (cameraAnimating && camStart && camTarget) {
    const lerpSpeed = 0.08;
    const t = Math.min(
      1,
      lerpSpeed +
        (camStart.distanceTo(camera.position) /
          camStart.distanceTo(camTarget)) *
          lerpSpeed
    );
    camera.position.lerp(camTarget, t);
    if (camera.position.distanceTo(camTarget) < 0.08) {
      camera.position.copy(camTarget);
      cameraAnimating = false;
      if (cameraDirection === "backward" && overlayShouldShow) {
        const overlay = document.getElementById("overlay");
        if (overlay) {
          overlay.style.opacity = "1.0";
          overlay.style.pointerEvents = "auto";
        }
        overlayShouldShow = false;
      }
    }
  }
  [farStars, midStars, nearStars].forEach((starGroup, idx) => {
    starGroup.children.forEach((mesh) => {
      const phase = mesh.userData.phase || 0;
      mesh.position.x += Math.sin(time * 0.13 + phase) * 0.0007 * (idx + 1);
      mesh.position.y += Math.cos(time * 0.11 + phase) * 0.0007 * (idx + 1);
      mesh.material.opacity =
        0.85 + 0.12 * Math.sin(time * 0.7 + phase + idx * 1.3);
      mesh.material.emissiveIntensity =
        1.0 + 0.4 * Math.sin(time * 0.8 + phase + idx * 1.1);
    });
  });
  const wheel = wheelRef;
  if (wheel && wheel.userData.auras) {
    wheel.userData.auras.forEach((aura, idx) => {
      const baseOpacity = [0.18, 0.11, 0.07][idx];
      const baseScale = [4.2, 5.6, 7.1][idx];
      aura.material.opacity =
        baseOpacity + 0.025 * Math.sin(time * 2.1 + idx * 1.3);
      const scalePulse = 1.0 + 0.02 * Math.sin(time * 1.7 + idx * 1.7);
      aura.scale.set(baseScale * scalePulse, baseScale * scalePulse, 1);
    });
    if (wheel.userData.spinning) wheel.rotation.z -= 0.0008;
    if (wheelRotatingToOriginal) {
      wheelRotationProgress += 0.04;
      if (wheelRotationProgress >= 1) {
        wheel.rotation.z = wheelRotationTarget;
        wheelRotatingToOriginal = false;
      } else {
        const t = wheelRotationProgress;
        const ease = 1 - Math.pow(1 - t, 3);
        wheel.rotation.z =
          wheelRotationStart +
          (wheelRotationTarget - wheelRotationStart) * ease;
      }
    }
  }
  nebulaGroup.children.forEach((s, idx) => {
    s.position.x += Math.sin(time * 0.12 + idx) * 0.003;
    s.position.y += Math.cos(time * 0.09 + idx * 1.3) * 0.0015;
    s.material.opacity = Math.max(
      0.12,
      s.material.opacity * (0.995 + Math.sin(time * 0.11 + idx) * 0.002)
    );
  });
  const camDistToMain = camera.position.distanceTo(MAIN_SCREEN_POS);
  if (camDistToMain < MAIN_SCREEN_THRESHOLD) {
    if (textFadeProgress < 1.0) {
      textFadeProgress += TEXT_FADE_IN_SPEED;
      textFadeProgress = Math.min(1.0, textFadeProgress);
    }
  } else {
    // Only reset text fade if we're not on the main screen
    // This prevents hiding text when returning from overlay
    if (currentScreen !== "main") {
      textFadeProgress = 0;
    }
  }
  setTextSpritesVisibilityByFade();
  if (wheelRotationAnimating && wheelRef) {
    wheelRotationAnimProgress += WHEEL_ROTATE_ANIM_SPEED;
    if (wheelRotationAnimProgress >= 1) {
      wheelRef.rotation.z = wheelRotationAnimEnd;
      wheelRotationAnimating = false;
    } else {
      const t = wheelRotationAnimProgress;
      const ease = 1 - Math.pow(1 - t, 3);
      wheelRef.rotation.z =
        wheelRotationAnimStart +
        (wheelRotationAnimEnd - wheelRotationAnimStart) * ease;
    }
    updateRadialTextSpriteTransformsWithOffset(wheelRef.rotation.z);
  } else if (wheelRef) {
    updateRadialTextSpriteTransformsWithOffset(wheelRef.rotation.z);
  }
  updateHighlightedGlowInAnimation();
  updateControlsOverlayVisibility();
  composer.render();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

// UI keyboard handlers (top-level, so overlay functions are available)
document.addEventListener("keydown", (e) => {
  if (["Enter", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    highlightControl(e.key);
  }
  if (e.key === "Enter") {
    if (currentScreen === "start") {
      cameraAnimating = true;
      cameraDirection = "forward";
      camStart = camera.position.clone();
      camTarget = MAIN_SCREEN_POS.clone();
      const overlayEl = document.getElementById("overlay");
      if (overlayEl) {
        overlayEl.style.opacity = "0.0";
        overlayEl.style.pointerEvents = "none";
      }
      overlayShouldShow = false;
      if (wheelRef) {
        wheelRotatingToOriginal = true;
        wheelRotationStart = wheelRef.rotation.z;
        wheelRotationTarget = wheelRef.userData.initialRotationZ;
        wheelRotationProgress = 0;
        wheelRef.userData.spinning = false;
      }
      setTimeout(() => setTextSpritesVisibility(true), 400);
      currentScreen = "main";
      updateMainCloseBtnVisibility();
      return;
    }
    if (currentScreen === "main") {
      showMandalOverlay(highlightedMandalIndex);
      currentScreen = "overlay";
      return;
    }
    return;
  }
  if (e.key === "Escape") {
    if (currentScreen === "overlay") {
      // Let the mandal overlay's own Escape handler deal with it
      // hideMandalOverlay() is called by the event listener in createMandalOverlay()
      return;
    }
    if (currentScreen === "main") {
      if (cameraAnimating) return;
      cameraAnimating = true;
      cameraDirection = "backward";
      camStart = camera.position.clone();
      camTarget = camInitial.clone();
      overlayShouldShow = true;
      if (wheelRef) wheelRef.userData.spinning = true;
      /* reset highlighted mandal to first when returning to start */ highlightedMandalIndex = 0;
      updateHighlightedMandalSprite();
      currentScreen = "start";
      updateMainCloseBtnVisibility();
      return;
    }
  }
  if (currentScreen === "main" && !wheelRotationAnimating) {
    if (e.key === "ArrowLeft") {
      rotateWheelByStep(+1);
      highlightedMandalIndex = (highlightedMandalIndex + 9) % 10;
      updateHighlightedMandalSprite();
    }
    if (e.key === "ArrowRight") {
      rotateWheelByStep(-1);
      highlightedMandalIndex = (highlightedMandalIndex + 1) % 10;
      updateHighlightedMandalSprite();
    }
  }
});

// Start button wiring
const startBtn = document.getElementById("start-btn");
if (startBtn) {
  startBtn.addEventListener("click", () => {
    if (cameraAnimating) return;
    cameraAnimating = true;
    cameraDirection = "forward";
    camStart = camera.position.clone();
    camTarget = MAIN_SCREEN_POS.clone();
    const overlayEl = document.getElementById("overlay");
    if (overlayEl) {
      overlayEl.style.opacity = "0.0";
      overlayEl.style.pointerEvents = "none";
    }
    overlayShouldShow = false;
    if (wheelRef) {
      wheelRotatingToOriginal = true;
      wheelRotationStart = wheelRef.rotation.z;
      wheelRotationTarget = wheelRef.userData.initialRotationZ;
      wheelRotationProgress = 0;
      wheelRef.userData.spinning = false;
    }
    setTimeout(() => setTextSpritesVisibility(true), 400);
    currentScreen = "main";
    updateMainCloseBtnVisibility();
  });
}

animate();
