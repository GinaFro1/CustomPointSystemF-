const currentYear = new Date().getFullYear();
const teamColors = {
  "Red Bull": "#3671C6",
  "Ferrari": "#E8002D",
  "Mercedes": "#00D2BE",
  "McLaren": "#FF8700",
  "Aston Martin": "#006F62",
  "Alpine F1 Team": "#0090FF",
  "Williams": "#005AFF",
  "RB F1 Team": "#6692FF",
  "Haas F1 Team": "#B6BABD",
  "Sauber": "#52E252",
  "default": "#888"
};

// Official race & sprint systems
const officialPoints = {1:25,2:18,3:15,4:12,5:10,6:8,7:6,8:4,9:2,10:1};
const officialSprintPoints = {1:8,2:7,3:6,4:5,5:4,6:3,7:2,8:1};

// Custom systems (defaults to official)
let customPointsMap = { ...officialPoints };
let customSprintMap = { ...officialSprintPoints };

const sel = document.getElementById('yearSelect');
for (let y = currentYear; y >= 1950; y--) {
  const opt = document.createElement('option');
  opt.value = y;
  opt.textContent = y;
  sel.appendChild(opt);
}

let allRaces = [];
let maxPosition = 20;
let pointsChart;

async function fetchAllResults(year) {
  let racesByRound = {};
  let offset = 0, limit = 100;

  while (true) {
    const url = `https://api.jolpi.ca/ergast/f1/${year}/results.json?limit=${limit}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Network error");
    const data = await res.json();
    const races = data.MRData.RaceTable.Races;
    if (races.length === 0) break;

    for (const race of races) {
      const round = race.round;
      if (!racesByRound[round]) {
        racesByRound[round] = { ...race, Results: [...race.Results] };
      } else {
        racesByRound[round].Results.push(...race.Results);
      }
    }
    offset += limit;
  }

  for (const race of Object.values(racesByRound)) {
    // Qualifying
    try {
      const qRes = await fetch(`https://api.jolpi.ca/ergast/f1/${year}/${race.round}/qualifying.json`);
      const qData = await qRes.json();
      race.Qualifying = qData.MRData.RaceTable.Races[0]?.QualifyingResults || [];
    } catch {
      race.Qualifying = [];
    }
    // Sprint
    try {
      const sprintRes = await fetch(`https://api.jolpi.ca/ergast/f1/${year}/${race.round}/sprint.json`);
      const sprintData = await sprintRes.json();
      race.SprintResults = sprintData.MRData.RaceTable.Races[0]?.SprintResults || [];
    } catch {
      race.SprintResults = [];
    }
  }

  return Object.values(racesByRound).sort((a,b)=>parseInt(a.round)-parseInt(b.round));
}

async function loadSeason(year) {
  document.getElementById('results').innerHTML = "<p>Loading...</p>";
  try {
    allRaces = await fetchAllResults(year);
    maxPosition = Math.max(...allRaces.map(r => r.Results.length));
    populatePositionSelector();
    renderResults(allRaces);
    updateAll(); 
  } catch (err) {
    document.getElementById('results').textContent = 'Error: ' + err.message;
  }
}

function populatePositionSelector() {
  const sel = document.getElementById("positionSelect");
  sel.innerHTML = "";
  for (let i = 1; i <= maxPosition; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `P${i}`;
    sel.appendChild(opt);
  }
  // Defaults when first opening
  document.getElementById("positionPoints").value = customPointsMap[1] || "";
  document.getElementById("sprintPoints").value = customSprintMap[1] || "";
}

// Listeners
document.getElementById("positionPoints").addEventListener("input", e => {
  const pos = document.getElementById("positionSelect").value;
  const pts = parseInt(e.target.value) || 0;
  customPointsMap[pos] = pts;
  document.getElementById("pointsMessage").textContent =
    `Race points of Position P${pos} changed to ${pts}`;
  updateAll();
});
document.getElementById("sprintPoints").addEventListener("input", e => {
  const pos = document.getElementById("positionSelect").value;
  const pts = parseInt(e.target.value) || 0;
  customSprintMap[pos] = pts;
  document.getElementById("pointsMessage").textContent =
    `Sprint points of Position P${pos} changed to ${pts}`;
  updateAll();
});
document.getElementById("positionSelect").addEventListener("change", e => {
  const pos = e.target.value;
  document.getElementById("positionPoints").value = customPointsMap[pos] ?? "";
  document.getElementById("sprintPoints").value = customSprintMap[pos] ?? "";
});
document.getElementById("polePoints").addEventListener("input", updateAll);
document.getElementById("flPoints").addEventListener("input", updateAll);

