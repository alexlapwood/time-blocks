import { startAuroraShader, stopAuroraShader } from "./aurora-shader";

export const THEMES = [
  { id: "default", label: "Default" },
  { id: "bliss", label: "Bliss" },
  { id: "candy", label: "Candy" },
  { id: "dune", label: "Dune" },
  { id: "gameboy", label: "Game Boy" },
  { id: "ocean", label: "Ocean" },
  { id: "sunset", label: "Sunset" },
  { id: "forest", label: "Forest" },
  { id: "cyberpunk", label: "Cyberpunk" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const MODES = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const;

export type ModeId = (typeof MODES)[number]["id"];

const DEFAULT_THEME: ThemeId = "default";
const DEFAULT_MODE: ModeId = "system";
const STORAGE_KEY = "timeblocks-theme";
const MODE_STORAGE_KEY = "timeblocks-mode";

const isThemeId = (value: string | null): value is ThemeId =>
  THEMES.some((theme) => theme.id === value);

const isModeId = (value: string | null): value is ModeId =>
  MODES.some((mode) => mode.id === value);

const NATURAL_STAR_MAX_COUNT = 200;
const NATURAL_STAR_INITIAL_COUNT = 0;
const NATURAL_STAR_SPAWN_MIN_MS = 100;
const NATURAL_STAR_SPAWN_MAX_MS = 100;
const NATURAL_STAR_SIZE_PX = 6;
const NATURAL_STAR_ALPHA = 0.85;
const NATURAL_STAR_SOLID_STOP = 56;
const NATURAL_STAR_FADE_STOP = 64;
const NATURAL_STAR_STEP_MS = 60;
const NATURAL_STAR_FADE_IN_MS = 900;
const NATURAL_STAR_FADE_OUT_MS = 1000;
const NATURAL_STAR_MIN_X = 0;
const NATURAL_STAR_MAX_X = 100;
const NATURAL_STAR_MIN_Y = 0;
const NATURAL_STAR_MAX_Y = 100;
const NATURAL_CLOUD_LAYER_ID = "natural-cloud-layer";
const NATURAL_CLOUD_CLASS = "natural-cloud";
const NATURAL_CLOUD_MIN_WIDTH_PX = 150;
const NATURAL_CLOUD_MAX_WIDTH_PX = 300;
const NATURAL_CLOUD_MIN_DURATION_MS = 60000;
const NATURAL_CLOUD_MAX_DURATION_MS = 140000;
const NATURAL_CLOUD_SPAWN_MIN_MS = 4200;
const NATURAL_CLOUD_SPAWN_MAX_MS = 9800;
const NATURAL_CLOUD_INITIAL_COUNT = 8;
const NATURAL_CLOUD_MIN_TOP_PX = 4;
const NATURAL_CLOUD_BOTTOM_MARGIN_PX = 8;
const NATURAL_CLOUD_TRAVEL_PADDING_PX = 120;
const NATURAL_CLOUD_MAX_COUNT = 14;
const NATURAL_CLOUD_ASPECT_RATIO = 220 / 150;
const NATURAL_CLOUD_PUFF_CLASS = "natural-cloud-puff";
const NATURAL_CLOUD_CLUSTER_MIN = 2;
const NATURAL_CLOUD_CLUSTER_MAX = 6;
const NATURAL_CLOUD_PUFF_MIN_SCALE = 0.6;
const NATURAL_CLOUD_PUFF_MAX_SCALE = 1.2;
const NATURAL_CLOUD_PUFF_OFFSET_X_RATIO = 0.4;
const NATURAL_CLOUD_PUFF_UPWARD_RATIO = 0.3;
const NATURAL_CLOUD_PUFF_DOWNWARD_RATIO = 0.05;

const CANDY_LAYER_ID = "candy-sparkle-layer";
const CANDY_WRAPPER_CLASS = "candy-sparkle-wrapper";
const CANDY_SPARKLE_CLASS = "candy-sparkle";
const CANDY_MIN_SIZE_PX = 6;
const CANDY_MAX_SIZE_PX = 14;
const CANDY_FLOAT_MIN_MS = 16_000;
const CANDY_FLOAT_MAX_MS = 28_000;
const CANDY_TWINKLE_MIN_MS = 2_000;
const CANDY_TWINKLE_MAX_MS = 5_000;
const CANDY_SPAWN_MIN_MS = 2_000;
const CANDY_SPAWN_MAX_MS = 5_000;
const CANDY_INITIAL_COUNT = 5;
const CANDY_MAX_COUNT = 10;
const CANDY_MIN_SWAY_PX = 8;
const CANDY_MAX_SWAY_PX = 25;

let isSystemDarkListenerAttached = false;
let naturalStarsIntervalId: number | null = null;
let naturalStarsLastTickMs = 0;
let naturalStarSpawnTimeoutId: number | null = null;
let naturalCloudSpawnTimeoutId: number | null = null;
let naturalCloudLayer: HTMLDivElement | null = null;
let candySpawnTimeoutId: number | null = null;
let candySparkleLayer: HTMLDivElement | null = null;
let sunsetSpawnTimeoutId: number | null = null;
let sunsetEmberLayer: HTMLDivElement | null = null;
let forestSpawnTimeoutId: number | null = null;
let forestLeafLayer: HTMLDivElement | null = null;
let cyberSpawnTimeoutId: number | null = null;
let cyberRainLayer: HTMLDivElement | null = null;

type NaturalStarPhase = "fade-in" | "fade-out";

type NaturalStar = {
  phase: NaturalStarPhase;
  x: number;
  y: number;
  size: number;
  targetAlpha: number;
  alpha: number;
  phaseDurationMs: number;
  msRemaining: number;
};

let naturalStars: NaturalStar[] = [];

const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const randomNaturalStarX = () =>
  randomBetween(NATURAL_STAR_MIN_X, NATURAL_STAR_MAX_X);

const randomNaturalStarY = () =>
  randomBetween(NATURAL_STAR_MIN_Y, NATURAL_STAR_MAX_Y);

const randomNaturalStarSpawnMs = () =>
  randomBetween(NATURAL_STAR_SPAWN_MIN_MS, NATURAL_STAR_SPAWN_MAX_MS);

const randomNaturalCloudWidth = () =>
  randomBetween(NATURAL_CLOUD_MIN_WIDTH_PX, NATURAL_CLOUD_MAX_WIDTH_PX);

const randomNaturalCloudDurationMs = () =>
  randomBetween(NATURAL_CLOUD_MIN_DURATION_MS, NATURAL_CLOUD_MAX_DURATION_MS);

const randomNaturalCloudSpawnMs = () =>
  randomBetween(NATURAL_CLOUD_SPAWN_MIN_MS, NATURAL_CLOUD_SPAWN_MAX_MS);

const resolveCssLengthToPx = (lengthValue: string, fallbackPx: number) => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return fallbackPx;
  }

  const trimmed = lengthValue.trim();
  if (!trimmed) return fallbackPx;

  if (trimmed.endsWith("px")) {
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : fallbackPx;
  }

  if (trimmed.endsWith("vh")) {
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed)
      ? (window.innerHeight * parsed) / 100
      : fallbackPx;
  }

  if (trimmed.endsWith("vw")) {
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed)
      ? (window.innerWidth * parsed) / 100
      : fallbackPx;
  }

  if (!document.body) return fallbackPx;
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.height = trimmed;
  probe.style.width = "0";
  probe.style.overflow = "hidden";
  document.body.append(probe);
  const measured = probe.getBoundingClientRect().height;
  probe.remove();
  return Number.isFinite(measured) && measured > 0 ? measured : fallbackPx;
};

