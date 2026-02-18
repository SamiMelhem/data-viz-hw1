// =============================================================================
// Hong Kong Monthly Temperature Matrix View
// Uses D3.js to render a matrix of year × month cells with color-encoded
// temperatures and embedded mini line charts for daily trends.
// =============================================================================

// ---------------------------------------------------------------------------
// 1. Constants & Configuration
// ---------------------------------------------------------------------------

/** Layout dimensions and margins for the SVG canvas */
const MARGIN = { top: 50, right: 120, bottom: 20, left: 90 };
const CELL_WIDTH = 100;
const CELL_HEIGHT = 70;
const YEARS_COUNT = 10;           // last 10 years in the dataset
const MONTHS_COUNT = 12;
const WIDTH = CELL_WIDTH * YEARS_COUNT + MARGIN.left + MARGIN.right;
const HEIGHT = CELL_HEIGHT * MONTHS_COUNT + MARGIN.top + MARGIN.bottom;

/** Month labels for the y-axis */
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/** Temperature range used for the colour scale (degrees Celsius) */
const TEMP_MIN = 0;
const TEMP_MAX = 40;

/** Tracks whether we are showing max or min temperature colours */
let showMax = true;

// ---------------------------------------------------------------------------
// 2. Data Loading & Processing
// ---------------------------------------------------------------------------

/**
 * Loads the CSV file, parses dates and numbers, filters to the last 10 years,
 * and groups the data by year-month for the matrix.
 * @returns {Promise<{nested: Map, years: Array}>} Nested map: year -> month -> daily records
 */
async function loadData() {
  // Used d3.csv() to load "temperature_daily.csv"
  //   - Parse each row: convert date string with d3.timeParse("%Y-%m-%d"),
  //     convert max_temperature and min_temperature to numbers
  //   - Extract all unique years, sort them, take the last YEARS_COUNT
  //   - Filter rows to only include those years
  //   - Group filtered data with d3.group() by year, then by month (0-11)
  //   - Return an object { nested, years }
  const data = await d3.csv("temperature_daily.csv", function(d) {
    return {
      date: d3.timeParse("%Y-%m-%d")(d.date),
      max: +d.max_temperature,
      min: +d.min_temperature,
    };
  });

  const allYears = [...new Set(data.map(d => d.date.getFullYear()))].sort();
  const years = allYears.slice(-YEARS_COUNT);
  const startYear = years[0];

  const filtered = data.filter(d => d.date.getFullYear() >= startYear);

  const nested = d3.group(filtered, d => d.date.getFullYear(), d => d.date.getMonth());

  return { nested, years };
}

/**
 * Computes summary statistics for one month's daily records.
 * @param {Array} days - Array of daily {date, max, min} objects
 * @returns {{ monthlyMax: number, monthlyMin: number, days: Array }}
 */
function summariseMonth(days) {
  // Computed and returned:
  //   - monthlyMax: the maximum of all daily max values (use d3.max)
  //   - monthlyMin: the minimum of all daily min values (use d3.min)
  //   - days: the input array sorted by date ascending using d3.sort
  return {
    monthlyMax: d3.max(days, d => d.max),
    monthlyMin: d3.min(days, d => d.min),
    days: days.sort((a, b) => a.date - b.date),
  };
}

// ---------------------------------------------------------------------------
// 3. Scales
// ---------------------------------------------------------------------------

/**
 * Builds the colour scale mapping temperature values to a warm palette.
 * Low temperatures map to cool yellows, high to deep reds.
 * @returns {d3.ScaleSequential}
 */
function buildColourScale() {
  // Created and returned a d3.scaleSequential()
  //   - Domain: [TEMP_MIN, TEMP_MAX]
  //   - Interpolator: d3.interpolateYlOrRd
  return d3.scaleSequential()
    .domain([TEMP_MIN, TEMP_MAX])
    .interpolator(d3.interpolateYlOrRd);
}

// ---------------------------------------------------------------------------
// 4. Drawing Functions
// ---------------------------------------------------------------------------

/**
 * Creates the root SVG element inside #chart and returns the main <g> group.
 * @returns {d3.Selection}
 */
