let connected = false, demoActive = false;
let pollTimer = null, demoTimer = null;

/* ─── ULTIMATE STATE ─── */
let settings = JSON.parse(localStorage.getItem('co2_settings')) || {
  threshold: 1000,
  audioAlert: false,
  retention: true
};

const sessionStats = {
  maxCO2: 0,
  minCO2: Infinity,
  tempSum: 0,
  tempCount: 0
};

/* ─── ANIMATION & CHART STATE ─── */
const targetData = { temperature: 23, humidity: 55, eco2: 0, tvoc: 0 };
const currentData = { temperature: 23, humidity: 55, eco2: 0, tvoc: 0 };
const lerp = (start, end, factor) => start + (end - start) * factor;

const MAX_CHART_POINTS = 30;
const charts = { co2: null, temp: null, hum: null, tvoc: null };
const chartHistory = { co2: [], temp: [], hum: [], tvoc: [], labels: [] };

/* ─── API CONFIG ─── */
const FLASK_API_BASE_URL = 'http://127.0.0.1:5000/api/data';

/* ─── Chart Initialization ─── */
function initCharts() {
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1500, easing: 'easeInOutQuart' },
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: {
        grid: { color: 'rgba(229, 231, 235, 0.5)', drawBorder: false },
        ticks: { color: '#94a3b8', font: { size: 10, weight: '600' } }
      }
    },
    elements: {
      line: { tension: 0.4, borderWidth: 3, fill: true },
      point: { radius: 0 }
    }
  };

  const createChart = (id, label, color, min, max) => {
    const ctx = document.getElementById(id).getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, `${color}33`);
    gradient.addColorStop(1, `${color}00`);

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartHistory.labels,
        datasets: [{
          label: label,
          data: chartHistory[id.replace('chart-', '')],
          borderColor: color,
          backgroundColor: gradient
        }]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            suggestedMin: min,
            suggestedMax: max
          }
        }
      }
    });
  };

  charts.co2 = createChart('chart-co2', 'CO2', '#486730', 400, 1000);
  charts.temp = createChart('chart-temp', 'Temp', '#f59e0b', 15, 35);
  charts.hum = createChart('chart-hum', 'Humidity', '#3b82f6', 20, 80);
  charts.tvoc = createChart('chart-tvoc', 'TVOC', '#8b5cf6', 0, 500);
}

/* ─── Clock ─── */
function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-GB');
}
setInterval(updateClock, 1000); updateClock();

/* ─── Logging ─── */
function log(msg) {
  const logEl = document.getElementById('log-text');
  if (logEl) logEl.textContent = `[${new Date().toLocaleTimeString('en-GB')}] ${msg}`;
}

/* ─── Status ─── */
function setStatus(state, text) {
  const dot = document.getElementById('status-dot');
  dot.classList.remove('connected', 'demo', 'error');
  if (state) dot.classList.add(state);
  document.getElementById('status-text').textContent = text;
}

/* ─── Math/Formulas ─── */
function heatIndex(T, RH) {
  const c = [-8.78469475556, 1.61139411, 2.33854883889, -0.14611605,
  -0.01230809529, -0.01642482778, 0.00221732167, 0.00072546, -0.00000358582];
  const hi = c[0] + c[1] * T + c[2] * RH + c[3] * T * RH + c[4] * T * T + c[5] * RH * RH
    + c[6] * T * T * RH + c[7] * T * RH * RH + c[8] * T * T * RH * RH;
  return hi.toFixed(1);
}

function airQuality(ppm) {
  if (ppm < 600) return { label: 'EXCELLENT', color: '#486730', msg: 'The air is crystal clear and healthy.' };
  if (ppm < 800) return { label: 'GOOD', color: '#10b981', msg: 'Good air quality. Perfect for concentration.' };
  if (ppm < 1000) return { label: 'MODERATE', color: '#f59e0b', msg: 'Ventilation recommended soon.' };
  if (ppm < 1200) return { label: 'POOR', color: '#f97316', msg: 'Poor quality. Open a window now.' };
  return { label: 'HAZARDOUS', color: '#ef4444', msg: 'Hazardous air. Leave the room or ventilate.' };
}

