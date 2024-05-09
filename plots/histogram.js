/* global Chart */

const plotRenderingContext = document.getElementById("plot").getContext("2d");

const dataValues = [12, 19, 3, 5, 10];
const dataLabels = ["bla", 1, 2, 3, 4];

const myChart = new Chart(plotRenderingContext, {
  type: "bar",
  data: {
    labels: dataLabels,
    datasets: [
      {
        label: "",
        data: dataValues,
        backgroundColor: "rgba(255, 99, 132, 1)",
      },
    ],
  },
});