const prefersDarkMode = () => {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

const setNaturalStarPhase = (star: NaturalStar, phase: NaturalStarPhase) => {
  star.phase = phase;
  if (phase === "fade-in") {
    star.alpha = 0;
    star.phaseDurationMs = NATURAL_STAR_FADE_IN_MS;
    star.msRemaining = star.phaseDurationMs;
    return;
  }
  star.alpha = star.targetAlpha;
  star.phaseDurationMs = NATURAL_STAR_FADE_OUT_MS;
  star.msRemaining = star.phaseDurationMs;
};

const updateNaturalStarAlpha = (star: NaturalStar) => {
  const progress = clamp01(
    1 - star.msRemaining / Math.max(1, star.phaseDurationMs),
  );
  if (star.phase === "fade-in") {
    star.alpha = star.targetAlpha * progress;
    return;
  }
  star.alpha = star.targetAlpha * (1 - progress);
};

const createNaturalStar = (): NaturalStar => {
  const star: NaturalStar = {
    phase: "fade-in",
    x: randomNaturalStarX(),
    y: randomNaturalStarY(),
    size: NATURAL_STAR_SIZE_PX,
    targetAlpha: NATURAL_STAR_ALPHA,
    alpha: 0,
    phaseDurationMs: 0,
    msRemaining: 0,
  };
  setNaturalStarPhase(star, "fade-in");
  return star;
};

const toNaturalStarGradient = (star: NaturalStar) => {
  const size = star.size.toFixed(2);
  const x = star.x.toFixed(2);
  const y = star.y.toFixed(2);
  const rgba = `rgba(255, 255, 255, ${star.alpha.toFixed(2)})`;
  return `radial-gradient(${size}px ${size}px at ${x}% ${y}%, ${rgba} 0%, ${rgba} ${NATURAL_STAR_SOLID_STOP}%, transparent ${NATURAL_STAR_FADE_STOP}%)`;
};

const renderNaturalStars = () => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const gradients = naturalStars
    .filter((star) => star.alpha > 0.01)
    .map(toNaturalStarGradient);
  root.style.setProperty(
    "--natural-dark-stars-overlay",
    gradients.length > 0 ? gradients.join(", ") : "none",
  );
};

const clearNaturalStarSpawnTimer = () => {
  if (typeof window !== "undefined" && naturalStarSpawnTimeoutId !== null) {
    window.clearTimeout(naturalStarSpawnTimeoutId);
  }
  naturalStarSpawnTimeoutId = null;
};

const spawnNaturalStar = () => {
  if (naturalStars.length >= NATURAL_STAR_MAX_COUNT) return;
  naturalStars.push(createNaturalStar());
};