function renderResults(races) {
  const container = document.getElementById('results');
  container.innerHTML = races.map(r => {
    let sprintCard = "";
    if (r.SprintResults && r.SprintResults.length > 0) {
      sprintCard = `
        <div class="race sprint">
          <h2>Sprint – ${r.raceName} <br><small>${r.date}</small></h2>
          <div class="driver-scroll">
            ${r.SprintResults.map(res => renderTile(res, r, true)).join('')}
          </div>
        </div>
      `;
    }

    let raceCard = `
      <div class="race">
        <h2>${r.raceName} <br><small>${r.date}</small></h2>
        <div class="driver-scroll">
          ${r.Results.map(res => renderTile(res, r, false)).join('')}
        </div>
      </div>
    `;

    return sprintCard + raceCard;
  }).join('');
}


function renderTile(res, race, isSprint) {
  const teamColor = teamColors[res.Constructor.name] || teamColors.default;
  const pos = parseInt(res.position);
  const driver = `${res.Driver.givenName} ${res.Driver.familyName}`;
  const team = res.Constructor.name;

  let earned = isSprint ? (customSprintMap[pos] || 0) : (customPointsMap[pos] || 0);

  if (!isSprint) {
    if (res.FastestLap) earned += parseInt(document.getElementById("flPoints").value) || 0;
    if (race.Qualifying && race.Qualifying.find(q =>
        q.position === "1" &&
        `${q.Driver.givenName} ${q.Driver.familyName}` === driver)) {
      earned += parseInt(document.getElementById("polePoints").value) || 0;
    }
  }

  return `
    <div class="driver-tile ${isSprint ? 'sprint-tile' : ''}" style="border-left: 5px solid ${teamColor}">
      <div class="driver-pos">P${res.position}</div>
      <div class="driver-name">${driver}</div>
      <div class="driver-team">${team}</div>
      <div class="driver-extra">${earned} pts</div>
    </div>
  `;
}


function recalculateStandings() {
  const driverPointsCustom = {};
  const driverPointsOfficial = {};
  const teamPointsCustom = {};
  const teamPointsOfficial = {};

  const polePts = parseInt(document.getElementById('polePoints').value) || 0;
  const flPts = parseInt(document.getElementById('flPoints').value) || 0;

  for (const race of allRaces) {
    // Main race
    for (const res of race.Results) {
      const pos = parseInt(res.position);
      const driver = `${res.Driver.givenName} ${res.Driver.familyName}`;
      const team = res.Constructor.name;

      let earned = customPointsMap[pos] || 0;
      if (res.FastestLap) earned += flPts;
      if (race.Qualifying && race.Qualifying.find(q =>
          q.position === "1" &&
          `${q.Driver.givenName} ${q.Driver.familyName}` === driver)) {
        earned += polePts;
      }
      driverPointsCustom[driver] = (driverPointsCustom[driver]||0) + earned;
      teamPointsCustom[team] = (teamPointsCustom[team]||0) + earned;

      const offPts = officialPoints[pos] || 0;
      driverPointsOfficial[driver] = (driverPointsOfficial[driver]||0) + offPts;
      teamPointsOfficial[team] = (teamPointsOfficial[team]||0) + offPts;
    }

    // Sprint
    if (race.SprintResults && race.SprintResults.length) {
      for (const res of race.SprintResults) {
        const pos = parseInt(res.position);
        const driver = `${res.Driver.givenName} ${res.Driver.familyName}`;
        const team = res.Constructor.name;

        const earned = customSprintMap[pos] || 0;
        driverPointsCustom[driver] = (driverPointsCustom[driver]||0) + earned;
        teamPointsCustom[team] = (teamPointsCustom[team]||0) + earned;

        const offPts = officialSprintPoints[pos] || 0;
        driverPointsOfficial[driver] = (driverPointsOfficial[driver]||0) + offPts;
        teamPointsOfficial[team] = (teamPointsOfficial[team]||0) + offPts;
      }
    }
  }

  renderStandingsTable('driverStandingsCustom', driverPointsCustom);
  renderStandingsTable('driverStandingsOfficial', driverPointsOfficial);
  renderStandingsTable('teamStandingsCustom', teamPointsCustom);
  renderStandingsTable('teamStandingsOfficial', teamPointsOfficial);

  return driverPointsCustom; 
}