/* ─── Main Animation Loop (60FPS) ─── */
function animate() {
  currentData.temperature = lerp(currentData.temperature, targetData.temperature, 0.08);
  currentData.humidity = lerp(currentData.humidity, targetData.humidity, 0.08);
  currentData.eco2 = lerp(currentData.eco2, targetData.eco2, 0.08);
  currentData.tvoc = lerp(currentData.tvoc, targetData.tvoc, 0.08);

  const co2El = document.getElementById('co2-value');
  const tempEl = document.getElementById('temp-value');
  const humEl = document.getElementById('hum-value');
  const hiEl = document.getElementById('hi-value');
  const tvocEl = document.getElementById('tvoc-value');

  if (co2El) co2El.textContent = Math.round(currentData.eco2);
  if (tempEl) tempEl.textContent = currentData.temperature.toFixed(1);
  if (humEl) humEl.textContent = currentData.humidity.toFixed(1);
  if (hiEl) hiEl.textContent = heatIndex(currentData.temperature, currentData.humidity);
  if (tvocEl) tvocEl.textContent = Math.round(currentData.tvoc);

  requestAnimationFrame(animate);
}
animate();

/* ─── Simulation ─── */
let demoT = 23, demoH = 55;
function toggleDemo() {
  if (demoActive) { stopDemo(); } else { if (connected) stopConnection(); startDemo(); }
}
function startDemo() {
  demoActive = true;
  document.getElementById('btn-demo').classList.add('active');
  setStatus('demo', 'Demo mode enabled');
  log('Simulating environment...');
  runDemo();
}
function stopDemo() {
  demoActive = false; clearTimeout(demoTimer);
  document.getElementById('btn-demo').classList.remove('active');
  setStatus('', 'Disconnected');
}
function runDemo() {
  if (!demoActive) return;
  demoT += (Math.random() - 0.49) * 0.4;
  demoH += (Math.random() - 0.49) * 0.8;
  let simCO2 = Math.round(400 + Math.random() * 50 + (demoT - 21) * 10 + (demoH - 50) * 5);
  let simTVOC = Math.round(Math.max(0, (simCO2 - 400) * 0.3 + Math.random() * 20));
  updateUI({ temperature: demoT, humidity: demoH, eco2: simCO2, tvoc: simTVOC });
  demoTimer = setTimeout(runDemo, 2000);
}

/* ─── API Connection ─── */
function toggleConnect() {
  if (connected) { stopConnection(); } else { if (demoActive) stopDemo(); startConnection(); }
}
function startConnection() {
  const ip = document.getElementById('ip-input').value.trim();
  if (!ip) { log('Enter IP first'); return; }
  document.getElementById('btn-connect').classList.add('active');
  document.getElementById('btn-connect').textContent = 'STOP';
  const url = `${FLASK_API_BASE_URL}?ip=${ip}`;
  log(`Connecting to AirSense node at ${ip}...`);
  async function poll() {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error('Network ' + res.status);
      const data = await res.json();
      if (!connected) { connected = true; setStatus('connected', 'Live Telemetry'); }
      updateUI(data);
    } catch (err) {
      setStatus('error', 'Node unreachable');
      log(`Error: ${err.message}`);
    }
  }
  poll();
  pollTimer = setInterval(poll, 2000);
}
function stopConnection() {
  connected = false;
  if (pollTimer) clearInterval(pollTimer);
  document.getElementById('btn-connect').classList.remove('active');
  document.getElementById('btn-connect').textContent = 'CONNECT';
  setStatus('', 'Disconnected');
}

/* ─── Reactive Particle Engine ─── */
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let targetColor = { r: 203, g: 213, b: 225 }; // Default Slate Gray
let currentColor = { r: 203, g: 213, b: 225 };

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

