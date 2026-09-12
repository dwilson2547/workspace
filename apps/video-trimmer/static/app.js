/* video-trimmer — front end.
 *
 * The one thing this has to get right: moving the playhead must show you that
 * frame, immediately, without pressing play. A paused <video> does exactly that
 * when you assign currentTime, provided the server answers Range requests.
 */

const $ = (id) => document.getElementById(id);

const els = {
  srcPath: $("src-path"), fileList: $("file-list"),
  video: $("video"), empty: $("empty"), badge: $("badge"),
  tcNow: $("tc-now"), tcIn: $("tc-in"), tcOut: $("tc-out"),
  tcDur: $("tc-dur"), tcTotal: $("tc-total"),
  timeline: $("timeline"), keyframes: $("keyframes"),
  selection: $("selection"), snap: $("snap"), playhead: $("playhead"),
  btnPlay: $("btn-play"), btnIn: $("btn-in"), btnOut: $("btn-out"),
  btnPreview: $("btn-preview"), btnClear: $("btn-clear"), btnExport: $("btn-export"),
  preset: $("preset"), quality: $("quality"), qualityVal: $("quality-val"),
  qualityWrap: $("quality-wrap"), hint: $("hint"),
  status: $("export-status"), statusMsg: $("export-msg"),
  statusPct: $("export-pct"), statusBar: $("export-bar"),
};

const state = {
  presets: [], files: [],
  file: null, info: null, keyframes: [],
  in: null, out: null,
  previewStop: null,   // when previewing the selection, where to halt
  pollTimer: null,
};

// ---------------------------------------------------------------- utils

const fps = () => (state.info && state.info.fps) || 30;

function timecode(t) {
  if (t == null || !isFinite(t)) return "—";
  const f = Math.floor((t % 1) * fps());
  const s = Math.floor(t) % 60;
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
}