const scheduleNaturalStarSpawn = () => {
  if (typeof window === "undefined") return;
  clearNaturalStarSpawnTimer();
  naturalStarSpawnTimeoutId = window.setTimeout(() => {
    naturalStarSpawnTimeoutId = null;
    if (!isNaturalDarkActive()) return;
    spawnNaturalStar();
    scheduleNaturalStarSpawn();
  }, randomNaturalStarSpawnMs());
};

const initializeNaturalStars = () => {
  naturalStars = Array.from({ length: NATURAL_STAR_INITIAL_COUNT }, () =>
    createNaturalStar(),
  );
  renderNaturalStars();
};

const tickNaturalStars = (elapsedMs: number) => {
  if (naturalStars.length === 0) return;

  for (const star of naturalStars) {
    let remaining = elapsedMs;
    while (remaining > 0) {
      const consumed = Math.min(remaining, star.msRemaining);
      star.msRemaining -= consumed;
      remaining -= consumed;
      updateNaturalStarAlpha(star);

      if (star.msRemaining > 0) continue;
      if (star.phase === "fade-in") {
        setNaturalStarPhase(star, "fade-out");
      } else {
        star.alpha = 0;
        star.msRemaining = 0;
        break;
      }
    }
  }

  naturalStars = naturalStars.filter(
    (s) => !(s.phase === "fade-out" && s.msRemaining <= 0 && s.alpha <= 0),
  );

  renderNaturalStars();
};

const startNaturalStars = () => {
  if (typeof window === "undefined") return;
  if (naturalStarsIntervalId !== null) return;
  initializeNaturalStars();
  naturalStarsLastTickMs = window.performance.now();
  naturalStarsIntervalId = window.setInterval(() => {
    const now = window.performance.now();
    const elapsedMs = Math.max(16, now - naturalStarsLastTickMs);
    naturalStarsLastTickMs = now;
    tickNaturalStars(elapsedMs);
  }, NATURAL_STAR_STEP_MS);
  scheduleNaturalStarSpawn();
};

const stopNaturalStars = () => {
  if (typeof window !== "undefined" && naturalStarsIntervalId !== null) {
    window.clearInterval(naturalStarsIntervalId);
  }
  naturalStarsIntervalId = null;
  clearNaturalStarSpawnTimer();
  naturalStars = [];
  if (typeof document !== "undefined") {
    document.documentElement.style.removeProperty(
      "--natural-dark-stars-overlay",
    );
  }
};

const ensureNaturalCloudLayer = () => {
  if (typeof document === "undefined" || !document.body) return null;

  const existing = document.getElementById(NATURAL_CLOUD_LAYER_ID);
  if (existing instanceof HTMLDivElement) {
    naturalCloudLayer = existing;
    return existing;
  }

  const layer = document.createElement("div");
  layer.id = NATURAL_CLOUD_LAYER_ID;
  document.body.append(layer);
  naturalCloudLayer = layer;
  return layer;
};

const getNaturalCloudTopBounds = (cloudHeightPx: number) => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { min: NATURAL_CLOUD_MIN_TOP_PX, max: NATURAL_CLOUD_MIN_TOP_PX };
  }

  const rootStyles = window.getComputedStyle(document.documentElement);
  const groundOverlayHeightValue = rootStyles.getPropertyValue(
    "--ground-overlay-height",
  );
  const groundOverlayHeightPx = resolveCssLengthToPx(
    groundOverlayHeightValue,
    window.innerHeight / 3,
  );
  const hillsTopPx = Math.max(0, window.innerHeight - groundOverlayHeightPx);
  const maxTopPx = Math.max(
    NATURAL_CLOUD_MIN_TOP_PX,
    hillsTopPx - cloudHeightPx - NATURAL_CLOUD_BOTTOM_MARGIN_PX,
  );
  return { min: NATURAL_CLOUD_MIN_TOP_PX, max: maxTopPx };
};

