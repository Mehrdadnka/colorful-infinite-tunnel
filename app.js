window.addEventListener('DOMContentLoaded', () => {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('canvas');
  const gl = canvas.getContext('webgl');

  if(!gl) {
    alert("WEBGL is not supported!")
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Create the shader program
  const vertexShaderSource = /* glsl */ `
    attribute vec2 a_position;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = /* glsl */ `

    precision mediump float;

    uniform float iTime;
    uniform vec2 iResolution;

    #define SCALE_X 16.0
    #define SCALE_Y 5.0
    #define TIME_SCALE 0.1
    #define BORDER 1.4

    float hash1(float n) { return fract(sin(n) * 437518.56453) + 0.1; }

    float box(vec2 st) {
      vec2 s = vec2(0.001); // border size
      vec2 w = vec2(0.05); // border smoothness
      vec2 uv = smoothstep(s, s + w, st);
      uv *= smoothstep(s, s + w, vec2(1.0) - st);
      return uv.x * uv.y * (1.0 - length(0.5 - st) * 0.75);
    }

    vec3 hsb2rgb(in vec3 c) {
      vec3 aqua = vec3(0.0, 1.0, 1.0);
        
      vec3 pink = vec3(1.0, 0.0, 1.0);

      vec3 rgb = mix(aqua, pink, c.x);
        
      rgb = rgb * rgb * (3.0 - 2.0 * rgb);
        
      return c.z * mix(vec3(1.0), rgb, c.y);
    }

    float fbm(in vec2 st) {
      float value = (sin(iTime * 5.0 * hash1(st.x + hash1(st.y))) + 4.0) * 0.25;
      return max(0.75, pow(value, 3.0));
    }
    vec3 flowCubes(vec2 fragCoord, vec2 uv, float lt) {
      float i = floor(uv.x);
      uv.x = fract(uv.x);

      vec3 color = vec3(0.0);
      float c = 1.0;

      if(uv.y < BORDER - lt) {
        uv.y += iTime * TIME_SCALE;
        uv.y *= SCALE_Y;
        float j = floor(uv.y);

        uv.y = fract(uv.y);
        color = hsb2rgb(vec3(hash1(j + hash1(i)), 0.7, fbm(vec2(i, j)))) * box(uv);
      } else {
        float fade = smoothstep(3.0, 0.0, sqrt(uv.y));
        uv.y += lt - BORDER;
        float j = floor((BORDER - lt + iTime * TIME_SCALE) * SCALE_Y + floor(uv.y));

        uv.y = fract(uv.y) * SCALE_Y + min(0.0, 1.0 - SCALE_Y + lt * (SCALE_Y / TIME_SCALE * SCALE_Y * hash1(i + hash1(j)) + 1.0));
        c *= box(uv);
        c += smoothstep(3.0, 1.0, sqrt(uv.y)) * smoothstep(1.0, 1.05, uv.y) * smoothstep(0.5, 0.45, abs(uv.x - 0.5)) * 0.25;
        c *= fade;
        
        vec3 cubeColor;

        if(mod(i + j, 2.0) > 0.5) {
          cubeColor = vec3(1.0, 0.0, 1.0);
        } else {
          cubeColor = vec3(0.0, 1.0, 1.0);
        }
        color = mix(color, cubeColor, c);
        color = color * color * color * color * (3.0 - 2.0 * color);
      }
      return color;
    }

    void main() {
      vec2 g = gl_FragCoord.xy;
      vec2 si = iResolution.xy;
      vec2 uv = (g + g - si) / si.y;

      float a = atan(uv.x, uv.y);
      float r = length(uv);

      uv = vec2(a, r / dot(uv, uv));

      vec3 color = vec3(0.0);
      float c = 1.0;

      float lt = mod(iTime * TIME_SCALE, 1.0 / SCALE_Y); // local time cycle

      uv.x *= SCALE_X / 3.1415926;
      float i = floor(uv.x); // row
      uv.x = fract(uv.x);

      if (uv.y < BORDER - lt) {
        uv.y += iTime * TIME_SCALE;
        uv.y *= SCALE_Y;
        float j = floor(uv.y);

        uv.y = fract(uv.y);
        color = hsb2rgb(vec3(hash1(j + hash1(i)), 0.7, fbm(vec2(i, j)))) * box(uv);
      } else {
        float fade = smoothstep(3.0, 0.0, sqrt(uv.y)); // fade to darkness
        uv.y += lt - BORDER;
        float j = floor((BORDER - lt + iTime * TIME_SCALE) * SCALE_Y + floor(uv.y));
        uv.y = fract(uv.y) * SCALE_Y + min(0.0, 1.0 - SCALE_Y + lt * (SCALE_Y / TIME_SCALE * SCALE_Y * hash1(i + hash1(j)) + 1.0));
        c *= box(uv); // cell
        c += smoothstep(3.0, 1.0, sqrt(uv.y)) * smoothstep(1.0, 1.05, uv.y) * smoothstep(0.5, 0.45, abs(uv.x - 0.5)) * 0.25; // cell trail
        c *= fade; // fade to darkness
        color = mix(color, hsb2rgb(vec3(hash1(j + hash1(i)), 0.7, fbm(vec2(i, j)))), c);
      }
      color += flowCubes(g, uv * vec2(SCALE_X / 3.1415926, 1.0), mod(iTime * TIME_SCALE, 1.0 / SCALE_Y));

      color = color * color * ( 3.0 - 2.0 * color);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Error", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
      console.error("Error Program: ", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);

  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  const program = createProgram(gl, vertexShader, fragmentShader);

  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
    -1, 1,
    1, -1,
    1, 1
  ]), gl.STATIC_DRAW);
  
  gl.enableVertexAttribArray(positionAttributeLocation);
  
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  const timeUniformLocation = gl.getUniformLocation(program, 'iTime');

  const resolutionUniformLocation = gl.getUniformLocation(program, 'iResolution');

  function resize(canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(time){
    resize(canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    time *= 0.001;
    
    gl.useProgram(program);
    gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);

    gl.uniform1f(timeUniformLocation, performance.now() / 2000);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})