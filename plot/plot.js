/* global THREE */

const canvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("plot")
);
const progress = document.getElementById("plot-progress");

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
//cameraControls.enableRotate = false;

const vertexShaderSource = `#version 300 es
in vec3 position;
in vec2 uv;
in float selfHindex;
in float citedByHindex;

out vec2 vUv;
out float vSelfHindex;
out float vCitedByHindex;

void main() {
  gl_Position = vec4(position * 2.0, 1.0);

  vUv = uv;
  vSelfHindex = selfHindex;
  vCitedByHindex = citedByHindex;
}
`;
const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 vUv;
in float vSelfHindex;
in float vCitedByHindex;

out vec4 fragmentColor;

uniform int highestHindex;
uniform int lowestHindex;
uniform float lineThickness;
uniform float lineAlpha;
uniform float lineSmoothness;

float hindexToScreenSpace(float hindex) {
  return (hindex - float(lowestHindex)) / float(highestHindex - lowestHindex);
}

void main() {
  if (vSelfHindex == vCitedByHindex) discard;

  vec3 color;
  if(vSelfHindex < vCitedByHindex) {
    if (vUv.y < 0.5) discard;
    color = vec3(0.0, 0.0, 1.0);
  } else {
    if (vUv.y > 0.5) discard;
    color = vec3(1.0, 0.0, 0.0);
  }

  float selfHindexScreenSpace = hindexToScreenSpace(vSelfHindex);
  float citedByHindexScreenSpace = hindexToScreenSpace(vCitedByHindex);

  vec2 arcCenter = vec2(
    (selfHindexScreenSpace + citedByHindexScreenSpace) / 2.0, 0.5
  );

  float arcRadius = abs(selfHindexScreenSpace - citedByHindexScreenSpace) / 2.0;
  float arcDistance = distance(arcCenter, vUv);
  
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
  new THREE.PlaneBufferGeometry()
);
instancedGeometry.instanceCount = selfHindexList.length;

instancedGeometry.setAttribute(
  "selfHindex",
  new THREE.InstancedBufferAttribute(new Float32Array(selfHindexList), 1)
);
instancedGeometry.setAttribute(
  "citedByHindex",
  new THREE.InstancedBufferAttribute(new Float32Array(citedByHindexList), 1)
);

const material = new THREE.RawShaderMaterial({
  uniforms: {
    lowestHindex: { type: "i", value: lowestHindex },
    highestHindex: { type: "i", value: highestHindex },
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

function render() {
  console.log("render");
  renderer.render(scene, camera);
}

function adaptToWindowSize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  renderer.setSize(canvas.width, canvas.height);
  requestAnimationFrame(render);
}
adaptToWindowSize();
window.addEventListener("resize", adaptToWindowSize);
controls.addEventListener("change", render);

const controlPanel = document.getElementById("control-panel");

Object.keys(material.uniforms).forEach((uniformKey) => {
  if (material.uniforms[uniformKey].type != "f") return;

  const value = material.uniforms[uniformKey].value;

  const inputElement = document.createElement("input");
  inputElement.id = uniformKey;
  inputElement.type = "range";
  inputElement.min = value * 0.1;
  inputElement.max = value * 1.9;
  inputElement.step = value * 0.05;
  inputElement.value = value;

  inputElement.addEventListener("input", (event) => {
    material.uniforms[uniformKey].value = event.target.value;
    requestAnimationFrame(render);
  });

  controlPanel.append(inputElement);

  const inputLabel = document.createElement("label");
  inputLabel.for = uniformKey;
  inputLabel.innerText = uniformKey;
  controlPanel.append(inputLabel);
});