const spawnNaturalCloud = (initialProgress = 0) => {
  if (typeof document === "undefined") return;
  const layer = ensureNaturalCloudLayer();
  if (!layer) return;
  if (layer.childElementCount >= NATURAL_CLOUD_MAX_COUNT) return;

  const cloudWidthPx = randomNaturalCloudWidth();
  const cloudHeightPx = cloudWidthPx / NATURAL_CLOUD_ASPECT_RATIO;
  const topBounds = getNaturalCloudTopBounds(cloudHeightPx);
  const topPx = randomBetween(topBounds.min, topBounds.max);
  const durationMs = randomNaturalCloudDurationMs();

  const puffCount = Math.round(
    randomBetween(NATURAL_CLOUD_CLUSTER_MIN, NATURAL_CLOUD_CLUSTER_MAX),
  );
  const scale = randomBetween(
    NATURAL_CLOUD_PUFF_MIN_SCALE,
    NATURAL_CLOUD_PUFF_MAX_SCALE,
  );
  const puffW = cloudWidthPx * scale;
  const puffH = cloudHeightPx * scale;
  const maxOffsetX = cloudWidthPx * NATURAL_CLOUD_PUFF_OFFSET_X_RATIO;
  const maxUpward = cloudHeightPx * NATURAL_CLOUD_PUFF_UPWARD_RATIO;
  const maxDownward = cloudHeightPx * NATURAL_CLOUD_PUFF_DOWNWARD_RATIO;
  const baseTop = cloudHeightPx - puffH;

  const puffData: { left: number; top: number }[] = [];
  let minLeft = 0;
  let maxRight = cloudWidthPx;

  for (let i = 0; i < puffCount; i += 1) {
    const offsetX = randomBetween(-maxOffsetX, maxOffsetX);
    const offsetY = randomBetween(-maxUpward, maxDownward);
    const left = (cloudWidthPx - puffW) / 2 + offsetX;
    minLeft = Math.min(minLeft, left);
    maxRight = Math.max(maxRight, left + puffW);
    puffData.push({ left, top: baseTop + offsetY });
  }

  const shiftX = minLeft < 0 ? -minLeft : 0;
  const clusterWidth = maxRight + shiftX;
  const travelExtraPx = clusterWidth + NATURAL_CLOUD_TRAVEL_PADDING_PX;

  const wrapper = document.createElement("div");
  wrapper.className = NATURAL_CLOUD_CLASS;
  wrapper.style.width = `${clusterWidth.toFixed(2)}px`;
  wrapper.style.height = `${cloudHeightPx.toFixed(2)}px`;
  wrapper.style.top = `${topPx.toFixed(2)}px`;
  wrapper.style.animationDuration = `${durationMs.toFixed(0)}ms`;
  wrapper.style.setProperty(
    "--cloud-travel-extra",
    `${travelExtraPx.toFixed(2)}px`,
  );

  const normalizedProgress = clamp01(initialProgress);
  if (normalizedProgress > 0) {
    wrapper.style.animationDelay = `-${(durationMs * normalizedProgress).toFixed(0)}ms`;
  }

  for (const p of puffData) {
    const puff = document.createElement("div");
    puff.className = NATURAL_CLOUD_PUFF_CLASS;
    puff.style.width = `${puffW.toFixed(2)}px`;
    puff.style.height = `${puffH.toFixed(2)}px`;
    puff.style.left = `${(p.left + shiftX).toFixed(2)}px`;
    puff.style.top = `${p.top.toFixed(2)}px`;
    wrapper.append(puff);
  }

  wrapper.addEventListener("animationend", () => {
    wrapper.remove();
  });

  layer.append(wrapper);
};

const clearNaturalCloudSpawnTimer = () => {
  if (typeof window !== "undefined" && naturalCloudSpawnTimeoutId !== null) {
    window.clearTimeout(naturalCloudSpawnTimeoutId);
  }
  naturalCloudSpawnTimeoutId = null;
};

const scheduleNaturalCloudSpawn = () => {
  if (typeof window === "undefined") return;
  clearNaturalCloudSpawnTimer();
  naturalCloudSpawnTimeoutId = window.setTimeout(() => {
    naturalCloudSpawnTimeoutId = null;
    if (!isNaturalLightActive()) return;
    spawnNaturalCloud();
    scheduleNaturalCloudSpawn();
  }, randomNaturalCloudSpawnMs());
};

const startNaturalClouds = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const layer = ensureNaturalCloudLayer();
  if (!layer) return;

  if (layer.childElementCount === 0) {
    for (let index = 0; index < NATURAL_CLOUD_INITIAL_COUNT; index += 1) {
      spawnNaturalCloud(Math.random());
    }
  }

  if (naturalCloudSpawnTimeoutId === null) {
    scheduleNaturalCloudSpawn();
  }
};

const stopNaturalClouds = () => {
  clearNaturalCloudSpawnTimer();
  const layer =
    naturalCloudLayer ??
    (typeof document !== "undefined"
      ? document.getElementById(NATURAL_CLOUD_LAYER_ID)
      : null);
  if (layer instanceof HTMLDivElement) {
    layer.remove();
  }
  naturalCloudLayer = null;
};

const isNaturalDarkActive = () => {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  if (root.dataset.theme !== "bliss") return false;
  if (root.dataset.mode === "dark") return true;
  if (root.dataset.mode === "light") return false;
  return prefersDarkMode();
};

const isNaturalLightActive = () => {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  if (root.dataset.theme !== "bliss") return false;
  if (root.dataset.mode === "dark") return false;
  if (root.dataset.mode === "light") return true;
  return !prefersDarkMode();
};

const refreshNaturalDarkStars = () => {
  if (!isNaturalDarkActive()) {
    stopNaturalStars();
    return;
  }
  startNaturalStars();
};

const refreshNaturalClouds = () => {
  if (!isNaturalLightActive()) {
    stopNaturalClouds();
    return;
  }
  startNaturalClouds();
};

const refreshNaturalSkyEffects = () => {
  refreshNaturalDarkStars();
  refreshNaturalClouds();
};

const isAuroraDarkActive = () => {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  if (root.dataset.theme !== "dune") return false;
  if (root.dataset.mode === "dark") return true;
  if (root.dataset.mode === "light") return false;
  return prefersDarkMode();
};

const refreshAuroraEffect = () => {
  if (!isAuroraDarkActive()) {
    stopAuroraShader();
    return;
  }
  startAuroraShader();
};

const isCandyActive = () => {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "candy";
};

