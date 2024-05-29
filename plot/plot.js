/* global THREE */

const canvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("plot")
);
const progress = /** @type {HTMLProgressElement} */ (
  document.getElementById("plot-progress")
);
const axis = /** @type {HTMLDivElement} */ (document.getElementById("axis"));
const controlPanel = document.getElementById("control-panel");

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
in vec2 uv;
in uint selfHindex;
in uint citedByHindex;

out vec2 vUv;
out float arcDiameter;
flat out int upsideDown;

uniform uint highestHindex;
uniform uint lowestHindex;
uniform float axisFontScale;
uniform uint maxCitationDistance;
uniform uint minCitationDistance;

float hindexToClipSpace(uint hindex) {
  return float(hindex - lowestHindex) / float(highestHindex - lowestHindex);
}

void main() {
  uint citationDistance = uint(abs(float(selfHindex) - float(citedByHindex)));
  if (citationDistance <= maxCitationDistance && citationDistance >= minCitationDistance) {
  float selfHindexClipSpace = hindexToClipSpace(selfHindex);
  float citedByHindexClipSpace = hindexToClipSpace(citedByHindex);

  arcDiameter = abs(selfHindexClipSpace - citedByHindexClipSpace);
  float arcVerticalScale = arcDiameter * 2.0;

  vec2 arcPosition;
  if(selfHindex < citedByHindex) {
    arcPosition = vec2(
      selfHindexClipSpace,
      (position.y+0.5) * arcVerticalScale + axisFontScale / 100.0
    );
    upsideDown = 0;
  } else {
    arcPosition = vec2(
      citedByHindexClipSpace,
      (position.y-0.5) * arcVerticalScale - axisFontScale / 100.0
    );
    upsideDown = 1;
  }

  gl_Position = vec4(vec3(
    ((position.x + 0.5) * arcDiameter + arcPosition.x) * 2.0 - 1.0,
    arcPosition.y,
    position.z
  ), 1.0);

  vUv = uv;
  }
}
`;
const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 vUv;
in float arcDiameter;
flat in int upsideDown;

out vec4 fragmentColor;

uniform float lineThickness;
uniform float lineAlpha;
uniform float lineSmoothness;
uniform float axisFontScale;

void main() {
  vec2 arcCenter;
  vec3 arcColor;

  if(upsideDown == 1) {
    arcColor = vec3(1.0, 0.0, 0.0);
    arcCenter = vec2(0.5, 1.0);
  } else {
    arcColor = vec3(0.0, 0.0, 1.0);
    arcCenter = vec2(0.5, 0.0);
  }

  float arcDistance = distance(arcCenter, vUv);

  float arcAlpha = (1.0 - smoothstep(
    0.5 - lineSmoothness,
    0.5 + lineSmoothness,
    arcDistance - (lineThickness / 2.0) / arcDiameter
  )) * smoothstep(
    0.5 - lineSmoothness,
    0.5 + lineSmoothness,
    arcDistance + (lineThickness / 2.0) / arcDiameter
  );

  fragmentColor = vec4(arcColor, arcAlpha * lineAlpha);
}
`;

const instancedGeometry = new THREE.InstancedBufferGeometry().copy(
  new THREE.PlaneGeometry()
);
instancedGeometry.instanceCount = selfHindexList.length;

instancedGeometry.setAttribute(
  "selfHindex",
  new THREE.InstancedBufferAttribute(new Uint32Array(selfHindexList), 1)
);
instancedGeometry.setAttribute(
  "citedByHindex",
  new THREE.InstancedBufferAttribute(new Uint32Array(citedByHindexList), 1)
);

