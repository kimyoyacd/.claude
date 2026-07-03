(() => {
  "use strict";

  // ---------- helpers ----------
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => Math.random() * (max - min) + min;

  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, "0")).join("");
  }

  function hslToHex(h, s, l) {
    const [r, g, b] = hslToRgb(h, s, l);
    return rgbToHex(r, g, b);
  }

  function hexToRgb(hex) {
    const m = hex.replace("#", "");
    const bigint = parseInt(m.length === 3 ? m.split("").map(c => c + c).join("") : m, 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }

  function relativeLuminance(r, g, b) {
    const chan = v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  }

  function textColorFor(hex) {
    const [r, g, b] = hexToRgb(hex);
    return relativeLuminance(r, g, b) > 0.5 ? "#24211f" : "#f5f3ee";
  }

  // ---------- scheme logic ----------
  const TONE_PRESETS = {
    contrast: { sStart: 25, sEnd: 35, lStart: 20, lEnd: 88, sJitter: 10 },
    vivid: { sStart: 65, sEnd: 85, lStart: 35, lEnd: 65, sJitter: 8 },
    pastel: { sStart: 30, sEnd: 45, lStart: 72, lEnd: 92, sJitter: 8 },
    earthy: { sStart: 25, sEnd: 45, lStart: 28, lEnd: 60, sJitter: 8 },
    moody: { sStart: 15, sEnd: 35, lStart: 12, lEnd: 38, sJitter: 8 },
  };

  function schemeHues(base, scheme, count) {
    let offsets;
    switch (scheme) {
      case "complementary": offsets = [0, 180]; break;
      case "analogous": offsets = [0, 30, -30, 60, -60]; break;
      case "triadic": offsets = [0, 120, 240]; break;
      case "splitComplementary": offsets = [0, 150, 210]; break;
      case "tetradic": offsets = [0, 90, 180, 270]; break;
      case "monochromatic": offsets = [0, 0, 0, 0, 0]; break;
      default:
        offsets = Array.from({ length: count }, (_, i) => (360 / count) * i + rand(-15, 15));
    }
    return Array.from({ length: count }, (_, i) => (base + offsets[i % offsets.length] + 360) % 360);
  }

  // ---------- state ----------
  const state = {
    count: 4,
    scheme: "random",
    tone: "contrast",
    baseHue: Math.random() * 360,
    colors: [], // {h,s,l,locked}
  };

  function buildPalette({ newBase = true } = {}) {
    if (newBase) state.baseHue = Math.random() * 360;
    const hues = schemeHues(state.baseHue, state.scheme, state.count);
    const preset = TONE_PRESETS[state.tone];
    const next = [];
    for (let i = 0; i < state.count; i++) {
      const existing = state.colors[i];
      if (existing && existing.locked) { next.push(existing); continue; }
      const t = state.count === 1 ? 0 : i / (state.count - 1);
      let h = hues[i];
      if (state.scheme !== "monochromatic") h = (h + rand(-6, 6) + 360) % 360;
      const s = clamp(lerp(preset.sStart, preset.sEnd, t) + rand(-preset.sJitter, preset.sJitter), 5, 95);
      const l = clamp(lerp(preset.lStart, preset.lEnd, t) + rand(-5, 5), 5, 95);
      next.push({ h, s, l, locked: false });
    }
    state.colors = next;
  }

  // ---------- dom refs ----------
  const paletteEl = document.getElementById("palette");
  const countControl = document.getElementById("countControl");
  const schemeSelect = document.getElementById("schemeSelect");
  const toneSelect = document.getElementById("toneSelect");
  const generateBtn = document.getElementById("generateBtn");
  const titleInput = document.getElementById("titleInput");
  const previewCard = document.getElementById("previewCard");
  const coverSwatches = document.getElementById("coverSwatches");
  const coverBar = document.getElementById("coverBar");
  const copyHexBtn = document.getElementById("copyHexBtn");
  const copyCssBtn = document.getElementById("copyCssBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const historyStrip = document.getElementById("historyStrip");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const toast = document.getElementById("toast");
  const eyedropperBtn = document.getElementById("eyedropperBtn");
  const pickedList = document.getElementById("pickedList");
  const dropzone = document.getElementById("dropzone");
  const dropzoneText = document.getElementById("dropzoneText");
  const imageInput = document.getElementById("imageInput");
  const imagePreview = document.getElementById("imagePreview");
  const imagePalette = document.getElementById("imagePalette");
  const useImagePaletteBtn = document.getElementById("useImagePaletteBtn");
  const hiddenCanvas = document.getElementById("hiddenCanvas");

  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
  }

  function copyText(text, msg) {
    navigator.clipboard.writeText(text).then(() => showToast(msg)).catch(() => showToast("복사에 실패했어요"));
  }

  // ---------- render ----------
  function render() {
    renderPalette();
    renderPreview();
  }

  function renderPalette() {
    paletteEl.innerHTML = "";
    state.colors.forEach((c, i) => {
      const hex = hslToHex(c.h, c.s, c.l);
      const textColor = textColorFor(hex);
      const swatch = document.createElement("div");
      swatch.className = "swatch";

      const colorDiv = document.createElement("div");
      colorDiv.className = "swatch-color";
      colorDiv.style.background = hex;

      const lockBtn = document.createElement("button");
      lockBtn.className = "lock-btn";
      lockBtn.type = "button";
      lockBtn.textContent = c.locked ? "🔒" : "🔓";
      lockBtn.addEventListener("click", e => {
        e.stopPropagation();
        c.locked = !c.locked;
        renderPalette();
      });
      colorDiv.appendChild(lockBtn);
      colorDiv.style.color = textColor;

      const label = document.createElement("div");
      label.className = "swatch-label";
      label.innerHTML = `<b>${hex.toUpperCase()}</b><span>#${i + 1}</span>`;

      swatch.appendChild(colorDiv);
      swatch.appendChild(label);
      swatch.addEventListener("click", () => copyText(hex.toUpperCase(), `${hex.toUpperCase()} 복사됨`));

      paletteEl.appendChild(swatch);
    });
  }

  function renderPreview() {
    const hexes = state.colors.map(c => hslToHex(c.h, c.s, c.l));
    if (hexes.length === 0) return;

    previewCard.style.background = hexes[hexes.length - 1];
    titleInput.style.color = textColorFor(hexes[hexes.length - 1]);

    coverSwatches.innerHTML = "";
    state.colors.forEach((c, i) => {
      const ringHex = hslToHex(c.h, c.s, c.l);
      const pair = state.colors[(i + 1) % state.colors.length];
      const dotHex = hslToHex(pair.h, pair.s, pair.l);

      const donut = document.createElement("div");
      donut.className = "cover-donut";
      const ring = document.createElement("div");
      ring.className = "ring";
      ring.style.background = ringHex;
      const dot = document.createElement("div");
      dot.className = "dot";
      dot.style.background = dotHex;
      ring.appendChild(dot);
      const span = document.createElement("span");
      span.textContent = ringHex.toUpperCase();
      donut.appendChild(ring);
      donut.appendChild(span);
      coverSwatches.appendChild(donut);
    });

    coverBar.innerHTML = "";
    hexes.forEach(hex => {
      const seg = document.createElement("span");
      seg.style.background = hex;
      coverBar.appendChild(seg);
    });
  }

  // ---------- history ----------
  const HISTORY_KEY = "colorComboHistory";

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  }

  function saveHistory(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 12)));
  }

  function pushHistory() {
    const list = loadHistory();
    const entry = { colors: state.colors.map(({ h, s, l }) => ({ h, s, l })), scheme: state.scheme, tone: state.tone, count: state.count };
    list.unshift(entry);
    saveHistory(list);
    renderHistory();
  }

  function renderHistory() {
    const list = loadHistory();
    historyStrip.innerHTML = "";
    list.forEach(entry => {
      const item = document.createElement("div");
      item.className = "history-item";
      entry.colors.forEach(c => {
        const seg = document.createElement("span");
        seg.style.background = hslToHex(c.h, c.s, c.l);
        item.appendChild(seg);
      });
      item.addEventListener("click", () => {
        state.count = entry.count;
        state.scheme = entry.scheme;
        state.tone = entry.tone;
        state.colors = entry.colors.map(c => ({ ...c, locked: false }));
        schemeSelect.value = entry.scheme;
        toneSelect.value = entry.tone;
        setActiveCount(entry.count);
        render();
      });
      historyStrip.appendChild(item);
    });
  }

  function setActiveCount(count) {
    [...countControl.children].forEach(btn => {
      btn.classList.toggle("active", Number(btn.dataset.value) === count);
    });
  }

  // ---------- events ----------
  countControl.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.count = Number(btn.dataset.value);
    setActiveCount(state.count);
    buildPalette({ newBase: false });
    render();
  });

  schemeSelect.addEventListener("change", () => {
    state.scheme = schemeSelect.value;
    buildPalette({ newBase: false });
    render();
  });

  toneSelect.addEventListener("change", () => {
    state.tone = toneSelect.value;
    buildPalette({ newBase: false });
    render();
  });

  generateBtn.addEventListener("click", () => {
    buildPalette({ newBase: true });
    render();
    pushHistory();
  });

  document.addEventListener("keydown", e => {
    const tag = document.activeElement.tagName;
    if (e.code === "Space" && tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
      e.preventDefault();
      buildPalette({ newBase: true });
      render();
      pushHistory();
    }
  });

  copyHexBtn.addEventListener("click", () => {
    const hexes = state.colors.map(c => hslToHex(c.h, c.s, c.l).toUpperCase());
    copyText(hexes.join(", "), "HEX 목록이 복사됐어요");
  });

  copyCssBtn.addEventListener("click", () => {
    const css = ":root {\n" + state.colors.map((c, i) => `  --color-${i + 1}: ${hslToHex(c.h, c.s, c.l)};`).join("\n") + "\n}";
    copyText(css, "CSS 변수가 복사됐어요");
  });

  downloadBtn.addEventListener("click", () => {
    const W = 800, H = 1000;
    hiddenCanvas.width = W;
    hiddenCanvas.height = H;
    const ctx = hiddenCanvas.getContext("2d");
    const hexes = state.colors.map(c => hslToHex(c.h, c.s, c.l));

    ctx.fillStyle = hexes[hexes.length - 1];
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = textColorFor(hexes[hexes.length - 1]);
    ctx.font = "600 40px sans-serif";
    ctx.textBaseline = "top";
    wrapText(ctx, titleInput.value || "Untitled", 60, 60, W - 120, 48);

    const donutY = 220, r = 56;
    hexes.forEach((hex, i) => {
      const cx = 60 + i * (r * 2 + 30) + r;
      ctx.beginPath();
      ctx.arc(cx, donutY, r, 0, Math.PI * 2);
      ctx.fillStyle = hex;
      ctx.fill();
      const pair = hexes[(i + 1) % hexes.length];
      ctx.beginPath();
      ctx.arc(cx, donutY, r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = pair;
      ctx.fill();
      ctx.fillStyle = textColorFor(hexes[hexes.length - 1]);
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(hex.toUpperCase(), cx, donutY + r + 14);
      ctx.textAlign = "left";
    });

    const barY = H - 90, barH = 16;
    let x = 60;
    const barW = W - 120;
    hexes.forEach(hex => {
      const w = barW / hexes.length;
      ctx.fillStyle = hex;
      ctx.fillRect(x, barY, w, barH);
      x += w;
    });

    ctx.fillStyle = textColorFor(hexes[hexes.length - 1]);
    ctx.font = "12px sans-serif";
    ctx.fillText("Color Combo Generator", 60, H - 50);

    const link = document.createElement("a");
    link.download = "color-combo.png";
    link.href = hiddenCanvas.toDataURL("image/png");
    link.click();
  });

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    let curY = y;
    words.forEach(word => {
      const test = line + word + " ";
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, curY);
        line = word + " ";
        curY += lineHeight;
      } else {
        line = test;
      }
    });
    ctx.fillText(line, x, curY);
  }

  clearHistoryBtn.addEventListener("click", () => {
    saveHistory([]);
    renderHistory();
    showToast("기록을 지웠어요");
  });

  // ---------- eyedropper ----------
  const pickedColors = [];

  function renderPickedList() {
    pickedList.innerHTML = "";
    pickedColors.forEach(hex => {
      const chip = document.createElement("div");
      chip.className = "picked-chip";
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = hex;
      chip.appendChild(dot);
      chip.append(hex.toUpperCase());
      chip.title = "클릭하면 팔레트에 추가돼요";
      chip.addEventListener("click", () => addHexToPalette(hex));
      pickedList.appendChild(chip);
    });
  }

  function addHexToPalette(hex) {
    const [r, g, b] = hexToRgb(hex);
    const [h, s, l] = rgbToHsl(r, g, b);
    const idx = state.colors.findIndex(c => !c.locked);
    const targetIdx = idx === -1 ? 0 : idx;
    state.colors[targetIdx] = { h, s, l, locked: false };
    render();
    showToast(`${hex.toUpperCase()} 팔레트에 추가됨`);
  }

  if ("EyeDropper" in window) {
    eyedropperBtn.addEventListener("click", async () => {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        pickedColors.unshift(result.sRGBHex);
        pickedColors.length = Math.min(pickedColors.length, 8);
        renderPickedList();
      } catch {
        // user cancelled
      }
    });
  } else {
    eyedropperBtn.disabled = true;
    eyedropperBtn.textContent = "🎯 이 브라우저는 지원하지 않아요 (Chrome/Edge 사용)";
  }

  // ---------- image extraction ----------
  let extractedPalette = [];

  function extractColorsFromImage(img) {
    const maxDim = 160;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    hiddenCanvas.width = w;
    hiddenCanvas.height = h;
    const ctx = hiddenCanvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    const buckets = new Map();
    const step = 24;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const key = [Math.round(r / step) * step, Math.round(g / step) * step, Math.round(b / step) * step].join(",");
      const entry = buckets.get(key);
      if (entry) { entry.count++; entry.r += r; entry.g += g; entry.b += b; }
      else buckets.set(key, { count: 1, r, g, b });
    }

    const sorted = [...buckets.values()]
      .map(e => ({ count: e.count, r: Math.round(e.r / e.count), g: Math.round(e.g / e.count), b: Math.round(e.b / e.count) }))
      .sort((a, b) => b.count - a.count);

    const chosen = [];
    const minDist = 40;
    for (const c of sorted) {
      if (chosen.length >= state.count) break;
      const tooClose = chosen.some(o => Math.hypot(o.r - c.r, o.g - c.g, o.b - c.b) < minDist);
      if (!tooClose) chosen.push(c);
    }
    // fallback: fill remaining slots even if similar, in case image is low-variety
    if (chosen.length < state.count) {
      for (const c of sorted) {
        if (chosen.length >= state.count) break;
        if (!chosen.includes(c)) chosen.push(c);
      }
    }

    extractedPalette = chosen.map(c => rgbToHex(c.r, c.g, c.b));
    renderImagePalette();
  }

  function renderImagePalette() {
    imagePalette.innerHTML = "";
    extractedPalette.forEach(hex => {
      const chip = document.createElement("div");
      chip.className = "picked-chip";
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = hex;
      chip.appendChild(dot);
      chip.append(hex.toUpperCase());
      chip.title = "클릭하면 팔레트에 추가돼요";
      chip.addEventListener("click", () => addHexToPalette(hex));
      imagePalette.appendChild(chip);
    });
    useImagePaletteBtn.hidden = extractedPalette.length === 0;
  }

  useImagePaletteBtn.addEventListener("click", () => {
    if (!extractedPalette.length) return;
    state.count = extractedPalette.length;
    setActiveCount(Math.min(5, Math.max(2, state.count)));
    state.colors = extractedPalette.map(hex => {
      const [r, g, b] = hexToRgb(hex);
      const [h, s, l] = rgbToHsl(r, g, b);
      return { h, s, l, locked: false };
    });
    render();
    pushHistory();
    showToast("이미지 팔레트를 적용했어요");
  });

  function handleImageFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imagePreview.src = url;
      imagePreview.hidden = false;
      dropzoneText.hidden = true;
      extractColorsFromImage(img);
    };
    img.src = url;
  }

  imageInput.addEventListener("change", () => handleImageFile(imageInput.files[0]));

  ["dragover", "dragenter"].forEach(evt =>
    dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add("dragover"); })
  );
  ["dragleave", "drop"].forEach(evt =>
    dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove("dragover"); })
  );
  dropzone.addEventListener("drop", e => {
    const file = e.dataTransfer.files[0];
    handleImageFile(file);
  });

  // ---------- init ----------
  buildPalette({ newBase: true });
  render();
  renderHistory();
})();