const ensureCandySparkleLayer = () => {
  if (typeof document === "undefined" || !document.body) return null;

  const existing = document.getElementById(CANDY_LAYER_ID);
  if (existing instanceof HTMLDivElement) {
    candySparkleLayer = existing;
    return existing;
  }

  const layer = document.createElement("div");
  layer.id = CANDY_LAYER_ID;
  document.body.append(layer);
  candySparkleLayer = layer;
  return layer;
};

const spawnCandySparkle = (initialProgress = 0) => {
  if (typeof document === "undefined") return;
  const layer = ensureCandySparkleLayer();
  if (!layer) return;
  if (layer.childElementCount >= CANDY_MAX_COUNT) return;

  const size = randomBetween(CANDY_MIN_SIZE_PX, CANDY_MAX_SIZE_PX);
  const leftPercent = Math.random() * 100;
  const floatDuration = randomBetween(CANDY_FLOAT_MIN_MS, CANDY_FLOAT_MAX_MS);
  const twinkleDuration = randomBetween(
    CANDY_TWINKLE_MIN_MS,
    CANDY_TWINKLE_MAX_MS,
  );
  const swayPx = randomBetween(CANDY_MIN_SWAY_PX, CANDY_MAX_SWAY_PX);

  const wrapper = document.createElement("div");
  wrapper.className = CANDY_WRAPPER_CLASS;
  wrapper.style.left = `${leftPercent.toFixed(2)}%`;
  wrapper.style.animationDuration = `${floatDuration.toFixed(0)}ms`;

  const sparkle = document.createElement("div");
  sparkle.className = CANDY_SPARKLE_CLASS;
  sparkle.style.width = `${size.toFixed(2)}px`;
  sparkle.style.height = `${size.toFixed(2)}px`;
  sparkle.style.animationDuration = `${twinkleDuration.toFixed(0)}ms`;
  sparkle.style.setProperty("--sway", `${swayPx.toFixed(2)}px`);

  const normalizedProgress = clamp01(initialProgress);
  if (normalizedProgress > 0) {
    wrapper.style.animationDelay = `-${(floatDuration * normalizedProgress).toFixed(0)}ms`;
    sparkle.style.animationDelay = `-${(twinkleDuration * normalizedProgress).toFixed(0)}ms`;
  }

  wrapper.addEventListener("animationend", () => {
    wrapper.remove();
  });

  wrapper.append(sparkle);
  layer.append(wrapper);
};

const clearCandySpawnTimer = () => {
  if (typeof window !== "undefined" && candySpawnTimeoutId !== null) {
    window.clearTimeout(candySpawnTimeoutId);
  }
  candySpawnTimeoutId = null;
};

const scheduleCandySparkleSpawn = () => {
  if (typeof window === "undefined") return;
  clearCandySpawnTimer();
  candySpawnTimeoutId = window.setTimeout(
    () => {
      candySpawnTimeoutId = null;
      if (!isCandyActive()) return;
      spawnCandySparkle();
      scheduleCandySparkleSpawn();
    },
    randomBetween(CANDY_SPAWN_MIN_MS, CANDY_SPAWN_MAX_MS),
  );
};

const startCandySparkles = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const layer = ensureCandySparkleLayer();
  if (!layer) return;

  if (layer.childElementCount === 0) {
    for (let index = 0; index < CANDY_INITIAL_COUNT; index += 1) {
      spawnCandySparkle(Math.random());
    }
  }

  if (candySpawnTimeoutId === null) {
    scheduleCandySparkleSpawn();
  }
};

const stopCandySparkles = () => {
  clearCandySpawnTimer();
  const layer =
    candySparkleLayer ??
    (typeof document !== "undefined"
      ? document.getElementById(CANDY_LAYER_ID)
      : null);
  if (layer instanceof HTMLDivElement) {
    layer.remove();
  }
  candySparkleLayer = null;
};

const refreshCandySparkles = () => {
  if (!isCandyActive()) {
    stopCandySparkles();
    return;
  }
  startCandySparkles();
};

const SUNSET_LAYER_ID = "sunset-ember-layer";
const SUNSET_WRAPPER_CLASS = "sunset-ember-wrapper";
const SUNSET_EMBER_CLASS = "sunset-ember";
const SUNSET_MIN_SIZE_PX = 4;
const SUNSET_MAX_SIZE_PX = 9;
const SUNSET_FLOAT_MIN_MS = 14_000;
const SUNSET_FLOAT_MAX_MS = 22_000;
const SUNSET_SWAY_MIN_MS = 3_000;
const SUNSET_SWAY_MAX_MS = 6_000;
const SUNSET_SPAWN_MIN_MS = 1_500;
const SUNSET_SPAWN_MAX_MS = 3_500;
const SUNSET_INITIAL_COUNT = 6;
const SUNSET_MAX_COUNT = 15;
const SUNSET_MIN_SWAY_PX = 10;
const SUNSET_MAX_SWAY_PX = 30;

const isSunsetActive = () => {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "sunset";
};

const ensureSunsetEmberLayer = () => {
  if (typeof document === "undefined" || !document.body) return null;

  const existing = document.getElementById(SUNSET_LAYER_ID);
  if (existing instanceof HTMLDivElement) {
    sunsetEmberLayer = existing;
    return existing;
  }

  const layer = document.createElement("div");
  layer.id = SUNSET_LAYER_ID;
  document.body.append(layer);
  sunsetEmberLayer = layer;
  return layer;
};

