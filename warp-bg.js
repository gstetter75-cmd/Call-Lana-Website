/**
 * Warp Shader Background — Call Lana
 * Lightweight canvas-based animated background using WebGL.
 * Renders flowing, warped organic shapes in brand purple tones.
 *
 * Usage: Add <canvas class="warp-bg-canvas"></canvas> inside a hero section,
 *        then call initWarpBackground('.your-selector canvas.warp-bg-canvas')
 */

(function () {
  'use strict';

  const VERTEX_SRC = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SRC = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;

    // Simplex-style noise helpers
    vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                         -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    // Brand colors (purple palette)
    // #FAF5FF (50), #F3E8FF (100), #E9D5FF (200), #D8B4FE (300),
    // #7C3AED (400), #6D28D9 (500), #5B21B6 (600), #4C1D95 (700)
    vec3 brandLight  = vec3(0.914, 0.835, 0.996); // #E9D5FF
    vec3 brandMid    = vec3(0.486, 0.227, 0.929); // #7C3AED
    vec3 brandDeep   = vec3(0.357, 0.129, 0.714); // #5B21B6
    vec3 brandDark   = vec3(0.298, 0.114, 0.584); // #4C1D95
    vec3 bgWhite     = vec3(0.980, 0.961, 1.000); // #FAF5FF

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float aspect = u_resolution.x / u_resolution.y;
      vec2 p = uv * 2.0 - 1.0;
      p.x *= aspect;

      float t = u_time * 0.15; // slow speed

      // Warp the coordinates
      float warpX = snoise(p * 1.2 + vec2(t * 0.7, t * 0.3)) * 0.25;
      float warpY = snoise(p * 1.2 + vec2(-t * 0.5, t * 0.6)) * 0.25;
      vec2 warped = p + vec2(warpX, warpY);

      // Layered noise
      float n1 = snoise(warped * 0.8 + t * 0.4) * 0.5 + 0.5;
      float n2 = snoise(warped * 1.5 - t * 0.3) * 0.5 + 0.5;
      float n3 = snoise(warped * 2.5 + t * 0.2) * 0.5 + 0.5;

      // Swirl effect
      float angle = snoise(warped * 0.6 + t * 0.1) * 3.14159 * 0.5;
      float swirl = snoise(vec2(cos(angle), sin(angle)) * 1.5 + warped) * 0.5 + 0.5;

      // Combine layers
      float combined = n1 * 0.4 + n2 * 0.3 + swirl * 0.3;

      // Color mixing — soft purple gradients
      vec3 col = bgWhite;
      col = mix(col, brandLight, smoothstep(0.25, 0.55, combined) * 0.6);
      col = mix(col, brandMid, smoothstep(0.5, 0.8, combined) * 0.15);
      col = mix(col, brandDeep, smoothstep(0.65, 0.95, combined) * 0.08);

      // Add subtle glow spots
      float glow1 = smoothstep(0.7, 0.0, length(p - vec2(sin(t * 0.5) * 0.8, cos(t * 0.4) * 0.5)));
      float glow2 = smoothstep(0.9, 0.0, length(p - vec2(cos(t * 0.3) * 1.0, sin(t * 0.6) * 0.6)));
      col = mix(col, brandLight, glow1 * 0.12);
      col = mix(col, vec3(0.847, 0.706, 0.996), glow2 * 0.08); // #D8B4FE

      // Fine detail — subtle checkered warp (nod to the Warp shader "checks" shape)
      float checks = snoise(warped * 6.0 + t * 0.1);
      checks = smoothstep(-0.1, 0.1, checks);
      col = mix(col, col * 0.96, checks * 0.15 * n3);

      // Edge fade — blend to the page background gradient at edges
      float edgeFade = smoothstep(0.0, 0.4, uv.y) * smoothstep(1.0, 0.7, uv.y);
      edgeFade *= smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x);

      // Base page gradient: linear-gradient(135deg, #FFFFFF 0%, #FBF7FF 30%, #F5EEFF 60%, #EFE8FF 100%)
      vec3 pageBg = mix(
        mix(vec3(1.0), vec3(0.984, 0.969, 1.0), smoothstep(0.0, 0.3, uv.x * 0.5 + uv.y * 0.5)),
        mix(vec3(0.961, 0.933, 1.0), vec3(0.937, 0.910, 1.0), smoothstep(0.6, 1.0, uv.x * 0.5 + uv.y * 0.5)),
        smoothstep(0.3, 0.6, uv.x * 0.5 + uv.y * 0.5)
      );

      col = mix(pageBg, col, edgeFade * 0.85);

      // Keep overall opacity subtle
      col = mix(pageBg, col, 0.7);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('Warp BG shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function initWarpCanvas(canvas) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl) return null;

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Warp BG program error:', gl.getProgramInfoLog(program));
      return null;
    }
    gl.useProgram(program);

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');

    return { gl, uRes, uTime };
  }

  function initWarpBackground(selector) {
    const canvases = document.querySelectorAll(selector);
    if (!canvases.length) return;

    const instances = [];

    canvases.forEach(function (canvas) {
      const ctx = initWarpCanvas(canvas);
      if (!ctx) {
        // Fallback: hide canvas, the existing CSS gradient remains
        canvas.style.display = 'none';
        return;
      }
      instances.push({ canvas: canvas, ctx: ctx });
    });

    if (!instances.length) return;

    // Resize handler
    function resize() {
      instances.forEach(function (inst) {
        const rect = inst.canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for perf
        const w = Math.round(rect.width * dpr);
        const h = Math.round(rect.height * dpr);
        if (inst.canvas.width !== w || inst.canvas.height !== h) {
          inst.canvas.width = w;
          inst.canvas.height = h;
          inst.ctx.gl.viewport(0, 0, w, h);
        }
      });
    }

    resize();
    window.addEventListener('resize', resize);

    // Throttled animation — target ~30fps for performance
    let lastFrame = 0;
    const FRAME_INTERVAL = 1000 / 30;
    let rafId;

    function render(timestamp) {
      rafId = requestAnimationFrame(render);

      if (timestamp - lastFrame < FRAME_INTERVAL) return;
      lastFrame = timestamp;

      const t = timestamp * 0.001;

      instances.forEach(function (inst) {
        const gl = inst.ctx.gl;
        gl.uniform2f(inst.ctx.uRes, inst.canvas.width, inst.canvas.height);
        gl.uniform1f(inst.ctx.uTime, t);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      });
    }

    // Only animate when visible
    const observer = new IntersectionObserver(function (entries) {
      const anyVisible = entries.some(function (e) { return e.isIntersecting; });
      if (anyVisible && !rafId) {
        rafId = requestAnimationFrame(render);
      } else if (!anyVisible && rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }, { threshold: 0 });

    instances.forEach(function (inst) {
      observer.observe(inst.canvas);
    });

    // Start
    rafId = requestAnimationFrame(render);
  }

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initWarpBackground('.warp-hero-bg canvas.warp-bg-canvas');
    });
  } else {
    initWarpBackground('.warp-hero-bg canvas.warp-bg-canvas');
  }

  // Expose for manual use
  window.initWarpBackground = initWarpBackground;
})();
