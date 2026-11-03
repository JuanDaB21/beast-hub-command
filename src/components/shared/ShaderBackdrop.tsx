import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/*
  Fondo animado (WebGL1): ruido fbm con deformación de dominio, grafito con
  vetas naranja Beast. Se pausa fuera de pantalla y con la pestaña oculta; con
  prefers-reduced-motion dibuja un solo cuadro. Sin dependencias.
*/

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 r;
uniform float t;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 5; k++) { v += a * n(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / r.y;
  float s = t * 0.035;
  vec2 q = vec2(fbm(uv * 1.6 + s), fbm(uv * 1.6 - s + 4.2));
  float f = fbm(uv * 2.2 + 2.4 * q + vec2(s * 1.7, -s));
  vec3 base = mix(vec3(0.07, 0.08, 0.1), vec3(0.24, 0.26, 0.31), smoothstep(0.25, 0.85, f));
  float vein = smoothstep(0.55, 0.68, f) * smoothstep(0.86, 0.66, f);
  vec3 col = base + vec3(1.0, 0.42, 0.08) * vein * 1.25;
  col *= 0.75 + 0.35 * smoothstep(0.0, 1.2, uv.y);
  gl_FragColor = vec4(col, 1.0);
}`;

export function ShaderBackdrop({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl", { antialias: false, alpha: false });
    if (!canvas || !gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "r");
    const uTime = gl.getUniformLocation(prog, "t");

    // Media resolución: el ruido no necesita más y ahorra batería en móvil.
    const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
    const resize = () => {
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    const draw = (ms: number) => {
      gl.uniform1f(uTime, ms / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    const loop = (ms: number) => {
      draw(ms);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf && visible && !document.hidden && !reduced) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    resize();
    draw(12000);
    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now() + 12000);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={cn("block h-full w-full bg-[#0e1014]", className)} />;
}
