/**
 * AIOS V2 - Canvas Chart Components
 * Lightweight chart rendering: Line, Bar, and Donut charts.
 * Dark-theme aware, handles DPR scaling.
 */

const THEME = {
  bg: '#0a0a1a',
  grid: 'rgba(255, 255, 255, 0.06)',
  text: 'rgba(255, 255, 255, 0.5)',
  accent: '#6c5ce7',
  colors: ['#6c5ce7', '#00d2d3', '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3'],
};

/**
 * Prepare canvas for high-DPI rendering.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ ctx: CanvasRenderingContext2D, width: number, height: number }}
 */
function prepareCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  return { ctx, width, height };
}

/**
 * Line chart with filled area.
 */
export class LineChart {
  /**
   * Draw a line chart onto a canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {number[]} data - Y values
   * @param {Object} [options]
   * @param {string} [options.color] - Line color
   * @param {string[]} [options.labels] - X-axis labels
   * @param {string} [options.title] - Chart title
   * @param {boolean} [options.showDots=true] - Show data point dots
   * @param {number} [options.tension=0.3] - Curve tension
   */
  draw(canvas, data, options = {}) {
    if (!canvas || !data || data.length === 0) return;

    const { ctx, width, height } = prepareCanvas(canvas);
    const color = options.color || THEME.accent;
    const showDots = options.showDots !== false;
    const padding = { top: 30, right: 20, bottom: 30, left: 50 };

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Chart area
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Scale data
    const maxVal = Math.max(...data) || 1;
    const minVal = Math.min(...data, 0);
    const range = maxVal - minVal || 1;

    const points = data.map((v, i) => ({
      x: padding.left + (i / Math.max(data.length - 1, 1)) * chartW,
      y: padding.top + chartH - ((v - minVal) / range) * chartH,
    }));

    // Grid lines
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      const val = maxVal - (i / gridLines) * range;
      ctx.fillStyle = THEME.text;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(formatChartValue(val), padding.left - 8, y + 3);
    }

    // X-axis labels
    if (options.labels) {
      ctx.fillStyle = THEME.text;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      const step = Math.ceil(options.labels.length / 6);
      options.labels.forEach((label, i) => {
        if (i % step === 0) {
          ctx.fillText(label, points[i].x, height - 8);
        }
      });
    }

    // Filled area
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartH);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, hexToRgba(color, 0.3));
    gradient.addColorStop(1, hexToRgba(color, 0.02));
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Dots
    if (showDots && data.length <= 30) {
      points.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      });
    }

    // Title
    if (options.title) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(options.title, padding.left, 16);
    }
  }
}

/**
 * Vertical bar chart.
 */
export class BarChart {
  /**
   * Draw a bar chart onto a canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{label: string, value: number}>} data
   * @param {Object} [options]
   * @param {string[]} [options.colors] - Bar colors
   * @param {string} [options.title]
   */
  draw(canvas, data, options = {}) {
    if (!canvas || !data || data.length === 0) return;

    const { ctx, width, height } = prepareCanvas(canvas);
    const colors = options.colors || THEME.colors;
    const padding = { top: 30, right: 20, bottom: 40, left: 50 };

    ctx.clearRect(0, 0, width, height);

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const maxVal = Math.max(...data.map((d) => d.value)) || 1;

    const barCount = data.length;
    const gap = 12;
    const barWidth = Math.min(
      (chartW - gap * (barCount + 1)) / barCount,
      60
    );
    const totalBarsWidth = barCount * barWidth + (barCount + 1) * gap;
    const offsetX = padding.left + (chartW - totalBarsWidth) / 2;

    // Grid lines
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      const val = maxVal - (i / gridLines) * maxVal;
      ctx.fillStyle = THEME.text;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(formatChartValue(val), padding.left - 8, y + 3);
    }

    // Bars
    data.forEach((d, i) => {
      const barH = (d.value / maxVal) * chartH;
      const x = offsetX + gap + i * (barWidth + gap);
      const y = padding.top + chartH - barH;
      const color = colors[i % colors.length];

      // Bar gradient
      const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, hexToRgba(color, 0.4));

      ctx.fillStyle = grad;
      roundRect(ctx, x, y, barWidth, barH, 4);
      ctx.fill();

      // Label
      ctx.fillStyle = THEME.text;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        truncateLabel(d.label, 10),
        x + barWidth / 2,
        padding.top + chartH + 16
      );

      // Value on top
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 10px system-ui';
      ctx.fillText(formatChartValue(d.value), x + barWidth / 2, y - 6);
    });

    // Title
    if (options.title) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(options.title, padding.left, 16);
    }
  }
}

/**
 * Donut/Pie chart.
 */
export class DonutChart {
  /**
   * Draw a donut chart onto a canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{label: string, value: number, color?: string}>} segments
   * @param {Object} [options]
   * @param {string} [options.title]
   * @param {string} [options.centerLabel] - Text in the center of the donut
   * @param {string} [options.centerValue] - Value in the center of the donut
   */
  draw(canvas, segments, options = {}) {
    if (!canvas || !segments || segments.length === 0) return;

    const { ctx, width, height } = prepareCanvas(canvas);

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2 + 10;
    const radius = Math.min(width, height) / 2 - 40;
    const innerRadius = radius * 0.6;
    const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

    let currentAngle = -Math.PI / 2; // Start from top

    segments.forEach((seg, i) => {
      const sliceAngle = (seg.value / total) * Math.PI * 2;
      const color = seg.color || THEME.colors[i % THEME.colors.length];

      // Draw arc
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Segment border
      ctx.strokeStyle = 'rgba(10, 10, 26, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label line
      const midAngle = currentAngle + sliceAngle / 2;
      const labelRadius = radius + 16;
      const lx = centerX + Math.cos(midAngle) * labelRadius;
      const ly = centerY + Math.sin(midAngle) * labelRadius;

      if (seg.value / total > 0.05) {
        ctx.fillStyle = THEME.text;
        ctx.font = '10px system-ui';
        ctx.textAlign = midAngle > Math.PI / 2 && midAngle < (3 * Math.PI) / 2 ? 'right' : 'left';
        ctx.fillText(`${seg.label} (${Math.round((seg.value / total) * 100)}%)`, lx, ly);
      }

      currentAngle += sliceAngle;
    });

    // Center text
    if (options.centerValue) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(options.centerValue, centerX, centerY + 2);
    }
    if (options.centerLabel) {
      ctx.fillStyle = THEME.text;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(options.centerLabel, centerX, centerY + 18);
    }

    // Title
    if (options.title) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(options.title, 10, 16);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Draw a rounded rectangle path.
 */
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Convert a hex color to rgba string.
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
function hexToRgba(hex, alpha) {
  // Handle CSS variables or non-hex colors
  if (!hex || !hex.startsWith('#')) {
    return `rgba(108, 92, 231, ${alpha})`;
  }
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Format a number for chart display.
 * @param {number} val
 * @returns {string}
 */
function formatChartValue(val) {
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
  if (val >= 1_000) return (val / 1_000).toFixed(1) + 'K';
  if (val % 1 !== 0) return val.toFixed(1);
  return String(val);
}

/**
 * Truncate a label string.
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
function truncateLabel(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}