function shortDur(t) {
  if (t == null || !isFinite(t)) return "—";
  const s = (t % 60).toFixed(2).padStart(5, "0");
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

const humanSize = (b) => {
  if (!b) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(b < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Largest keyframe at or before t — where a `-c copy` cut actually lands. */
function snapBack(t) {
  const ks = state.keyframes;
  if (!ks.length) return t;
  let lo = 0, hi = ks.length - 1, best = ks[0];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ks[mid] <= t + 1e-6) { best = ks[mid]; lo = mid + 1; } else { hi = mid - 1; }
  }
  return best;
}

// ---------------------------------------------------------------- boot

async function boot() {
  const cfg = await (await fetch("/api/config")).json();
  state.presets = cfg.presets;
  els.srcPath.textContent = cfg.src_dir;
  els.srcPath.title = `exports → ${cfg.out_dir}`;

  els.preset.innerHTML = cfg.presets
    .map((p) => `<option value="${p.id}">${p.label}</option>`)
    .join("");
  onPresetChange();

  state.files = await (await fetch("/api/files")).json();
  renderFiles();
}

function renderFiles() {
  if (!state.files.length) {
    els.fileList.innerHTML =
      `<div style="padding:14px;color:var(--muted);font-size:13px">No video files found.</div>`;
    return;
  }
  els.fileList.innerHTML = state.files
    .map((f) => `
      <div class="file${f.name === state.file ? " active" : ""}" data-n="${encodeURIComponent(f.name)}">
        <span class="n" title="${f.name}">${f.name}</span>
        <span class="s">${humanSize(f.size)}</span>
      </div>`)
    .join("");
  els.fileList.querySelectorAll(".file").forEach((el) => {
    el.onclick = () => loadFile(decodeURIComponent(el.dataset.n));
  });
}

// ---------------------------------------------------------------- loading

async function loadFile(name) {
  state.file = name;
  state.in = state.out = null;
  state.previewStop = null;
  renderFiles();

  els.hint.textContent = "probing…";
  els.hint.classList.remove("warn");

  const info = await (await fetch(`/api/probe?f=${encodeURIComponent(name)}`)).json();
  if (!info.ok) {
    els.hint.textContent = info.error || "could not probe this file";
    els.hint.classList.add("warn");
    return;
  }
  state.info = info;
  state.keyframes = info.keyframes || [];

  els.video.src = `/media/${encodeURIComponent(name)}`;
  els.video.classList.remove("hidden");
  els.empty.classList.add("hidden");
  els.badge.classList.remove("hidden");
  els.badge.textContent =
    `${info.width}×${info.height} · ${info.fps}fps · ${info.codec}` +
    `${info.has_audio ? "" : " · no audio"} · ${humanSize(info.size)}`;

  els.tcTotal.textContent = `${shortDur(info.duration)} total`;

  [els.btnPlay, els.btnIn, els.btnOut, els.btnClear].forEach((b) => (b.disabled = false));

  renderKeyframes();
  updateUI();
  onPresetChange();
}

function renderKeyframes() {
  const dur = state.info?.duration || 0;
  if (!dur || !state.keyframes.length) { els.keyframes.innerHTML = ""; return; }
  // Cap the tick count so a long clip doesn't spawn thousands of nodes.
  const step = Math.max(1, Math.ceil(state.keyframes.length / 800));
  let html = "";
  for (let i = 0; i < state.keyframes.length; i += step) {
    html += `<i style="left:${(state.keyframes[i] / dur) * 100}%"></i>`;
  }
  els.keyframes.innerHTML = html;
}

// ---------------------------------------------------------------- ui state

function updateUI() {
  const dur = state.info?.duration || 0;
  const t = els.video.currentTime || 0;

  els.tcNow.textContent = timecode(t);
  els.tcIn.textContent = state.in == null ? "—" : timecode(state.in);
  els.tcOut.textContent = state.out == null ? "—" : timecode(state.out);

  const haveBoth = state.in != null && state.out != null && state.out > state.in;
  els.tcDur.textContent = haveBoth ? shortDur(state.out - state.in) : "—";

  els.playhead.style.left = dur ? `${(t / dur) * 100}%` : "0%";

  if (haveBoth && dur) {
    els.selection.classList.remove("empty");
    els.selection.style.left = `${(state.in / dur) * 100}%`;
    els.selection.style.width = `${((state.out - state.in) / dur) * 100}%`;
  } else {
    els.selection.classList.add("empty");
  }

  els.btnPreview.disabled = !haveBoth;
  els.btnExport.disabled = !haveBoth;
  els.btnPlay.textContent = els.video.paused ? "▶ Play" : "❚❚ Pause";

  updateSnapHint();
}

/** Lossless cuts land on a keyframe; show where, and by how much it moves. */
function updateSnapHint() {
  const preset = state.presets.find((p) => p.id === els.preset.value);
  const dur = state.info?.duration || 0;

  // Ticks are only meaningful for a lossless cut, so show them with that preset.
  els.keyframes.classList.toggle("show", !!(preset && preset.lossless && dur));

  if (!preset || !preset.lossless || state.in == null || !dur) {
    els.snap.classList.remove("show");
    if (preset && !preset.lossless && state.in != null) {
      els.hint.textContent = preset.note;
      els.hint.classList.remove("warn");
    }
    return;
  }

  const landed = snapBack(state.in);
  const drift = state.in - landed;
  els.snap.style.left = `${(landed / dur) * 100}%`;
  els.snap.classList.toggle("show", drift > 1 / fps());

  if (drift > 1 / fps()) {
    els.hint.innerHTML =
      `Lossless cut starts at <b>${timecode(landed)}</b> — ` +
      `${drift.toFixed(2)}s earlier than your mark (dashed line). ` +
      `Pick a frame-exact preset to cut precisely.`;
    els.hint.classList.add("warn");
  } else {
    els.hint.textContent = preset.note;
    els.hint.classList.remove("warn");
  }
}

// ---------------------------------------------------------------- scrubbing

function seekToClientX(clientX) {
  const dur = state.info?.duration || 0;
  if (!dur) return;
  const r = els.timeline.getBoundingClientRect();
  const frac = clamp((clientX - r.left) / r.width, 0, 1);
  els.video.currentTime = frac * dur;
  updateUI();
}

let scrubbing = false;

els.timeline.addEventListener("pointerdown", (e) => {
  if (!state.info) return;
  scrubbing = true;
  state.previewStop = null;
  els.timeline.setPointerCapture(e.pointerId);
  els.video.pause();          // paused seeking is what makes frames appear instantly
  seekToClientX(e.clientX);
});

els.timeline.addEventListener("pointermove", (e) => {
  if (scrubbing) seekToClientX(e.clientX);
});

els.timeline.addEventListener("pointerup", (e) => {
  scrubbing = false;
  els.timeline.releasePointerCapture(e.pointerId);
});

// ---------------------------------------------------------------- transport

function step(frames) {
  if (!state.info) return;
  els.video.pause();
  state.previewStop = null;
  els.video.currentTime = clamp(
    els.video.currentTime + frames / fps(), 0, state.info.duration);
  updateUI();
}

function togglePlay() {
  if (!state.info) return;
  if (els.video.paused) { state.previewStop = null; els.video.play(); }
  else els.video.pause();
}

function markIn() {
  if (!state.info) return;
  state.in = els.video.currentTime;
  if (state.out != null && state.out <= state.in) state.out = null;
  updateUI();
}

function markOut() {
  if (!state.info) return;
  state.out = els.video.currentTime;
  if (state.in != null && state.in >= state.out) state.in = null;
  updateUI();
}

function previewSelection() {
  if (state.in == null || state.out == null) return;
  els.video.currentTime = state.in;
  state.previewStop = state.out;
  els.video.play();
}

function clearMarks() {
  state.in = state.out = null;
  state.previewStop = null;
  updateUI();
}

els.btnPlay.onclick = togglePlay;
els.btnIn.onclick = markIn;
els.btnOut.onclick = markOut;
els.btnPreview.onclick = previewSelection;
els.btnClear.onclick = clearMarks;

els.video.addEventListener("timeupdate", () => {
  if (state.previewStop != null && els.video.currentTime >= state.previewStop) {
    els.video.pause();
    els.video.currentTime = state.previewStop;
    state.previewStop = null;
  }
  updateUI();
});
els.video.addEventListener("seeked", updateUI);
els.video.addEventListener("play", updateUI);
els.video.addEventListener("pause", updateUI);
els.video.addEventListener("loadedmetadata", updateUI);

// ---------------------------------------------------------------- presets

function onPresetChange() {
  const p = state.presets.find((x) => x.id === els.preset.value);
  if (!p) return;
  els.qualityWrap.classList.toggle("show", !p.lossless && p.id !== "audio");
  els.qualityVal.textContent =
    (p.id.includes("nvenc") ? "CQ " : "CRF ") + els.quality.value;
  if (state.info) updateSnapHint();
  else { els.hint.textContent = p.note; els.hint.classList.remove("warn"); }
}

els.preset.onchange = onPresetChange;
els.quality.oninput = () => {
  const p = state.presets.find((x) => x.id === els.preset.value);
  els.qualityVal.textContent =
    (p && p.id.includes("nvenc") ? "CQ " : "CRF ") + els.quality.value;
};

// ---------------------------------------------------------------- export

async function doExport() {
  if (state.in == null || state.out == null || state.out <= state.in) return;

  els.btnExport.disabled = true;
  els.status.className = "show";
  els.statusMsg.textContent = "starting ffmpeg…";
  els.statusPct.textContent = "";
  els.statusBar.style.width = "0%";

  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: state.file,
      start: state.in,
      end: state.out,
      preset: els.preset.value,
      quality: Number(els.quality.value),
    }),
  });
  const data = await res.json();

  if (!res.ok || data.error) {
    els.status.className = "show error";
    els.statusMsg.textContent = data.error || "export failed to start";
    els.statusBar.style.width = "100%";
    els.btnExport.disabled = false;
    return;
  }
  pollJob(data.job);
}