const spawnSunsetEmber = (initialProgress = 0) => {
  if (typeof document === "undefined") return;
  const layer = ensureSunsetEmberLayer();
  if (!layer) return;
  if (layer.childElementCount >= SUNSET_MAX_COUNT) return;

  const size = randomBetween(SUNSET_MIN_SIZE_PX, SUNSET_MAX_SIZE_PX);
  const leftPercent = Math.random() * 100;
  const floatDuration = randomBetween(SUNSET_FLOAT_MIN_MS, SUNSET_FLOAT_MAX_MS);
  const swayDuration = randomBetween(SUNSET_SWAY_MIN_MS, SUNSET_SWAY_MAX_MS);
  const swayPx = randomBetween(SUNSET_MIN_SWAY_PX, SUNSET_MAX_SWAY_PX);

  const colors = ["#f43f5e", "#fb923c", "#f59e0b", "#ff7849"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  const wrapper = document.createElement("div");
  wrapper.className = SUNSET_WRAPPER_CLASS;
  wrapper.style.left = `${leftPercent.toFixed(2)}%`;
  wrapper.style.animationDuration = `${floatDuration.toFixed(0)}ms`;

  const ember = document.createElement("div");
  ember.className = SUNSET_EMBER_CLASS;
  ember.style.width = `${size.toFixed(2)}px`;
  ember.style.height = `${size.toFixed(2)}px`;
  ember.style.color = color;
  ember.style.setProperty("--ember-glow", color);
  ember.style.setProperty("--ember-max-opacity", randomBetween(0.5, 0.95).toFixed(2));
  ember.style.animationDuration = `${swayDuration.toFixed(0)}ms`;
  ember.style.setProperty("--sway", `${swayPx.toFixed(2)}px`);

  const normalizedProgress = clamp01(initialProgress);
  if (normalizedProgress > 0) {
    wrapper.style.animationDelay = `-${(floatDuration * normalizedProgress).toFixed(0)}ms`;
    ember.style.animationDelay = `-${(swayDuration * normalizedProgress).toFixed(0)}ms`;
  }

  wrapper.addEventListener("animationend", () => {
    wrapper.remove();
  });

  wrapper.append(ember);
  layer.append(wrapper);
};

const clearSunsetSpawnTimer = () => {
  if (typeof window !== "undefined" && sunsetSpawnTimeoutId !== null) {
    window.clearTimeout(sunsetSpawnTimeoutId);
  }
  sunsetSpawnTimeoutId = null;
};

const scheduleSunsetEmberSpawn = () => {
  if (typeof window === "undefined") return;
  clearSunsetSpawnTimer();
  sunsetSpawnTimeoutId = window.setTimeout(
    () => {
      sunsetSpawnTimeoutId = null;
      if (!isSunsetActive()) return;
      spawnSunsetEmber();
      scheduleSunsetEmberSpawn();
    },
    randomBetween(SUNSET_SPAWN_MIN_MS, SUNSET_SPAWN_MAX_MS),
  );
};

const startSunsetEmbers = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const layer = ensureSunsetEmberLayer();
  if (!layer) return;

  if (layer.childElementCount === 0) {
    for (let index = 0; index < SUNSET_INITIAL_COUNT; index += 1) {
      spawnSunsetEmber(Math.random());
    }
  }

  if (sunsetSpawnTimeoutId === null) {
    scheduleSunsetEmberSpawn();
  }
};

const stopSunsetEmbers = () => {
  clearSunsetSpawnTimer();
  const layer =
    sunsetEmberLayer ??
    (typeof document !== "undefined"
      ? document.getElementById(SUNSET_LAYER_ID)
      : null);
  if (layer instanceof HTMLDivElement) {
    layer.remove();
  }
  sunsetEmberLayer = null;
};

const refreshSunsetEmbers = () => {
  if (!isSunsetActive()) {
    stopSunsetEmbers();
    return;
  }
  startSunsetEmbers();
};

const FOREST_LAYER_ID = "forest-leaf-layer";
const FOREST_WRAPPER_CLASS = "forest-leaf-wrapper";
const FOREST_LEAF_CLASS = "forest-leaf";
const FOREST_MIN_SIZE_PX = 10;
const FOREST_MAX_SIZE_PX = 20;
const FOREST_FLOAT_MIN_MS = 12_000;
const FOREST_FLOAT_MAX_MS = 20_000;
const FOREST_SWAY_MIN_MS = 4_000;
const FOREST_SWAY_MAX_MS = 7_000;
const FOREST_SPAWN_MIN_MS = 1_800;
const FOREST_SPAWN_MAX_MS = 3_800;
const FOREST_INITIAL_COUNT = 6;
const FOREST_MAX_COUNT = 15;
const FOREST_MIN_SWAY_PX = 12;
const FOREST_MAX_SWAY_PX = 32;

const isForestActive = () => {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "forest";
};

const ensureForestLeafLayer = () => {
  if (typeof document === "undefined" || !document.body) return null;

  const existing = document.getElementById(FOREST_LAYER_ID);
  if (existing instanceof HTMLDivElement) {
    forestLeafLayer = existing;
    return existing;
  }

  const layer = document.createElement("div");
  layer.id = FOREST_LAYER_ID;
  document.body.append(layer);
  forestLeafLayer = layer;
  return layer;
};

