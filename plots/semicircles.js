/* global THREE */

const canvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("plot")
);
const progress = /** @type {HTMLProgressElement} */ (
  document.getElementById("plot-progress")
);
const axis = /** @type {HTMLDivElement} */ (document.getElementById("axis"));

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

const camera = new THREE.OrthographicCamera();
const renderer = new THREE.WebGLRenderer({ canvas: canvas });
renderer.setClearColor(new THREE.Color("white"));

const controls = new THREE.OrbitControls(camera, canvas);
controls.enableRotate = false;

const vertexShaderSource = `#version 300 es
in vec3 position;
in int selfHindex;
in int citedByHindex;

flat out int vSelfHindex;
flat out int vCitedByHindex;

void main() {
  gl_Position = vec4(position * 2.0, 1.0);
  vSelfHindex = selfHindex;
  vCitedByHindex = citedByHindex;
}
`;
const fragmentShaderSource = `#version 300 es
precision highp float;

flat in int vSelfHindex;
flat in int vCitedByHindex;

out vec4 fragmentColor;

uniform int highestHindex;
uniform int lowestHindex;
uniform float lineThickness;
uniform float lineAlpha;
uniform float lineSmoothness;
uniform float axisFontScale;
uniform vec2 viewport;

float hindexToClipSpace(int hindex) {
  return float(hindex - lowestHindex) / float(highestHindex - lowestHindex);
}

void main() {
  if (vSelfHindex == vCitedByHindex) discard;

  vec2 uv = gl_FragCoord.xy / viewport;
  vec3 color;
  float centerShift;
  if(vSelfHindex < vCitedByHindex) {
    centerShift = axisFontScale / 200.0;
    if (uv.y < 0.5 + centerShift) discard;
    color = vec3(0.0, 0.0, 1.0);
  } else {
    centerShift = -axisFontScale / 200.0;
    if (uv.y > 0.5 + centerShift) discard;
    color = vec3(1.0, 0.0, 0.0);
  }

  float selfHindexClipSpace = hindexToClipSpace(vSelfHindex);
  float citedByHindexClipSpace = hindexToClipSpace(vCitedByHindex);

  vec2 arcCenter = vec2(
    (selfHindexClipSpace + citedByHindexClipSpace) / 2.0,
    0.5 + centerShift
  );

  float arcRadius = abs(selfHindexClipSpace - citedByHindexClipSpace) / 2.0;
  float arcDistance = distance(arcCenter, uv);
  
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
}
`;

const instancedGeometry = new THREE.InstancedBufferGeometry().copy(
  new THREE.PlaneGeometry()
);
instancedGeometry.instanceCount = selfHindexList.length;

instancedGeometry.setAttribute(
  "selfHindex",
  new THREE.InstancedBufferAttribute(new Int32Array(selfHindexList), 1)
);
instancedGeometry.setAttribute(
  "citedByHindex",
  new THREE.InstancedBufferAttribute(new Int32Array(citedByHindexList), 1)
);

let axisDistance = 250;
let axisFontScale = 2;
const material = new THREE.RawShaderMaterial({
  uniforms: {
    viewport: { type: "2f", value: new THREE.Vector2(), controls: false },
    lowestHindex: { type: "i", value: lowestHindex, controls: false },
    highestHindex: { type: "i", value: highestHindex, controls: false },
    axisFontScale: { type: "f", value: axisFontScale },
    lineThickness: { type: "f", value: 0.001 },
    lineAlpha: { type: "f", value: 0.1 },
    lineSmoothness: { type: "f", value: 0.001 },
  },
  vertexShader: vertexShaderSource,
  fragmentShader: fragmentShaderSource,
  transparent: true,
  depthTest: false,
});

const mesh = new THREE.Mesh(instancedGeometry, material);

const scene = new THREE.Scene();
scene.add(mesh);
scene.add(camera);

function adaptAxisLabels() {
  axis.innerHTML = "";

  const labelCount = Math.ceil(canvas.width / axisDistance);
  for (let labelIndex = 0; labelIndex < labelCount; labelIndex++) {
    const labelSpan = document.createElement("span");
    const labelPosition = labelIndex * axisDistance;
    labelSpan.innerHTML =
      "<p>" +
      Math.round((labelPosition / canvas.width) * highestHindex) +
      "</p>";
    labelSpan.style.left = labelPosition + "px";
    labelSpan.style.fontSize = axisFontScale + "vh";
    axis.appendChild(labelSpan);
  }
}

function render() {
  console.log("render");
  renderer.render(scene, camera);
}

function adaptToWindowSize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  renderer.setSize(canvas.width, canvas.height);
  material.uniforms.viewport.value = new THREE.Vector2(
    canvas.width,
    canvas.height
  );
  adaptAxisLabels();
  requestAnimationFrame(render);
}
adaptToWindowSize();
window.addEventListener("resize", adaptToWindowSize);
controls.addEventListener("change", render);

const controlPanel = document.getElementById("control-panel");

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
});