function renderStandingsTable(id, pointsObj) {
  const container = document.getElementById(id);
  const entries = Object.entries(pointsObj).sort((a,b)=>b[1]-a[1]);
  container.innerHTML = `
    <div class="standing-scroll">
      ${entries.map((e,i)=>{
        const color = teamColors[e[0]] || teamColors.default;
        return `
          <div class="standing-tile" style="border-left: 5px solid ${color}">
            <div class="pos">#${i+1}</div>
            <div class="name">${e[0]}</div>
            <div class="points">${e[1]} pts</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Chart
let driverProgression = {};
function buildDriverProgression() {
  driverProgression = {};
  const races = allRaces;
  const totals = {};

  for (let i=0;i<races.length;i++) {
    const race = races[i];

    // Race
    for (const res of race.Results) {
      const driver = `${res.Driver.givenName} ${res.Driver.familyName}`;
      const team = res.Constructor.name;
      if (!(driver in driverProgression)) {
        driverProgression[driver] = [];
        totals[driver] = 0;
      }
      let earned = customPointsMap[parseInt(res.position)] || 0;
      if (res.FastestLap) earned += parseInt(document.getElementById("flPoints").value) || 0;
      if (race.Qualifying && race.Qualifying.find(q => q.position === "1" &&
          `${q.Driver.givenName} ${q.Driver.familyName}` === driver)) {
        earned += parseInt(document.getElementById("polePoints").value) || 0;
      }
      totals[driver] += earned;
    }

    // Sprint
    if (race.SprintResults && race.SprintResults.length) {
      for (const res of race.SprintResults) {
        const driver = `${res.Driver.givenName} ${res.Driver.familyName}`;
        if (!(driver in driverProgression)) {
          driverProgression[driver] = [];
          totals[driver] = 0;
        }
        totals[driver] += customSprintMap[parseInt(res.position)] || 0;
      }
    }

    for (const d in driverProgression) {
      driverProgression[d].push(totals[d] || 0);
    }
  }
}

function renderChart() {
  const ctx = document.getElementById("pointsChart").getContext("2d");
  if (pointsChart) pointsChart.destroy();

  const datasets = Object.keys(driverProgression).map(driver => {
    let teamName = "default";
    for (const race of allRaces) {
      const match = race.Results.find(r => `${r.Driver.givenName} ${r.Driver.familyName}` === driver);
      if (match) { teamName = match.Constructor.name; break; }
    }
    const color = teamColors[teamName] || teamColors.default;
    return {
      label: driver,
      data: driverProgression[driver],
      borderColor: color,
      fill: false,
      tension: 0.2,
      borderWidth: 2
    };
  });

  pointsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: allRaces.map(r => r.raceName),
      datasets
    },
    options: {
      plugins: { legend: { labels: { color: "white" } } },
      scales: {
        x: {
          ticks: { color: "white" },
          grid: { color: "rgba(255,255,255,0.2)", lineWidth: 1, drawTicks: false }
        },
        y: {
          ticks: { color: "white" },
          grid: { color: "rgba(255,255,255,0.2)" }
        }
      }
    }
  });

  updateDriverSelectors(Object.keys(driverProgression));
}

function updateDriverSelectors(drivers) {
  const d1Sel = document.getElementById("driver1Select");
  const d2Sel = document.getElementById("driver2Select");
  d1Sel.innerHTML = ""; d2Sel.innerHTML = "";
  drivers.forEach(d => {
    const opt1 = document.createElement("option");
    opt1.value = d; opt1.textContent = d;
    const opt2 = opt1.cloneNode(true);
    d1Sel.appendChild(opt1); d2Sel.appendChild(opt2);
  });
}

function focusDriver() {
  const d1 = document.getElementById("driver1Select").value;
  const d2 = document.getElementById("driver2Select").value;
  pointsChart.data.datasets.forEach(ds => {
    if (ds.label === d1) { ds.hidden = false; ds.borderDash = []; }
    else if (ds.label === d2) { ds.hidden = false; ds.borderDash = [5,5]; }
    else ds.hidden = true;
  });
  pointsChart.update();
}
function resetFocus() {
  pointsChart.data.datasets.forEach(ds => { ds.hidden = false; ds.borderDash = []; });
  pointsChart.update();
}

function updateAll() {
  recalculateStandings();
  try {
    buildDriverProgression();
    renderChart();
  } catch(e) { console.warn("Chart skipped:", e); }
}

sel.addEventListener('change', () => loadSeason(sel.value));
sel.value = currentYear;
loadSeason(currentYear);