function pollJob(id) {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    let job;
    try {
      job = await (await fetch(`/api/jobs/${id}`)).json();
    } catch { return; }

    if (job.state === "done") {
      clearInterval(state.pollTimer);
      els.status.className = "show done";
      els.statusBar.style.width = "100%";
      els.statusPct.textContent = humanSize(job.size);
      els.statusMsg.textContent = `✓ ${job.output.split("/").pop()}`;
      els.statusMsg.title = job.output;
      els.btnExport.disabled = false;
    } else if (job.state === "error") {
      clearInterval(state.pollTimer);
      els.status.className = "show error";
      els.statusBar.style.width = "100%";
      els.statusPct.textContent = "";
      els.statusMsg.textContent = job.error || "ffmpeg failed";
      els.btnExport.disabled = false;
    } else {
      els.statusBar.style.width = `${job.progress || 0}%`;
      els.statusPct.textContent =
        `${(job.progress || 0).toFixed(0)}%${job.speed ? ` · ${job.speed}` : ""}`;
      els.statusMsg.textContent = `encoding → ${job.output.split("/").pop()}`;
    }
  }, 400);
}

els.btnExport.onclick = doExport;

// ---------------------------------------------------------------- keyboard

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, select, textarea")) return;

  const jump = (t) => {
    els.video.pause();
    state.previewStop = null;
    els.video.currentTime = t;
    updateUI();
  };

  switch (e.key) {
    case " ":        e.preventDefault(); togglePlay(); break;
    case "ArrowLeft":  e.preventDefault(); step(e.shiftKey ? -fps() : -1); break;
    case "ArrowRight": e.preventDefault(); step(e.shiftKey ? fps() : 1); break;
    case "i": case "I": markIn(); break;
    case "o": case "O": markOut(); break;
    case "[": if (state.in != null) jump(state.in); break;
    case "]": if (state.out != null) jump(state.out); break;
    case "Enter": if (!els.btnExport.disabled) doExport(); break;
    case "Escape": clearMarks(); break;
    case "Home": e.preventDefault(); jump(0); break;
    case "End":
      e.preventDefault();
      if (state.info) jump(Math.max(0, state.info.duration - 1 / fps()));
      break;
    case "p": case "P": previewSelection(); break;
    default: return;
  }
});

boot();