class Particle {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.size = Math.random() * 3 + 1.5;
    this.alpha = Math.random() * 0.4 + 0.2;
  }
  update() {
    this.x += this.vx * (1 + currentData.eco2 / 1000);
    this.y += this.vy * (1 + currentData.eco2 / 1000);
    if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
      if (Math.random() > 0.98) this.reset();
    }
  }
  draw() {
    ctx.fillStyle = `rgba(${Math.round(currentColor.r)}, ${Math.round(currentColor.g)}, ${Math.round(currentColor.b)}, ${this.alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

for (let i = 0; i < 60; i++) particles.push(new Particle());

function renderParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  currentColor.r = lerp(currentColor.r, targetColor.r, 0.05);
  currentColor.g = lerp(currentColor.g, targetColor.g, 0.05);
  currentColor.b = lerp(currentColor.b, targetColor.b, 0.05);

  particles.forEach(p => {
    p.update();
    p.draw();
  });
  requestAnimationFrame(renderParticles);
}
renderParticles();

/* ─── Update UI Metrics & Charts ─── */
function updateUI(data) {
  const { temperature: T, humidity: H, eco2, tvoc } = data;

  // Update Color Targets
  const aq = airQuality(isNaN(eco2) ? 0 : Number(eco2));
  if (!connected && !demoActive) {
    targetColor = { r: 203, g: 213, b: 225 }; // Gray
  } else {
    // Map status to colors
    if (aq.label === 'EXCELLENT') targetColor = { r: 72, g: 103, b: 48 }; // Sage
    else if (aq.label === 'GOOD') targetColor = { r: 59, g: 130, b: 246 }; // Blue
    else if (aq.label === 'HAZARDOUS') targetColor = { r: 239, g: 68, b: 68 }; // Red
    else targetColor = { r: 245, g: 158, b: 11 }; // Amber for Moderate/Poor
  }

  // Update Status Description
  const statusSummaryEl = document.getElementById('status-summary');
  const aqTextEl = document.getElementById('aq-text');
  const aqBadgeEl = document.getElementById('aq-badge');
  const aqDotEl = document.getElementById('aq-dot');

  if (statusSummaryEl) statusSummaryEl.textContent = aq.msg;
  if (aqTextEl) aqTextEl.textContent = aq.label;
  if (aqBadgeEl) aqBadgeEl.style.color = aq.color;
  if (aqBadgeEl) aqBadgeEl.style.color = aq.color;
  if (aqDotEl) aqDotEl.style.backgroundColor = aq.color;

  // Set targets for animation & sanitize data
  const co2_val = isNaN(eco2) ? 0 : Number(eco2);
  const tvoc_val = isNaN(tvoc) ? 0 : Number(tvoc);
  const temp_val = isNaN(T) ? 23 : Number(T);
  const hum_val = isNaN(H) ? 50 : Number(H);

  // Update Instantaneous values in Chart Headers
  const co2ValEl = document.getElementById('co2-chart-value');
  const tempValEl = document.getElementById('temp-chart-value');
  const humValEl = document.getElementById('hum-chart-value');
  const tvocValEl = document.getElementById('tvoc-chart-value');

  if (co2ValEl) co2ValEl.textContent = `${Math.round(co2_val)} ppm`;
  if (tempValEl) tempValEl.textContent = `${temp_val.toFixed(1)}°C`;
  if (humValEl) humValEl.textContent = `${hum_val.toFixed(1)}%`;
  if (tvocValEl) tvocValEl.textContent = `${Math.round(tvoc_val)} ppb`;

  targetData.temperature = temp_val;
  targetData.humidity = hum_val;
  targetData.eco2 = co2_val;
  targetData.tvoc = tvoc_val;

  // Update Charts
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  chartHistory.labels.push(now);
  chartHistory.co2.push(co2_val);
  chartHistory.temp.push(temp_val);
  chartHistory.hum.push(hum_val);
  chartHistory.tvoc.push(tvoc_val);

  if (chartHistory.labels.length > MAX_CHART_POINTS) {
    chartHistory.labels.shift();
    chartHistory.co2.shift();
    chartHistory.temp.shift();
    chartHistory.hum.shift();
    chartHistory.tvoc.shift();
  }

  Object.keys(charts).forEach(key => {
    charts[key].update('none'); // Array references handle the data push
  });

  // Alert
  const alertOverlay = document.getElementById('alert-overlay');
  if (co2_val >= settings.threshold) {
    alertOverlay.classList.add('active');
  } else {
    alertOverlay.classList.remove('active');
  }
}

function toggleSettings() {
  const modal = document.getElementById('modal-overlay');
  modal.classList.toggle('active');
  if (modal.classList.contains('active')) {
    renderSettings();
  }
}

function closeModals() {
  document.getElementById('modal-overlay').classList.remove('active');
}

function renderSettings() {
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="setting-item">
      <label>CO₂ Alert Threshold (ppm)</label>
      <input type="number" id="set-threshold" value="${settings.threshold}" onchange="updateSetting('threshold', this.value)">
    </div>
  `;
}

function updateSetting(key, val) {
  settings[key] = parseInt(val);
  localStorage.setItem('co2_settings', JSON.stringify(settings));
}

// Start
initCharts();