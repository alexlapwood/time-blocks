import { startAuroraShader, stopAuroraShader } from "./aurora-shader";

export const THEMES = [
  { id: "default", label: "Default" },
  { id: "bliss", label: "Bliss" },
  { id: "candy", label: "Candy" },
  { id: "dune", label: "Dune" },
  { id: "gameboy", label: "Game Boy" },
  { id: "ocean", label: "Ocean" },
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
const NATURAL_CLOUD_MIN_ALPHA = 0.5;
const NATURAL_CLOUD_MAX_ALPHA = 0.94;
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

const randomNaturalCloudAlpha = () =>
  randomBetween(NATURAL_CLOUD_MIN_ALPHA, NATURAL_CLOUD_MAX_ALPHA);

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
  const travelExtraPx = cloudWidthPx + NATURAL_CLOUD_TRAVEL_PADDING_PX;

  const cloud = document.createElement("div");
  cloud.className = NATURAL_CLOUD_CLASS;
  cloud.style.width = `${cloudWidthPx.toFixed(2)}px`;
  cloud.style.height = `${cloudHeightPx.toFixed(2)}px`;
  cloud.style.top = `${topPx.toFixed(2)}px`;
  cloud.style.opacity = randomNaturalCloudAlpha().toFixed(2);
  cloud.style.animationDuration = `${durationMs.toFixed(0)}ms`;
  cloud.style.setProperty(
    "--cloud-travel-extra",
    `${travelExtraPx.toFixed(2)}px`,
  );

  const normalizedProgress = clamp01(initialProgress);
  if (normalizedProgress > 0) {
    cloud.style.animationDelay = `-${(durationMs * normalizedProgress).toFixed(0)}ms`;
  }

  cloud.addEventListener("animationend", () => {
    cloud.remove();
  });

  layer.append(cloud);
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
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  }
};