const spawnForestLeaf = (initialProgress = 0) => {
  if (typeof document === "undefined") return;
  const layer = ensureForestLeafLayer();
  if (!layer) return;
  if (layer.childElementCount >= FOREST_MAX_COUNT) return;

  const size = randomBetween(FOREST_MIN_SIZE_PX, FOREST_MAX_SIZE_PX);
  const leftPercent = Math.random() * 100;
  const floatDuration = randomBetween(FOREST_FLOAT_MIN_MS, FOREST_FLOAT_MAX_MS);
  const swayDuration = randomBetween(FOREST_SWAY_MIN_MS, FOREST_SWAY_MAX_MS);
  const swayPx = randomBetween(FOREST_MIN_SWAY_PX, FOREST_MAX_SWAY_PX);

  const colors = ["#22c55e", "#15803d", "#86efac", "#eab308", "#ca8a04", "#84cc16"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  const wrapper = document.createElement("div");
  wrapper.className = FOREST_WRAPPER_CLASS;
  wrapper.style.left = `${leftPercent.toFixed(2)}%`;
  wrapper.style.animationDuration = `${floatDuration.toFixed(0)}ms`;

  const leaf = document.createElement("div");
  leaf.className = FOREST_LEAF_CLASS;
  leaf.style.width = `${size.toFixed(2)}px`;
  leaf.style.height = `${size.toFixed(2)}px`;
  leaf.style.color = color;
  leaf.style.setProperty("--leaf-glow", color);
  leaf.style.setProperty("--leaf-max-opacity", randomBetween(0.4, 0.85).toFixed(2));
  leaf.style.animationDuration = `${swayDuration.toFixed(0)}ms`;
  leaf.style.setProperty("--sway", `${swayPx.toFixed(2)}px`);

  // Create leaf SVG structure
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "currentColor");
  svg.style.width = "100%";
  svg.style.height = "100%";

  const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path1.setAttribute("d", "M21 3C11.5 3 3 11.5 3 21c0 0 4.5 0 9-4.5C16.5 12 21 3 21 3z");
  svg.appendChild(path1);

  const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path2.setAttribute("d", "M3 21l-2 2");
  path2.setAttribute("stroke", "currentColor");
  path2.setAttribute("stroke-width", "2");
  path2.setAttribute("stroke-linecap", "round");
  svg.appendChild(path2);

  leaf.appendChild(svg);

  const normalizedProgress = clamp01(initialProgress);
  if (normalizedProgress > 0) {
    wrapper.style.animationDelay = `-${(floatDuration * normalizedProgress).toFixed(0)}ms`;
    leaf.style.animationDelay = `-${(swayDuration * normalizedProgress).toFixed(0)}ms`;
  }

  wrapper.addEventListener("animationend", () => {
    wrapper.remove();
  });

  wrapper.append(leaf);
  layer.append(wrapper);
};

const clearForestSpawnTimer = () => {
  if (typeof window !== "undefined" && forestSpawnTimeoutId !== null) {
    window.clearTimeout(forestSpawnTimeoutId);
  }
  forestSpawnTimeoutId = null;
};

const scheduleForestLeafSpawn = () => {
  if (typeof window === "undefined") return;
  clearForestSpawnTimer();
  forestSpawnTimeoutId = window.setTimeout(
    () => {
      forestSpawnTimeoutId = null;
      if (!isForestActive()) return;
      spawnForestLeaf();
      scheduleForestLeafSpawn();
    },
    randomBetween(FOREST_SPAWN_MIN_MS, FOREST_SPAWN_MAX_MS),
  );
};

const startForestLeaves = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const layer = ensureForestLeafLayer();
  if (!layer) return;

  if (layer.childElementCount === 0) {
    for (let index = 0; index < FOREST_INITIAL_COUNT; index += 1) {
      spawnForestLeaf(Math.random());
    }
  }

  if (forestSpawnTimeoutId === null) {
    scheduleForestLeafSpawn();
  }
};

const stopForestLeaves = () => {
  clearForestSpawnTimer();
  const layer =
    forestLeafLayer ??
    (typeof document !== "undefined"
      ? document.getElementById(FOREST_LAYER_ID)
      : null);
  if (layer instanceof HTMLDivElement) {
    layer.remove();
  }
  forestLeafLayer = null;
};

const refreshForestLeaves = () => {
  if (!isForestActive()) {
    stopForestLeaves();
    return;
  }
  startForestLeaves();
};

const CYBER_LAYER_ID = "cyber-rain-layer";
const CYBER_WRAPPER_CLASS = "cyber-rain-wrapper";
const CYBER_RAIN_CLASS = "cyber-rain";
const CYBER_MIN_HEIGHT_PX = 40;
const CYBER_MAX_HEIGHT_PX = 150;
const CYBER_FALL_MIN_MS = 800;
const CYBER_FALL_MAX_MS = 2_200;
const CYBER_SPAWN_MIN_MS = 100;
const CYBER_SPAWN_MAX_MS = 400;
const CYBER_INITIAL_COUNT = 15;
const CYBER_MAX_COUNT = 40;

