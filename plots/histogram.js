/* global d3 */

const container = document.getElementById("plot");

const downCite = [];
const upCite = [];

hindices.forEach((dataPoint) => {
  dataPoint.self.forEach((selfHindex) => {
    dataPoint.citedBy.forEach((citedByHindex) => {
      if (selfHindex < citedByHindex) {
        downCite.push(citedByHindex);
      } else if (selfHindex > citedByHindex) {
        upCite.push(citedByHindex);
      }
    });
  });
});

const allHindices = hindices.flatMap((obj) => [...obj.self, ...obj.citedBy]);
const highestHindex = Math.max(...allHindices);
const lowestHindex = Math.min(...allHindices);

const width = window.innerWidth;
const height = window.innerHeight / 2;
const margin = 50;

function drawHistogram(data, color) {
  // Bin the data.
  const bins = d3
    .bin()
    .thresholds(40)
    .value((d) => d)(data);

  // Declare the x (horizontal position) scale.
  const x = d3
    .scaleLinear()
    .domain([0, highestHindex])
    .range([margin, width - margin]);

  // Declare the y (vertical position) scale.
  const y = d3
    .scaleLinear()
    .domain([0, 200])
    .range([height - margin, margin]);

  // Create the SVG container.
  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height]);

  // Add a rect for each bin.
  svg
    .append("g")
    .attr("fill", color)
    .selectAll()
    .data(bins)

    .join("rect")
    .attr("x", (d) => x(d.x0) + 1)
    .attr("width", (d) => x(d.x1) - x(d.x0) - 1)
    .attr("y", (d) => y(d.length))
    .attr("height", (d) => y(0) - y(d.length));

  // Add the x-axis and label.
  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(width / 80)
        .tickSizeOuter(0)
    )
    .call((g) =>
      g
        .append("text")
        .attr("x", width)
        .attr("y", margin - 4)
        .attr("fill", "margin")
        .attr("text-anchor", "end")
        .text("h-index →")
    );

  // Add the y-axis and label, and remove the domain line.
  svg
    .append("g")
    .attr("transform", `translate(${margin},0)`)
    .call(d3.axisLeft(y).ticks(height / 40))
    .call((g) =>
      g
        .append("text")
        .attr("x", -margin)
        .attr("y", 10)
        .attr("fill", "currentColor")
        .attr("text-anchor", "start")
        .text("↑ Frequency")
    );

  container.append(svg.node());
}

drawHistogram(downCite, "blue");
drawHistogram(upCite, "red");
