// https://webgl2fundamentals.org/webgl/lessons/webgl-drawing-without-data.html

const canvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("plot")
);
const progress = /** @type {HTMLProgressElement} */ (
  document.getElementById("plot-progress")
);
const axis = /** @type {HTMLDivElement} */ (document.getElementById("axis"));
const gl = canvas.getContext("webgl2");

const allHindices = hindices.flatMap((obj) => [...obj.self, ...obj.citedBy]);
const highestHindex = Math.max(...allHindices);
const lowestHindex = Math.min(...allHindices);

const selfHindexList = [];
const citedByHindexList = [];

hindices.forEach((dataPoint) => {
  dataPoint.self.forEach((selfHindex) => {
    dataPoint.citedBy.forEach((citedByHindex) => {
      selfHindexList.push(selfHindex);
      citedByHindexList.push(citedByHindex);
    });
  });
});
const drawCount = selfHindexList.length;
console.log({ drawCount });

const vertexShaderSource = `#version 300 es
in vec3 position;
in uint selfHindex;
in uint citedByHindex;

flat out uint vSelfHindex;
flat out uint vCitedByHindex;

void main() {
  vSelfHindex = selfHindex;
  vCitedByHindex = citedByHindex;
  gl_Position = vec4(position, 1.0);
}
`;
const fragmentShaderSource = `#version 300 es
precision highp float;

flat in uint vSelfHindex;
flat in uint vCitedByHindex;
in vec2 vUv;

out vec4 fragmentColor;

uniform uint highestHindex;
uniform uint lowestHindex;
uniform float lineThickness;
uniform float lineAlpha;
uniform float lineSmoothness;
uniform float axisFontScale;
uniform vec2 screenSize;

float hindexToClipSpace(uint hindex) {
  return float(hindex - lowestHindex) / float(highestHindex - lowestHindex);
}

void main() {
  if (vSelfHindex == vCitedByHindex) discard;

  vec2 clipSpace = gl_FragCoord.xy / screenSize;
  vec3 color;
  float centerShift;

  if(vSelfHindex < vCitedByHindex) {
    centerShift = axisFontScale / 200.0;
    if (clipSpace.y < 0.5 + centerShift) discard;
    color = vec3(0.0, 0.0, 1.0);
  } else {
    centerShift = -axisFontScale / 200.0;
    if (clipSpace.y > 0.5 + centerShift) discard;
    color = vec3(1.0, 0.0, 0.0);
  }

  float selfHindexClipSpace = hindexToClipSpace(vSelfHindex);
  float citedByHindexClipSpace = hindexToClipSpace(vCitedByHindex);

  vec2 arcCenter = vec2(
    (selfHindexClipSpace + citedByHindexClipSpace) / 2.0,
    0.5 + centerShift
  );

  float arcRadius = abs(selfHindexClipSpace - citedByHindexClipSpace) / 2.0;
  float arcDistance = distance(arcCenter, clipSpace);
  
  float arcAlpha = (1.0 - smoothstep(
    arcRadius - lineSmoothness,
    arcRadius + lineSmoothness,
    arcDistance - lineThickness / 2.0
  )) * smoothstep(
    arcRadius - lineSmoothness,
    arcRadius + lineSmoothness,
    arcDistance + lineThickness / 2.0
  );

  fragmentColor = vec4(color, arcAlpha * lineAlpha);
  fragmentColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`;

function compileShaderProgram(vertexShaderSource, fragmentShaderSource) {
  function compileShader(shaderSource, shaderType) {
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
      throw "Failed to compile shader source:" + gl.getShaderInfoLog(shader);
    }

    return shader;
  }
  const shaderProgram = gl.createProgram();

  const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(
    fragmentShaderSource,
    gl.FRAGMENT_SHADER
  );

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  const success = gl.getProgramParameter(shaderProgram, gl.LINK_STATUS);
  if (!success) {
    throw (
      "Failed to link shader program:" + gl.getProgramInfoLog(shaderProgram)
    );
  }

  return shaderProgram;
}

const shaderProgram = compileShaderProgram(
  vertexShaderSource,
  fragmentShaderSource
);
gl.useProgram(shaderProgram);