let axisDistance = 250;
let axisFontScale = 2;
const material = new THREE.RawShaderMaterial({
  uniforms: {
    viewport: { type: "2f", value: new THREE.Vector2(), controls: false },
    lowestHindex: { type: "ui", value: lowestHindex, controls: false },
    highestHindex: { type: "ui", value: highestHindex, controls: false },
    mousePosition: { type: "2f", value: new THREE.Vector2(), controls: false },
    aspect: { type: "f", value: 1, controls: false },
    axisFontScale: { type: "f", value: axisFontScale },
    lineThickness: { type: "f", value: 0.0015 },
    lineAlpha: { type: "f", value: 0.1 },
    lineSmoothness: { type: "f", value: 0.001 },
    maxCitationDistance: {
      type: "ui",
      value: highestHindex,
      min: 0,
      max: highestHindex,
      step: 1,
    },
    minCitationDistance: {
      type: "ui",
      value: 0,
      min: 0,
      max: highestHindex,
      step: 1,
    },
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
  renderer.render(scene, camera);
}

let scrollHeight;
function adaptToWindowSize() {
  scrollHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  renderer.setSize(canvas.width, canvas.height);
  material.uniforms.viewport.value = new THREE.Vector2(
    canvas.width,
    canvas.height
  );
  material.uniforms.aspect.value = canvas.width / canvas.height;

  adaptAxisLabels();
  requestAnimationFrame(render);
}
adaptToWindowSize();
window.addEventListener("resize", adaptToWindowSize);
controls.addEventListener("change", render);

Object.keys(material.uniforms).forEach((uniformKey) => {
  if (material.uniforms[uniformKey].controls == false) return;
  const value = material.uniforms[uniformKey].value;

  const minControl = material.uniforms[uniformKey].min;
  const maxControl = material.uniforms[uniformKey].max;
  const stepControl = material.uniforms[uniformKey].step;

  const inputElement = document.createElement("input");
  inputElement.id = uniformKey;
  inputElement.type = "range";
  inputElement.min = minControl != undefined ? minControl : value * 0.1;
  inputElement.max = maxControl != undefined ? maxControl : value * 1.9;
  inputElement.step = stepControl != undefined ? stepControl : value * 0.05;
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

    if (uniformKey == "axisDistance") {
      axisDistance = newValue;
      adaptAxisLabels();
    }
    if (uniformKey == "axisFontScale") {
      axisFontScale = newValue;
      adaptAxisLabels();
    }
    requestAnimationFrame(render);
  });
});

const stages = [
  {
    callback: (scroll) => {
      const kernelSize = Math.min(1 / scroll, 3);
      canvas.style.filter = "blur(" + kernelSize + "px) saturate(0%)";
    },
  },
  { callback: () => {} },
  {
    callback: (scroll) => {
      const saturation = Math.min(100, scroll * 200);
      canvas.style.filter = "saturate(" + saturation + "%)";
    },
  },
  {
    callback: (scroll) => {
      const factor = Math.min(1, scroll * 2);
      axis.style.opacity = factor;
      axisFontScale = factor * 2;
      material.uniforms.axisFontScale.value = axisFontScale;
      adaptAxisLabels();
      requestAnimationFrame(render);
    },
  },
  {
    callback: (scroll) => {
      let minCitationDistance = scroll * 125;
      material.uniforms.minCitationDistance.value = minCitationDistance;
      requestAnimationFrame(render);
    },
  },
  {
    callback: (scroll) => {
      let minCitationDistance = 125 - scroll * 125;
      if (scroll === 0) minCitationDistance = 0;
      material.uniforms.minCitationDistance.value = minCitationDistance;
      material.uniforms.maxCitationDistance.value =
        highestHindex - scroll * 195;
      requestAnimationFrame(render);
    },
  },
  {
    callback: (scroll) => {
      let maxCitationDistance = scroll * highestHindex;
      if (scroll === 0) maxCitationDistance = highestHindex;
      material.uniforms.maxCitationDistance.value = maxCitationDistance;
      requestAnimationFrame(render);
    },
  },
  {
    callback: (scroll) => {
      controlPanel.style.display = "flex";
      if (scroll === 0) controlPanel.style.display = "none";
      controlPanel.style.opacity = scroll;
    },
  },
];

function updateScrollEffect() {
  const relativeScrollY = window.scrollY / (scrollHeight - window.innerHeight);
  const currentStageIndex = Math.min(
    Math.floor(relativeScrollY * stages.length),
    stages.length - 1
  );
  const relativeStageScrollY =
    (relativeScrollY - currentStageIndex / stages.length) * stages.length;

  stages.forEach((_, stageIndex) => {
    let stageScroll = relativeStageScrollY;
    if (stageIndex < currentStageIndex) stageScroll = 1;
    if (stageIndex > currentStageIndex) stageScroll = 0;
    stages[stageIndex].callback(stageScroll);
  });
  stages[currentStageIndex].callback(relativeStageScrollY);
}
window.addEventListener("scroll", updateScrollEffect);
updateScrollEffect();

console.assert(
  stages.length == document.getElementById("scroll-content").children.length,
  "Stage definition length does not match HTML stage length."
);