function createSvg() {
  // Selected "#chart", appended an <svg> with WIDTH and HEIGHT,
  //   append a <g> translated to (MARGIN.left, MARGIN.top), return it
  return d3.select("#chart").append("svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .append("g")
    .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`);
}

/**
 * Draws the x-axis (years) across the top and the y-axis (months) on the left.
 * @param {d3.Selection} svg - The main <g> group
 * @param {Array} years - Array of year numbers
 * @returns {{ xScale: d3.ScaleBand, yScale: d3.ScaleBand }}
 */
function drawAxes(svg, years) {
  // Created xScale with d3.scaleBand()
  //   - domain: years array
  //   - range: [0, CELL_WIDTH * years.length]
  //   - padding: 0.05
  const xScale = d3.scaleBand()
    .domain(years)
    .range([0, CELL_WIDTH * years.length])
    .padding(0.05);

  // Created yScale with d3.scaleBand()
  //   - domain: d3.range(MONTHS_COUNT)  (i.e. [0,1,...,11])
  //   - range: [0, CELL_HEIGHT * MONTHS_COUNT]
  //   - padding: 0.05
  const yScale = d3.scaleBand()
    .domain(d3.range(MONTHS_COUNT))
    .range([0, CELL_HEIGHT * MONTHS_COUNT])
    .padding(0.05);

  // Appended a <g> with class "axis", called d3.axisTop(xScale) with tickSize(0),
  //   remove the domain line
  svg.append("g")
    .attr("class", "axis")
    .call(d3.axisTop(xScale).tickSize(0))
    .select(".domain").remove();

  // Appended a <g> with class "axis", called d3.axisLeft(yScale) with tickSize(0),
  //   used tickFormat to map index i -> MONTH_NAMES[i], removed domain line

  svg.append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(yScale)
        .tickSize(0)
        .tickFormat(i => MONTH_NAMES[i])
    )
    .select(".domain").remove();

  return { xScale, yScale };
}

/**
 * Draws the matrix cells (rectangles) coloured by temperature, and the mini
 * line charts inside each cell.
 * @param {d3.Selection} svg   - The main <g> group
 * @param {Map}  nested         - Nested data (year -> month -> days)
 * @param {Array} years         - Array of year numbers
 * @param {Object} scales       - { xScale, yScale }
 * @param {d3.ScaleSequential} colour - Temperature colour scale
 */
function drawCells(svg, nested, years, { xScale, yScale }, colour) {
  // Got a reference to the tooltip element: d3.select("#tooltip")
  const tooltip = d3.select("#tooltip");

  // Built a flat array "cells" by iterating over years and months (0-11).
  //   For each year/month combo, get the daily data from nested map,
  //   call summariseMonth() on it, and push { year, month, monthlyMax, monthlyMin, days }
  const cells = [];
  years.forEach(year => {
    d3.range(MONTHS_COUNT).forEach(month => {
      const monthData = nested.get(year)?.get(month);
      if (monthData) {
        const summary = summariseMonth([...monthData]);
        cells.push({ year, month, ...summary });
      }
    });
  });

  // Created cell groups using the data join pattern:
  //   svg.selectAll(".cell-group").data(cells).enter().append("g")
  //   Set class "cell-group" and translate each to (xScale(year), yScale(month))
  const cellGroups = svg.selectAll(".cell-group")
    .data(cells)
    .enter()
    .append("g")
    .attr("class", "cell-group")
    .attr("transform", d => `translate(${xScale(d.year)}, ${yScale(d.month)})`);

  // Appended a <rect> to each cell group:
  //   - class: "cell"
  //   - width: xScale.bandwidth(), height: yScale.bandwidth()
  //   - rx: 2 (rounded corners)
  //   - fill: use colour scale on monthlyMax or monthlyMin based on showMax
  cellGroups.append("rect")
    .attr("class", "cell")
    .attr("width", xScale.bandwidth())
    .attr("height", yScale.bandwidth())
    .attr("rx", 2)
    .attr("fill", d => colour(showMax ? d.monthlyMax : d.monthlyMin))
    .on("click", () => toggleMode(svg, cells, colour, xScale, yScale))
    .on("mouseover", (event, d) => {
      const label = showMax ? "Max" : "Min";
      const value = showMax ? d.monthlyMax : d.monthlyMin;
      tooltip.style("opacity", 1)
        .html(
          `<strong>${d.year}-${String(d.month + 1).padStart(2, "0")}</strong><br/>`
          + `${label}: ${value} °C`
        );
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  drawMiniCharts(cellGroups, xScale.bandwidth(), yScale.bandwidth());
}

/**
 * Renders small line charts (daily max & min) inside each cell group.
 * @param {d3.Selection} groups - Cell <g> groups bound to cell data
 * @param {number} w - Cell width
 * @param {number} h - Cell height
 */
function drawMiniCharts(groups, w, h) {
  const padding = 4;

  // Iterated over each cell using groups.each(function(d) { ... })
  //   Inside each cell:
  //   - Create xMini: d3.scaleLinear(), domain [0, days.length-1], range [padding, w-padding]
  //   - Create yMini: d3.scaleLinear(), domain [TEMP_MIN, TEMP_MAX], range [h-padding, padding]
  //   - Create lineMax generator with d3.line(): x maps day index, y maps day.max
  //     Use d3.curveMonotoneX for smooth curves
  //   - Create lineMin generator similarly for day.min
  //   - Append a <path> with class "line-min", datum(days), attr "d" = lineMin
  //   - Append a <path> with class "line-max", datum(days), attr "d" = lineMax
  groups.each(function(d) {
    const g = d3.select(this);
    const days = d.days;
    if (!days || days.length === 0) return;
    const xMini = d3.scaleLinear()
      .domain([0, days.length - 1])
      .range([padding, w - padding]);
    const yMini = d3.scaleLinear()
      .domain([TEMP_MIN, TEMP_MAX])
      .range([h - padding, padding]);
    const lineMax = d3.line()
      .x((_, i) => xMini(i))
      .y((day) => yMini(day.max))
      .curve(d3.curveMonotoneX);
    const lineMin = d3.line()
      .x((_, i) => xMini(i))
      .y((day) => yMini(day.min))
      .curve(d3.curveMonotoneX);
    g.append("path")
      .datum(days)
      .attr("class", "line-min")
      .attr("d", lineMin);
    g.append("path")
      .datum(days)
      .attr("class", "line-max")
      .attr("d", lineMax);
  });
}

/**
 * Draws a vertical colour-scale legend on the right side of the matrix.
 * @param {d3.Selection} svg    - The main <g> group
 * @param {d3.ScaleSequential} colour - Temperature colour scale
 * @param {Array} years         - Year array (used to compute x position)
 */
function drawLegend(svg, colour, years) {
  // Calculated legend position and size:
  //   legendHeight = CELL_HEIGHT * MONTHS_COUNT, legendWidth = 18
  //   x = CELL_WIDTH * years.length + 30
  const legendHeight = CELL_HEIGHT * MONTHS_COUNT;
  const legendWidth = 18;
  const x = CELL_WIDTH * years.length + 30;

  // Created a <linearGradient> in <defs> with id "temp-gradient"
  //   (vertical: x1=0% y1=0% x2=0% y2=100%)
  //   Add ~10 <stop> elements sampling the colour scale from TEMP_MIN to TEMP_MAX
  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", "temp-gradient")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "0%").attr("y2", "100%");
  
  // Appended a <rect> at position (x, 0) filled with "url(#temp-gradient)"
  const steps = 10;
  d3.range(steps + 1).forEach((i) => {
    const t = i / steps;
    gradient.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", colour(TEMP_MIN + (TEMP_MAX - TEMP_MIN) * t));
  });

  // Appended two <text> labels with class "legend-label":
  //   - Top label at y=10: "0 °C"
  //   - Bottom label at y=legendHeight: "40 °C"
  svg.append("rect")
    .attr("x", x).attr("y", 0)
    .attr("width", legendWidth).attr("height", legendHeight)
    .attr("rx", 3).style("fill", `url(#temp-gradient)`);
  svg.append("text")
    .attr("class", "legend-label")
    .attr("x", x + legendWidth + 5).attr("y", 10)
    .text(`${TEMP_MIN} °C`);
  svg.append("text")
    .attr("class", "legend-label")
    .attr("x", x + legendWidth + 5).attr("y", legendHeight)
    .text(`${TEMP_MAX} °C`);
}

// ---------------------------------------------------------------------------
// 5. Interaction
// ---------------------------------------------------------------------------

/**
 * Toggles between showing maximum and minimum monthly temperatures.
 * Smoothly transitions cell background colours and updates the header label.
 * @param {d3.Selection} svg   - Main <g> group
 * @param {Array} cells         - Flat cell data array
 * @param {d3.ScaleSequential} colour - Temperature colour scale
 */
function toggleMode(svg, cells, colour) {
  // Flipped the showMax boolean
  showMax = !showMax;

  // Updated the #mode-label <strong> text to "Maximum" or "Minimum"
  d3.select("#mode-label strong").text(showMax ? "Maximum" : "Minimum");

  // Selected all ".cell" rects, applied a transition (duration ~400ms),
  //   update fill colour based on the new showMax value
  svg.selectAll(".cell")
    .transition().duration(400)
    .attr("fill", d => colour(showMax ? d.monthlyMax : d.monthlyMin));
}

// ---------------------------------------------------------------------------
// 6. Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Orchestrates data loading, scale creation, and all drawing steps.
 */
async function main() {
  const { nested, years } = await loadData();
  const colour = buildColourScale();
  const svg = createSvg();
  const scales = drawAxes(svg, years);
  drawCells(svg, nested, years, scales, colour);
  drawLegend(svg, colour, years);
}

// Kick off the visualisation
main();
