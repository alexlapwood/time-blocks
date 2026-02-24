const AURORA_CANVAS_ID = "aurora-shader-layer";
const RENDER_SCALE = 0.5;

let canvas: HTMLCanvasElement | null = null;
let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let rafId: number | null = null;
let startTime = 0;
let resizeHandler: (() => void) | null = null;
let timeLoc: WebGLUniformLocation | null = null;
let resolutionLoc: WebGLUniformLocation | null = null;

const VERT_SRC = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Adapted from "Auroras" by nimitz (twitter: @stormoid)
// https://www.shadertoy.com/view/XtGGRt
// License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0
const FRAG_SRC = `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

#define time u_time

mat2 mm2(in float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}

mat2 m2 = mat2(0.95534, 0.29552, -0.29552, 0.95534);

float tri(in float x) {
  return clamp(abs(fract(x) - 0.5), 0.01, 0.49);
}

vec2 tri2(in vec2 p) {
  return vec2(tri(p.x) + tri(p.y), tri(p.y + tri(p.x)));
}

float triNoise2d(in vec2 p, float spd) {
  float z = 1.8;
  float z2 = 2.5;
  float rz = 0.0;
  p *= mm2(p.x * 0.06);
  vec2 bp = p;
  for (float i = 0.0; i < 5.0; i++) {
    vec2 dg = tri2(bp * 1.85) * 0.75;
    dg *= mm2(time * spd);
    p -= dg / z2;
    bp *= 1.3;
    z2 *= 0.45;
    z *= 0.42;
    p *= 1.21 + (rz - 1.0) * 0.02;
    rz += tri(p.x + tri(p.y)) * z;
    p *= -m2;
  }
  return clamp(1.0 / pow(rz * 29.0, 1.3), 0.0, 0.55);
}

float hash21(in vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

vec4 aurora(vec3 ro, vec3 rd) {
  vec4 col = vec4(0);
  vec4 avgCol = vec4(0);

  for (float i = 0.0; i < 30.0; i++) {
    float of = 0.006 * hash21(gl_FragCoord.xy) * smoothstep(0.0, 15.0, i);
    float pt = ((0.8 + pow(i, 1.2) * 0.003) - ro.y) / (rd.y * 2.0 + 0.4);
    pt -= of;
    vec3 bpos = ro + pt * rd;
    vec2 p = bpos.zx;
    float rzt = triNoise2d(p, 0.06);
    vec4 col2 = vec4(0, 0, 0, rzt);
    col2.rgb = (sin(1.0 - vec3(2.15, -0.5, 1.2) + i * 0.043) * 0.5 + 0.5) * rzt;
    avgCol = mix(avgCol, col2, 0.5);
    col += avgCol * exp2(-i * 0.055 - 2.2) * smoothstep(0.0, 5.0, i);
  }

  col *= clamp(rd.y * 15.0 + 0.4, 0.0, 1.0);
  return col * 2.3;
}

vec3 bg(in vec3 rd) {
  float sd = dot(normalize(vec3(-0.5, -0.6, 0.9)), rd) * 0.5 + 0.5;
  sd = pow(sd, 5.0);
  vec3 col = mix(vec3(0.05, 0.1, 0.2), vec3(0.1, 0.05, 0.2), sd);
  return col * 0.63;
}

void main() {
  vec2 q = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = q - 0.5;
  p.x *= u_resolution.x / u_resolution.y;

  vec3 ro = vec3(0, 0, -6.7);
  vec3 rd = normalize(vec3(p, 1.3));

  rd.yz *= mm2(0.18);

  vec3 col = bg(rd);

  // All rays look upward, so always render aurora
  vec4 aur = smoothstep(0.0, 1.5, aurora(ro, rd));
  col = col * (1.0 - aur.a) + aur.rgb;

  gl_FragColor = vec4(col, 1.0);
}`;

const compileShader = (
  ctx: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null => {
  const shader = ctx.createShader(type);
  if (!shader) return null;
  ctx.shaderSource(shader, source);
  ctx.compileShader(shader);
  if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
    ctx.deleteShader(shader);
    return null;
  }
  return shader;
};

const createProgram = (
  ctx: WebGLRenderingContext,
): WebGLProgram | null => {
  const vs = compileShader(ctx, ctx.VERTEX_SHADER, VERT_SRC);
  const fs = compileShader(ctx, ctx.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) return null;

  const prog = ctx.createProgram();
  if (!prog) return null;
  ctx.attachShader(prog, vs);
  ctx.attachShader(prog, fs);
  ctx.linkProgram(prog);

  if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
    ctx.deleteProgram(prog);
    return null;
  }

  ctx.deleteShader(vs);
  ctx.deleteShader(fs);
  return prog;
};

const setupGeometry = (
  ctx: WebGLRenderingContext,
  prog: WebGLProgram,
) => {
  const loc = ctx.getAttribLocation(prog, "a_position");
  const buf = ctx.createBuffer();
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
  ctx.bufferData(
    ctx.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    ctx.STATIC_DRAW,
  );
  ctx.enableVertexAttribArray(loc);
  ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
};

const resizeCanvas = () => {
  if (!canvas || !gl) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * RENDER_SCALE);
  canvas.height = Math.round(h * RENDER_SCALE);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  gl.viewport(0, 0, canvas.width, canvas.height);
};

const renderFrame = () => {
  if (!gl || !program) return;
  const elapsed = (performance.now() - startTime) / 1000;
  gl.uniform1f(timeLoc, elapsed);
  gl.uniform2f(resolutionLoc, gl.canvas.width, gl.canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  rafId = requestAnimationFrame(renderFrame);
};

const initPipeline = () => {
  if (!gl) return false;

  program = createProgram(gl);
  if (!program) return false;

  setupGeometry(gl, program);
  gl.useProgram(program);
  timeLoc = gl.getUniformLocation(program, "u_time");
  resolutionLoc = gl.getUniformLocation(program, "u_resolution");
  return true;
};

export const startAuroraShader = () => {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (canvas) return;

  const el = document.createElement("canvas");
  el.id = AURORA_CANVAS_ID;
  el.style.position = "fixed";
  el.style.inset = "0";
  el.style.zIndex = "0";
  el.style.pointerEvents = "none";
  document.body.append(el);
  canvas = el;

  const ctx = el.getContext("webgl", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  });

  if (!ctx) {
    el.remove();
    canvas = null;
    return;
  }
  gl = ctx;

  el.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  });

  el.addEventListener("webglcontextrestored", () => {
    if (!initPipeline()) return;
    resizeCanvas();
    startTime = performance.now();
    rafId = requestAnimationFrame(renderFrame);
  });

  if (!initPipeline()) {
    el.remove();
    canvas = null;
    gl = null;
    return;
  }

  resizeCanvas();

  resizeHandler = resizeCanvas;
  window.addEventListener("resize", resizeHandler);

  startTime = performance.now();
  rafId = requestAnimationFrame(renderFrame);
};

export const stopAuroraShader = () => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (resizeHandler && typeof window !== "undefined") {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }

  if (gl) {
    const ext = gl.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();
    gl = null;
  }

  program = null;
  timeLoc = null;
  resolutionLoc = null;

  if (canvas) {
    canvas.remove();
    canvas = null;
  }
};