function createAttribute(
  shaderProgram,
  attributeName,
  attributeElementSize,
  attributeType,
  attributeData
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  // TODO Parametrize usage.
  gl.bufferData(gl.ARRAY_BUFFER, attributeData, gl.STATIC_DRAW);

  const attributeLocation = gl.getAttribLocation(shaderProgram, attributeName);

  // TODO Adapt to work for floats as well.
  gl.vertexAttribIPointer(
    attributeLocation,
    attributeElementSize,
    attributeType,
    false,
    0,
    0
  );

  gl.enableVertexAttribArray(attributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);
createAttribute(
  shaderProgram,
  "position",
  3,
  gl.INT,
  new Int32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1] *drawCount)
);
createAttribute(
  shaderProgram,
  "selfHindex",
  1,
  gl.UNSIGNED_INT,
  new Uint32Array(selfHindexList)
);
createAttribute(
  shaderProgram,
  "citedByHindex",
  1,
  gl.UNSIGNED_INT,
  new Uint32Array(citedByHindexList)
);

class Uniform {
  #name;
  #location;
  #setter;

  constructor(name, setter, initialValue = 0, controls = false) {
    this.#name = name;
    this.#setter = setter;
    this.#location = gl.getUniformLocation(shaderProgram, name);
    this.setValue(initialValue);
  }

  setValue(value) {
    this.#setter.bind(gl, this.#location, value);
  }
}

let axisFontScale = 2;
let axisDistance = 250;
const uniforms = {
  screenSize: new Uniform("screenSize", gl.uniform2f, [0, 0]),
  lowestHindex: new Uniform("lowestHindex", gl.uniform1ui, lowestHindex),
  highestHindex: new Uniform("highestHindex", gl.uniform1ui, highestHindex),
  axisFontScale: new Uniform("axisFontScale", gl.uniform1f, axisFontScale),
  lineThickness: new Uniform("lineThickness", gl.uniform1f, 0.001),
  lineAlpha: new Uniform("lineAlpha", gl.uniform1f, 0.1),
  lineSmoothness: new Uniform("lineSmoothness", gl.uniform1f, 0.001),
};

function adaptAxisLabels() {
  axis.innerHTML = "";

  const labelCount = Math.ceil(canvas.width / axisDistance);
  for (let labelIndex = 0; labelIndex < labelCount; labelIndex++) {
    const labelSpan = document.createElement("span");
    const labelPosition = labelIndex * axisDistance;
    labelSpan.innerText = Math.round(
      (labelPosition / canvas.width) * highestHindex
    );
    labelSpan.style.left = "" + labelPosition + "px";
    labelSpan.style.fontSize = axisFontScale + "vh";
    axis.appendChild(labelSpan);
  }
}

function render() {
  console.log("render");
  gl.drawArrays(gl.POINTS, 0, drawCount);
}

function adaptToWindowSize() {
  gl.canvas.width = gl.canvas.clientWidth;
  gl.canvas.height = gl.canvas.clientHeight;
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  uniforms.screenSize.setValue([gl.canvas.width, gl.canvas.height]);
  adaptAxisLabels();
  requestAnimationFrame(render);
}
gl.clearColor(1, 0, 0, 1);
gl.clearDepth(gl.COLOR_BUFFER_BIT);
adaptToWindowSize();
window.addEventListener("resize", adaptToWindowSize);

/*const controlPanel = document.getElementById("control-panel");
Object.keys(material.uniforms).forEach((uniformKey) => {
  if (material.uniforms[uniformKey].controls == false) return;
  const value = material.uniforms[uniformKey].value;

  const inputElement = document.createElement("input");
  inputElement.id = uniformKey;
  inputElement.type = "range";
  inputElement.min = value * 0.1;
  inputElement.max = value * 1.9;
  inputElement.step = value * 0.05;
  inputElement.value = value;

  const inputLabel = document.createElement("label");
  inputLabel.for = uniformKey;
  inputLabel.innerText = uniformKey + ": " + value;
  controlPanel.append(inputLabel);
  controlPanel.append(inputElement);

  inputElement.addEventListener("input", (event) => {
    let newValue = event.target.value;

    if (material.uniforms[uniformKey].type == "i") {
      newValue = Math.round(newValue);
    }
    event.target.value = newValue;
    material.uniforms[uniformKey].value = newValue;
    inputLabel.innerText = uniformKey + ": " + newValue;
    requestAnimationFrame(render);

    if (uniformKey == "axisDistance") {
      axisDistance = newValue;
      adaptAxisLabels();
    }
    if (uniformKey == "axisFontScale") {
      axisFontScale = newValue;
      adaptAxisLabels();
    }
  });
});*/