const isCyberpunkActive = () => {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "cyberpunk";
};

const ensureCyberRainLayer = () => {
  if (typeof document === "undefined" || !document.body) return null;

  const existing = document.getElementById(CYBER_LAYER_ID);
  if (existing instanceof HTMLDivElement) {
    cyberRainLayer = existing;
    return existing;
  }

  const layer = document.createElement("div");
  layer.id = CYBER_LAYER_ID;
  document.body.append(layer);
  cyberRainLayer = layer;
  return layer;
};

const spawnCyberRain = (initialProgress = 0) => {
  if (typeof document === "undefined") return;
  const layer = ensureCyberRainLayer();
  if (!layer) return;
  if (layer.childElementCount >= CYBER_MAX_COUNT) return;

  const height = randomBetween(CYBER_MIN_HEIGHT_PX, CYBER_MAX_HEIGHT_PX);
  const leftPercent = Math.random() * 100;
  const fallDuration = randomBetween(CYBER_FALL_MIN_MS, CYBER_FALL_MAX_MS);

  const colors = ["#0ea5e9", "#22d3ee", "#f472b6", "#e879f9", "#fbbf24", "#fef08a"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  const wrapper = document.createElement("div");
  wrapper.className = CYBER_WRAPPER_CLASS;
  wrapper.style.left = `${leftPercent.toFixed(2)}%`;
  wrapper.style.animationDuration = `${fallDuration.toFixed(0)}ms`;

  const rainDrop = document.createElement("div");
  rainDrop.className = CYBER_RAIN_CLASS;
  rainDrop.style.height = `${height.toFixed(2)}px`;
  rainDrop.style.color = color;
  rainDrop.style.setProperty("--rain-glow", color);
  
  const normalizedProgress = clamp01(initialProgress);
  if (normalizedProgress > 0) {
    wrapper.style.animationDelay = `-${(fallDuration * normalizedProgress).toFixed(0)}ms`;
  }

  wrapper.addEventListener("animationend", () => {
    wrapper.remove();
  });

  wrapper.append(rainDrop);
  layer.append(wrapper);
};

const clearCyberSpawnTimer = () => {
  if (typeof window !== "undefined" && cyberSpawnTimeoutId !== null) {
    window.clearTimeout(cyberSpawnTimeoutId);
  }
  cyberSpawnTimeoutId = null;
};

const scheduleCyberRainSpawn = () => {
  if (typeof window === "undefined") return;
  clearCyberSpawnTimer();
  cyberSpawnTimeoutId = window.setTimeout(
    () => {
      cyberSpawnTimeoutId = null;
      if (!isCyberpunkActive()) return;
      spawnCyberRain();
      scheduleCyberRainSpawn();
    },
    randomBetween(CYBER_SPAWN_MIN_MS, CYBER_SPAWN_MAX_MS),
  );
};

const startCyberRain = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const layer = ensureCyberRainLayer();
  if (!layer) return;

  if (layer.childElementCount === 0) {
    for (let index = 0; index < CYBER_INITIAL_COUNT; index += 1) {
      spawnCyberRain(Math.random());
    }
  }

  if (cyberSpawnTimeoutId === null) {
    scheduleCyberRainSpawn();
  }
};

const stopCyberRain = () => {
  clearCyberSpawnTimer();
  const layer =
    cyberRainLayer ??
    (typeof document !== "undefined"
      ? document.getElementById(CYBER_LAYER_ID)
      : null);
  if (layer instanceof HTMLDivElement) {
    layer.remove();
  }
  cyberRainLayer = null;
};

const refreshCyberRain = () => {
  if (!isCyberpunkActive()) {
    stopCyberRain();
    return;
  }
  startCyberRain();
};

const ensureSystemDarkListener = () => {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    isSystemDarkListenerAttached
  ) {
    return;
  }
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemDarkChange = () => {
    refreshNaturalSkyEffects();
    refreshAuroraEffect();
    refreshCandySparkles();
    refreshSunsetEmbers();
    refreshForestLeaves();
    refreshCyberRain();
  };
  mediaQuery.addEventListener("change", onSystemDarkChange);
  isSystemDarkListenerAttached = true;
};

export const getInitialTheme = (): ThemeId => {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isThemeId(stored) ? stored : DEFAULT_THEME;
};

export const getInitialMode = (): ModeId => {
  if (typeof window === "undefined") return DEFAULT_MODE;
  const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
  return isModeId(stored) ? stored : DEFAULT_MODE;
};

export const applyTheme = (theme: ThemeId) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  ensureSystemDarkListener();
  refreshNaturalSkyEffects();
  refreshAuroraEffect();
  refreshCandySparkles();
  refreshSunsetEmbers();
  refreshForestLeaves();
  refreshCyberRain();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }
};

export const applyMode = (mode: ModeId) => {
  if (typeof document === "undefined") return;
  if (mode === "system") {
    delete document.documentElement.dataset.mode;
  } else {
    document.documentElement.dataset.mode = mode;
  }
  ensureSystemDarkListener();
  refreshNaturalSkyEffects();
  refreshAuroraEffect();
  refreshCandySparkles();
  refreshSunsetEmbers();
  refreshForestLeaves();
  refreshCyberRain();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  }
};
