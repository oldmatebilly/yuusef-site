/* yuusef.com — site behaviour */
const TYPE_LABEL = { A: "Album", E: "EP", S: "Single", F: "Feature", C: "SoundCloud" };

const releases = RAW.map((r, i) => {
  const [date, rawTitle, artists, type, tracks, id] = r;
  const m = rawTitle.match(/\s*\(feat\.\s*(.+)\)\s*$/i);
  const title = m ? rawTitle.slice(0, m.index) : rawTitle;
  const feat = m ? m[1] : "";
  const solo = artists === "yuusef" && !feat;
  let credit = "";
  if (type === "F") credit = artists + " ft. " + feat;
  else if (!solo) credit = artists + (feat ? " ft. " + feat : "");
  let cat = type === "A" || type === "E" ? "long" : type === "F" ? "feat" : solo ? "solo" : "collab";
  return { no: i + 1, date, year: date.slice(0, 4), title, credit, artists, type, tracks, id, cat,
           url: "https://music.apple.com/us/album/" + id, appleUrl: id ? "https://music.apple.com/us/album/" + id : "" };
});

const fmtDate = d => d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(2, 4);
const pad = n => String(n).padStart(3, "0");
const fmtPlays = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K" : String(n);

// ── Match SoundCloud uploads to releases by cleaned-up title ──
const norm = t => t.toLowerCase().replace(/’/g, "'")
  .replace(/\[[^\]]*\]/g, "")
  .replace(/\((prod|feat|w\/)[^)]*\)/g, "")
  .replace(/\s+-\s+.*$/, "")
  .replace(/\s+(w\/|feat\.|ft\.).*$/, "")
  .replace(/[^\p{L}\p{N}]+/gu, "");

const scByKey = new Map();
SC_TRACKS.forEach(([date, title, slug, plays]) => {
  const key = norm(title);
  const prev = scByKey.get(key);
  if (!prev || plays > prev.plays) scByKey.set(key, { date, title, slug, plays });
});
const usedKeys = new Set();
releases.forEach(r => {
  const hit = scByKey.get(norm(r.title));
  if (hit) { r.plays = hit.plays; r.scUrl = "https://soundcloud.com/yuu_sef/" + hit.slug; usedKeys.add(norm(r.title)); }
});
const strHash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return String(h >>> 0).padStart(7, "0"); };

// Spotify: link + plays per release, and the set of every song that's on a streaming service
const spByKey = new Map(SP.map(([id, t, tracks]) => [norm(t), { id, tracks }]));
const onStreaming = new Set(RAW.map(r => norm(r[1])));
SP.forEach(([, , tracks]) => tracks.forEach(([n]) => onStreaming.add(norm(n))));
releases.forEach(r => {
  if (!r.id) r.id = strHash(r.title);
  const feat = SP_FEAT[r.title];
  if (feat) { r.url = "https://open.spotify.com/album/" + feat.album; r.platform = "Spotify"; r.credit += " · on " + feat.from; return; }
  const sp = spByKey.get(norm(r.title));
  if (!sp) { if (r.url.endsWith("/album/")) r.url = "https://open.spotify.com/artist/3NvrEBUyMRufFB4RCM1Ir4"; return; }
  r.url = "https://open.spotify.com/album/" + sp.id;
  r.platform = "Spotify";
  const known = sp.tracks.filter(t => t[1] > 0);
  r.spPlays = known.reduce((n, t) => n + t[1], 0);
  r.spUnder = r.spPlays === 0;
});
releases.forEach(r => { if (r.type === "F" && FEAT_PLAYS[r.title] !== undefined) { const p = FEAT_PLAYS[r.title]; if (p > 0) r.spPlays = p; else r.spUnder = true; } });
const SP_TOTAL = (() => { const seen = new Map(); SP.forEach(([, , tr]) => tr.forEach(([n, p]) => { if (p > 0) seen.set(norm(n) + "|" + p, p); })); return [...seen.values()].reduce((a, b) => a + b, 0); })();

const extras = [...scByKey.entries()].filter(([k]) => !usedKeys.has(k) && !onStreaming.has(k)).map(([k, s]) => ({
  no: 0, date: s.date, year: s.date.slice(0, 4), title: s.title, credit: "", artists: "yuusef",
  type: "C", tracks: 1, id: strHash(s.slug), cat: "sc", plays: s.plays,
  url: "https://soundcloud.com/yuu_sef/" + s.slug
})).sort((a, b) => a.date < b.date ? 1 : -1);
const SC_TOTAL = SC_TRACKS.reduce((n, r) => n + r[3], 0);

// ── Real cover art (Apple Music for releases, SoundCloud for SoundCloud-only songs) ──
const appleArt = (path, px) => "https://is1-ssl.mzstatic.com/image/thumb/" + path + "/" + px + "x" + px + "bb.jpg";
const scArt = (file, px) => "https://i1.sndcdn.com/artworks-" + file.replace(/(\.\w+)$/, "-t" + px + "x" + px + "$1");
releases.forEach(r => {
  const appleId = (r.appleUrl.match(/(\d+)$/) || [])[1];
  if (appleId && APPLE_ART[appleId]) { r.cover = appleArt(APPLE_ART[appleId], 300); r.coverLg = appleArt(APPLE_ART[appleId], 600); }
  else if (SP_FEAT[r.title]) { r.cover = "https://i.scdn.co/image/ab67616d00001e02" + SP_FEAT[r.title].art; r.coverLg = "https://i.scdn.co/image/ab67616d0000b273" + SP_FEAT[r.title].art; }
  else if (/slowed/i.test(r.title)) { r.cover = scArt(SC_ART["one-in-a-million-slowed"], 300); r.coverLg = scArt(SC_ART["one-in-a-million-slowed"], 500); }
});
extras.forEach(e => {
  const slug = e.url.split("/").pop();
  if (SC_ART[slug]) { e.cover = scArt(SC_ART[slug], 300); e.coverLg = scArt(SC_ART[slug], 500); }
});

// A cover image, falling back to the generated photocopy cover if there's no art or it fails to load
function coverEl(r, px, large) {
  const fallback = () => { const c = document.createElement("canvas"); c.width = c.height = px; c.setAttribute("aria-hidden", "true"); drawCover(c, r); return c; };
  const src = large ? (r.coverLg || r.cover) : r.cover;
  if (!src) return fallback();
  const img = document.createElement("img");
  img.src = src; img.alt = ""; img.loading = large ? "eager" : "lazy"; img.decoding = "async";
  img.width = img.height = px; img.className = "cover-img";
  img.addEventListener("error", () => img.replaceWith(fallback()), { once: true });
  return img;
}

// ── Stats ──
(function stats() {
  const names = new Set();
  releases.forEach(r => {
    (r.artists + (r.credit ? ", " + r.credit : "")).replace(/ ft\. /g, ", ").split(/,|&/).map(s => s.trim()).filter(Boolean)
      .forEach(n => { if (!/^yuusef$/i.test(n)) names.add(n.toLowerCase().replace(/^\./, "")); });
  });
  document.getElementById("s-total").textContent = releases.length;
  document.getElementById("s-lp").textContent = fmtPlays(SP_TOTAL);
  document.getElementById("s-ep").textContent = fmtPlays(SC_TOTAL);
  document.getElementById("s-collab").textContent = COLLABORATORS.length;
  document.getElementById("lede-count").textContent = releases.length + " releases";
})();

// ── Seeded random ──
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ── Procedural photocopy cover ──
function drawCover(canvas, r) {
  const S = canvas.width, ctx = canvas.getContext("2d");
  const rand = rng(parseInt(r.id.slice(-7), 10) * 7 + r.no);
  const style = Math.floor(rand() * 5);
  const blood = rand() < 0.4;

  ctx.fillStyle = "#0b090a"; ctx.fillRect(0, 0, S, S);
  ctx.save();
  if (style === 0) { // eclipse
    const x = S * (0.3 + rand() * 0.4), y = S * (0.3 + rand() * 0.3), rad = S * (0.22 + rand() * 0.18);
    const g = ctx.createRadialGradient(x, y, rad * 0.2, x, y, rad * 1.3);
    g.addColorStop(0, "#f2ecdf"); g.addColorStop(0.7, "#8a8378"); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad * 1.3, 0, 7); ctx.fill();
    ctx.fillStyle = "#0b090a"; ctx.beginPath(); ctx.arc(x + rad * 0.35, y - rad * 0.15, rad * 0.95, 0, 7); ctx.fill();
  } else if (style === 1) { // halftone fade
    const cx = S * rand(), cy = S * rand(), step = 9 + Math.floor(rand() * 5);
    ctx.fillStyle = "#ece5d6";
    for (let y = 0; y < S; y += step) for (let x = 0; x < S; x += step) {
      const d = Math.hypot(x - cx, y - cy) / S;
      const rr = Math.max(0, (1 - d * 1.4)) * step * 0.55;
      if (rr > 0.4) { ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); }
    }
  } else if (style === 2) { // ripple rings
    const cx = S * (0.2 + rand() * 0.6), cy = S * (0.2 + rand() * 0.6);
    ctx.strokeStyle = "#ece5d6";
    for (let i = 1; i < 26; i++) { ctx.lineWidth = 1 + rand() * 3; ctx.globalAlpha = 1 - i / 28;
      ctx.beginPath(); ctx.arc(cx, cy, i * (8 + rand() * 4), 0, 7); ctx.stroke(); }
  } else if (style === 3) { // tape scrawl
    ctx.strokeStyle = "#ece5d6"; ctx.lineCap = "round";
    for (let k = 0; k < 4; k++) { ctx.lineWidth = 1 + rand() * 5; ctx.beginPath();
      let x = rand() * S, y = rand() * S; ctx.moveTo(x, y);
      for (let i = 0; i < 18; i++) { x += (rand() - 0.5) * 90; y += (rand() - 0.5) * 90; ctx.lineTo(x, y); }
      ctx.stroke(); }
  } else { // window light / film frame
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, "#d8d0c2"); g.addColorStop(1, "#191517");
    ctx.fillStyle = g;
    const cols = 2 + Math.floor(rand() * 2), gap = 10, w = (S * 0.6 - gap * (cols - 1)) / cols;
    for (let c = 0; c < cols; c++) for (let rr = 0; rr < 2; rr++)
      ctx.fillRect(S * 0.2 + c * (w + gap), S * 0.18 + rr * (S * 0.3 + gap), w, S * 0.3);
  }
  ctx.restore();

  if (blood) { ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "#b8172f";
    ctx.fillRect(0, 0, S, S); ctx.globalCompositeOperation = "source-over"; }

  // photocopy pass: noise + posterize
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 + (rand() - 0.5) * 70;
    const red = d[i] > d[i + 1] + 30;
    if (lum > 150) { d[i] = red ? 196 : 236; d[i + 1] = red ? 34 : 229; d[i + 2] = red ? 52 : 214; }
    else if (lum > 70) { d[i] = red ? 110 : 120; d[i + 1] = red ? 13 : 113; d[i + 2] = red ? 28 : 106; }
    else { d[i] = 11; d[i + 1] = 9; d[i + 2] = 10; }
  }
  ctx.putImageData(img, 0, 0);

  // label text
  ctx.fillStyle = "#ece5d6";
  ctx.font = `${Math.round(S * 0.075)}px VT323, monospace`;
  ctx.textBaseline = "top";
  ctx.fillText(r.no ? "No." + pad(r.no) : "SC " + r.year, S * 0.05, S * 0.04);
  ctx.textAlign = "right";
  ctx.fillText(TYPE_LABEL[r.type].toUpperCase(), S * 0.95, S * 0.04);
  ctx.textAlign = "left"; ctx.textBaseline = "bottom";
  ctx.font = `400 ${Math.round(S * 0.11)}px UnifrakturMaguntia, UnifrakturCook, serif`;
  const words = r.title.split(" "); let line = "", lines = [];
  words.forEach(w => { const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > S * 0.88 && line) { lines.push(line); line = w; } else line = t; });
  lines.push(line); lines = lines.slice(-3);
  lines.reverse().forEach((l, i) => ctx.fillText(l, S * 0.05, S * 0.95 - i * S * 0.115));
}

// ── Now playing ──
const latest = [...releases].reverse().find(r => r.type !== "F");
(function deck() {
  const el = document.getElementById("deck");
  el.innerHTML = `
    <div class="deck-art"></div>
    <div>
      <div class="lcd"><span class="scroll" id="deck-lcd"></span></div>
      <h3 id="deck-title"></h3>
      <p>Out ${fmtDate(latest.date)}. The newest entry in the archive.</p>
      <div class="platforms">
        <a class="btn" href="${latest.appleUrl || "https://music.apple.com/us/artist/yuusef/1548458187"}" target="_blank" rel="noopener">&#9654; APPLE MUSIC</a>
        <a class="btn" href="${latest.platform === "Spotify" ? latest.url : "https://open.spotify.com/artist/3NvrEBUyMRufFB4RCM1Ir4"}" target="_blank" rel="noopener">&#9654; SPOTIFY</a>
        <a class="btn" href="${latest.scUrl || "https://soundcloud.com/yuu_sef"}" target="_blank" rel="noopener">&#9654; SOUNDCLOUD</a>
      </div>
    </div>`;
  // titles go in as plain text, never as markup
  document.getElementById("deck-title").textContent = latest.title;
  document.getElementById("deck-lcd").textContent = ["TRACK 01", latest.title.toUpperCase(), TYPE_LABEL[latest.type].toUpperCase(), "OUT " + fmtDate(latest.date), "No." + pad(latest.no)].join("  \u00b7  ");
})();

// ── Archive ──
const TYPES = [["all", "ALL RELEASES"], ["long", "ALBUMS & EPs"], ["solo", "SOLO SINGLES"], ["collab", "COLLABS"], ["feat", "FEATURES"], ["sc", "SOUNDCLOUD EXTRAS"]];
const ALL_ITEMS = [...releases, ...extras];
const YEARS = ["all", ...[...new Set(ALL_ITEMS.map(r => r.year))].sort().reverse()];
const SORTS = [["new", "NEWEST"], ["old", "OLDEST"], ["plays", "MOST PLAYED"]];
let fType = "all", fYear = "all", fSort = "new";

function buttons(host, list, get, set) {
  host.innerHTML = "";
  list.forEach(([val, label]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = label; b.id = host.id + "-" + val;
    b.setAttribute("aria-pressed", String(get() === val));
    b.addEventListener("click", () => { set(val); buttons(host, list, get, set); render(); });
    host.appendChild(b);
  });
}

function render() {
  const grid = document.getElementById("grid");
  const pool = fType === "sc" ? extras : fType === "all" ? ALL_ITEMS : releases.filter(r => r.cat === fType);
  const total = r => (r.spPlays || 0) + (r.plays || 0);
  const list = pool.filter(r => fYear === "all" || r.year === fYear).sort((a, b) =>
    fSort === "plays" ? total(b) - total(a) :
    fSort === "old" ? (a.date < b.date ? -1 : a.date > b.date ? 1 : a.no - b.no) :
    (a.date < b.date ? 1 : a.date > b.date ? -1 : b.no - a.no));
  const sortName = SORTS.find(s => s[0] === fSort)[1];
  document.getElementById("count").textContent = fType === "sc"
    ? `SHOWING ${list.length} SONGS ONLY ON SOUNDCLOUD · ${sortName}`
    : fType === "all"
      ? `SHOWING ${list.length} OF ${ALL_ITEMS.length} · ${releases.length} RELEASES + ${extras.length} SOUNDCLOUD-ONLY · ${sortName}`
      : `SHOWING ${list.length} RELEASES · ${sortName}`;
  grid.innerHTML = "";
  const shown = expanded ? list : list.slice(0, PREVIEW);
  const canToggle = list.length > PREVIEW;
  grid.classList.toggle("collapsed", !expanded && canToggle);
  ["arch-toggle", "arch-toggle-top"].forEach(id => {
    const b = document.getElementById(id);
    b.hidden = !canToggle;
    b.setAttribute("aria-expanded", String(expanded));
    b.innerHTML = expanded ? "&#9650; COLLAPSE" : `&#9660; SHOW ALL ${list.length}`;
  });
  if (!list.length) { grid.innerHTML = '<p class="empty">NO TAPES MATCH. TRY ANOTHER YEAR.</p>'; return; }
  shown.forEach(r => {
    const a = document.createElement("a");
    a.className = "case"; a.href = r.url; a.target = "_blank"; a.rel = "noopener";
    a.setAttribute("aria-label", `${r.title}, ${TYPE_LABEL[r.type]}, ${fmtDate(r.date)}. Open on ${r.type === "C" ? "SoundCloud" : r.platform || "Apple Music"}`);
    const playBits = [];
    if (r.spPlays) playBits.push("SPOTIFY " + fmtPlays(r.spPlays));
    else if (r.spUnder) playBits.push("SPOTIFY &lt;1K");
    if (r.plays) playBits.push("SC " + fmtPlays(r.plays));
    const sum = (r.spPlays || 0) + (r.plays || 0);
    const totalLine = sum ? fmtPlays(sum) + (r.spUnder ? "+" : "") + " PLAYS" : r.spUnder ? "&lt;1K PLAYS" : "";
    a.innerHTML = `
      <div class="jewel"></div>
      <div class="meta"><span class="no">${r.no ? "No." + pad(r.no) : "SC"}</span><span>${fmtDate(r.date)}</span></div>
      <p class="t"></p>
      ${r.credit ? '<p class="a"></p>' : ""}
      <p class="k">${TYPE_LABEL[r.type]}${r.tracks > 1 ? " · " + r.tracks + " tracks" : ""}</p>
      ${totalLine ? '<p class="total">&#9654; ' + totalLine + '</p>' : ""}
      ${playBits.length > 1 ? '<p class="k split">' + playBits.join(" · ") + "</p>" : playBits.length ? '<p class="k split">' + playBits[0].split(" ")[0] + "</p>" : ""}`;
    a.querySelector(".t").textContent = r.title;
    if (r.credit) a.querySelector(".a").textContent = r.credit;
    a.querySelector(".jewel").appendChild(coverEl(r, 300));
    grid.appendChild(a);
  });
}

const PREVIEW = 12;
let expanded = false;
function toggleArchive(fromBottom) {
  expanded = !expanded;
  render();
  if (!expanded && fromBottom) document.getElementById("archive").scrollIntoView({ behavior: "smooth", block: "start" });
}
document.getElementById("arch-toggle").addEventListener("click", () => toggleArchive(true));
document.getElementById("arch-toggle-top").addEventListener("click", () => toggleArchive(false));

function drawDeck() { document.querySelector("#deck .deck-art").replaceChildren(coverEl(latest, 440, true)); }

buttons(document.getElementById("f-type"), TYPES, () => fType, v => fType = v);
buttons(document.getElementById("f-year"), YEARS.map(y => [y, y === "all" ? "ALL YEARS" : y]), () => fYear, v => fYear = v);
buttons(document.getElementById("f-sort"), SORTS, () => fSort, v => fSort = v);
render(); drawDeck();
// generated covers print their titles in the site fonts, so redraw those once the fonts arrive
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { render(); drawDeck(); });

// ── Visualiser: a ring of LED bars around the CD, driven by the song's own waveform ──
// samples = the track's loudness map (SoundCloud's waveform data, or one built from the audio file).
// Without samples it falls back to a gentle simulated motion, so the ring always works.
function makeRing(canvas) {
  const N = 72, SEGS = 7, ctx = canvas.getContext("2d");
  const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const level = new Float32Array(N);
  const seeds = Array.from({ length: N }, () => [Math.random() * 6.283, 0.6 + Math.random() * 1.4]);
  let samples = null, sMax = 1, playing = false, pos = 0, posAt = 0, dur = 0, raf = 0;

  function size() {
    const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(r.width * d)); canvas.height = Math.max(1, Math.round(r.height * d));
    draw(performance.now());
  }
  if (window.ResizeObserver) new ResizeObserver(size).observe(canvas); else addEventListener("resize", size);

  function target(i, now) {
    if (!playing) return 0.05;
    if (samples) {
      const t = pos + (now - posAt);                       // smooth between progress updates
      const frac = dur ? t / dur : 0;
      const k = Math.floor((frac + (i / N - 0.5) * 0.014) * samples.length);  // a short window of the song wrapped round the disc
      const v = samples[Math.max(0, Math.min(samples.length - 1, k))] / sMax;
      return Math.min(1, 0.06 + Math.pow(v, 1.4) * 1.0);
    }
    const [ph, sp] = seeds[i], s = now / 1000;
    return 0.2 + 0.32 * (0.5 + 0.5 * Math.sin(s * sp * 2.2 + ph)) * (0.6 + 0.4 * Math.sin(s * 0.7 + i * 0.3));
  }
  function draw(now) {
    const W = canvas.width, H = canvas.height; if (W < 4) return;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R0 = W / 2 / 1.32 + W * 0.014, L = W * 0.1;
    ctx.lineWidth = Math.max(2, W * 0.0105); ctx.lineCap = "butt";
    for (let i = 0; i < N; i++) {
      const tg = target(i, now);
      level[i] += (tg - level[i]) * (tg > level[i] ? 0.5 : 0.12);       // quick rise, slow fall, like a real meter
      const a = (i / N) * Math.PI * 2 - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      const lit = Math.round(level[i] * SEGS);
      for (let s = 0; s < SEGS; s++) {
        const r1 = R0 + (s / SEGS) * L, r2 = R0 + ((s + 0.7) / SEGS) * L;
        ctx.strokeStyle = s < lit ? (s >= SEGS - 1 ? "#ff4a5f" : s >= SEGS - 3 ? "#c9cdd2" : "#ece5d6") : "rgba(236,229,214,0.07)";
        ctx.beginPath(); ctx.moveTo(cx + ca * r1, cy + sa * r1); ctx.lineTo(cx + ca * r2, cy + sa * r2); ctx.stroke();
      }
    }
  }
  function loop(now) {
    draw(now);
    let busy = playing; if (!busy) for (let i = 0; i < N; i++) if (level[i] > 0.06) { busy = true; break; }
    raf = busy ? requestAnimationFrame(loop) : 0;
  }
  function kick() { if (still) { draw(performance.now()); return; } if (!raf) raf = requestAnimationFrame(loop); }
  return {
    setSamples(arr) { samples = Array.isArray(arr) && arr.length > 10 ? arr : null; sMax = samples ? Math.max(1, ...samples) : 1; },
    setPlaying(on) { playing = on; posAt = performance.now(); kick(); },
    setPosition(ms, d) { pos = ms || 0; posAt = performance.now(); if (d) dur = d; if (still) draw(posAt); },
    mode() { return samples ? "waveform" : "simulated"; }
  };
}

// ── Player: SoundCloud behind the CD. A random song from the profile each visit, its artwork on the disc ──
(function player() {
  const cd = document.getElementById("cd"), art = document.getElementById("cd-art");
  const lcd = document.getElementById("p-lcd"), seek = document.getElementById("seek");
  const playBtn = document.getElementById("p-play"), shuf = document.getElementById("p-shuffle");
  const time = document.getElementById("p-time"), note = document.getElementById("p-note");
  const ring = makeRing(document.getElementById("cd-ring"));
  window.yuRingMode = () => ring.mode();   // for checking which mode is running
  const host = document.getElementById("sc-host");
  const mini = document.getElementById("mini"), miniPlay = document.getElementById("mini-play");
  const miniSkip = document.getElementById("mini-skip"), miniTitle = document.getElementById("mini-title");
  const miniTime = document.getElementById("mini-time"), miniBar = document.getElementById("mini-bar");
  const miniDisc = document.getElementById("mini-disc"), miniArt = document.getElementById("mini-art");

  // one upload per song (the most-played version), so remasters and re-uploads don't double up
  const POOL = [...scByKey.values()].map(s => ({ url: "https://soundcloud.com/yuu_sef/" + s.slug, slug: s.slug, title: s.title }));
  const OPTS = { auto_play: false, visual: false, show_artwork: false, show_comments: false, show_user: false,
                 show_reposts: false, show_teaser: false, hide_related: true, buying: false, sharing: false, download: false };
  const query = o => Object.entries(o).map(([k, v]) => k + "=" + v).join("&");
  const fmt = ms => isFinite(ms) && ms > 0 ? Math.floor(ms / 60000) + ":" + String(Math.floor(ms / 1000) % 60).padStart(2, "0") : "0:00";
  const clean = t => t.replace(/\s*\[[^\]]*\]/g, "").replace(/\s*\((prod|feat|w\/)[^)]*\)/gi, "")
                      .replace(/\s+-\s+.*\bx\b.*$/i, "").replace(/\s+(w\/|feat\.).*$/i, "").replace(/\s+-\s*$/, "").trim();
  const findRel = t => { const k = norm(t); return releases.find(r => norm(r.title) === k) || extras.find(e => norm(e.title) === k) || null; };

  let cur = Math.floor(Math.random() * POOL.length), widget = null, ready = false, playing = false;
  let duration = 0, seeking = false, wantPlay = false, started = false, playerInView = true, fallbackTimer = null;

  // SoundCloud publishes each track's waveform; the JSON version holds the loudness samples
  function loadWave(url) {
    ring.setSamples(null);
    if (!url) return;
    fetch(url.replace(/\.png(\?.*)?$/, ".json"))
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && Array.isArray(j.samples)) ring.setSamples(j.samples); console.info("[yuusef] visualiser:", ring.mode()); })
      .catch(() => console.info("[yuusef] visualiser: simulated (waveform not available)"));
  }

  function setArt(rel, artworkUrl) {
    const big = artworkUrl ? imgOr(artworkUrl.replace("-large", "-t500x500"), rel, 600) : coverEl(rel || { title: "yuusef", no: 0, type: "S", id: "0000001", year: "" }, 600, true);
    const small = artworkUrl ? imgOr(artworkUrl.replace("-large", "-t200x200"), rel, 120) : coverEl(rel || { title: "yuusef", no: 0, type: "S", id: "0000001", year: "" }, 120);
    art.replaceChildren(big); miniArt.replaceChildren(small);
    cd.classList.add("has-art");
  }
  function imgOr(src, rel, px) {
    const img = document.createElement("img");
    img.src = src; img.alt = ""; img.width = img.height = px;
    img.addEventListener("error", () => img.replaceWith(coverEl(rel || { title: "yuusef", no: 0, type: "S", id: "0000001", year: "" }, px)), { once: true });
    return img;
  }
  function showMeta(title, artworkUrl) {
    const t = clean(title), rel = findRel(t);
    setArt(rel, artworkUrl);
    lcd.textContent = `${rel && rel.no ? "No." + pad(rel.no) : "SC"} · ${t.toUpperCase()} · YUUSEF`;
    miniTitle.textContent = t;
    cd.setAttribute("aria-label", (playing ? "Pause " : "Play ") + t);
  }
  function setPlaying(on) {
    playing = on;
    cd.classList.toggle("playing", on);
    ring.setPlaying(on);
    playBtn.innerHTML = on ? "&#10074;&#10074; PAUSE" : "&#9654; PLAY";
    document.getElementById("cd-hint").innerHTML = on ? "&#10074;&#10074;" : "&#9654;";
    miniPlay.innerHTML = on ? "&#10074;&#10074;" : "&#9654;";
    miniPlay.setAttribute("aria-label", on ? "Pause" : "Play");
    mini.classList.toggle("playing", on);
    if (on) { started = true; clearTimeout(fallbackTimer); host.classList.remove("reveal"); note.textContent = POOL.length + " SONGS ON SHUFFLE · A RANDOM ONE EACH VISIT"; }
    refreshMini();
  }
  function refreshMini() {
    const show = started && !playerInView;
    mini.classList.toggle("show", show);
    mini.setAttribute("aria-hidden", String(!show));
    document.body.classList.toggle("mini-on", show);
  }
  function readCurrent() {
    widget.getCurrentSound(s => {
      if (!s) return;
      applyVol();
      duration = s.duration || 0;
      ring.setPosition(0, duration); loadWave(s.waveform_url);
      showMeta(s.title || POOL[cur].title, s.artwork_url);
      time.textContent = "0:00 / " + fmt(duration); miniTime.textContent = time.textContent;
    });
  }
  // some phones only allow sound after a tap inside SoundCloud's own player; if play doesn't start, show it
  function armFallback() {
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      if (!widget || !wantPlay) return;
      widget.isPaused(p => { if (p && wantPlay) { host.classList.add("reveal"); note.textContent = "TAP PLAY IN THE SOUNDCLOUD PLAYER BELOW TO START"; } });
    }, 2500);
  }
  function play() { wantPlay = true; if (!ready) return; widget.play(); armFallback(); }
  function pause() { wantPlay = false; if (ready) widget.pause(); }
  function toggle() { playing || wantPlay && !ready ? pause() : play(); }
  function next(autoplay) {
    if (POOL.length > 1) { let n; do n = Math.floor(Math.random() * POOL.length); while (n === cur); cur = n; }
    showMeta(POOL[cur].title, null);
    seek.value = 0; miniBar.style.transform = "scaleX(0)";
    if (!ready) return;
    wantPlay = autoplay;
    widget.load(POOL[cur].url, Object.assign({}, OPTS, { auto_play: autoplay, callback: () => { readCurrent(); if (autoplay) armFallback(); } }));
  }

  cd.addEventListener("click", toggle);
  playBtn.addEventListener("click", toggle);
  shuf.addEventListener("click", () => next(playing));
  miniPlay.addEventListener("click", toggle);
  miniSkip.addEventListener("click", () => next(true));
  miniDisc.addEventListener("click", () => document.getElementById("top").scrollIntoView({ behavior: "smooth" }));
  seek.addEventListener("input", () => { seeking = true; });
  seek.addEventListener("change", () => { if (ready && duration) widget.seekTo(seek.value / 1000 * duration); seeking = false; });
  new IntersectionObserver(([e]) => { playerInView = e.isIntersecting; refreshMini(); }, { threshold: 0 }).observe(document.getElementById("player"));
  window.yuPauseMusic = pause;   // the Visuals TV pauses the music when a video starts

  // ── volume: slider + mute, remembered per visitor ──
  const vol = document.getElementById("vol"), volBtn = document.getElementById("vol-mute"), volVal = document.getElementById("vol-val");
  const miniVol = document.getElementById("mini-vol"), miniMute = document.getElementById("mini-mute");
  let level = 80, muted = false;
  try { const saved = localStorage.getItem("yu_vol"); if (saved !== null && !isNaN(+saved)) level = Math.max(0, Math.min(100, Math.round(+saved))); } catch (e) {}
  function applyVol() {
    vol.value = level;
    volVal.textContent = muted ? "MUTE" : String(level);
    volBtn.textContent = muted ? "MUTED" : "VOL";
    volBtn.setAttribute("aria-pressed", String(muted));
    volBtn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    miniVol.value = level; miniMute.textContent = muted ? "MUTED" : "VOL";
    miniMute.setAttribute("aria-pressed", String(muted)); miniMute.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    if (widget && ready) widget.setVolume(muted ? 0 : level);
  }
  vol.addEventListener("input", () => { level = +vol.value; muted = false; applyVol(); try { localStorage.setItem("yu_vol", String(level)); } catch (e) {} });
  volBtn.addEventListener("click", () => { muted = !muted; applyVol(); });
  miniVol.addEventListener("input", () => { level = +miniVol.value; muted = false; applyVol(); try { localStorage.setItem("yu_vol", String(level)); } catch (e) {} });
  miniMute.addEventListener("click", () => { muted = !muted; applyVol(); });
  applyVol();

  // first paint: a random song's details and cover straight away, before SoundCloud answers
  showMeta(POOL[cur].title, null);
  note.textContent = "LOADING SOUNDCLOUD…";

  // Load SoundCloud's control script FIRST, then create the player and listen for its "ready" signal
  // before it can fire. (Creating the player first meant the signal could be sent before anyone was listening.)
  let readyTimer = null;
  const api = document.createElement("script");
  api.src = "https://w.soundcloud.com/player/api.js"; api.async = true;
  api.onerror = () => { note.textContent = "SOUNDCLOUD DIDN'T LOAD · LISTEN ON THE LINKS ABOVE"; };
  api.onload = () => {
    const iframe = document.createElement("iframe");
    iframe.title = "SoundCloud player"; iframe.allow = "autoplay; encrypted-media"; iframe.loading = "eager";
    iframe.src = "https://w.soundcloud.com/player/?url=" + encodeURIComponent(POOL[cur].url) + "&" + query(OPTS);
    host.appendChild(iframe);
    widget = SC.Widget(iframe);
    const E = SC.Widget.Events;
    // backup: if SoundCloud never reports ready, show its own player so the visitor can press play there
    readyTimer = setTimeout(() => {
      if (!ready) { host.classList.add("reveal"); note.textContent = "SOUNDCLOUD IS SLOW · PRESS PLAY IN THE PLAYER BELOW"; }
    }, 10000);
    widget.bind(E.READY, () => {
      ready = true; clearTimeout(readyTimer); applyVol();
      if (!playing) host.classList.remove("reveal");
      note.textContent = POOL.length + " SONGS ON SHUFFLE · CLICK THE DISC TO PLAY";
      readCurrent();
      if (wantPlay) play();
    });
    widget.bind(E.ERROR, () => { if (ready) next(playing || wantPlay); });
    widget.bind(E.PLAY, () => setPlaying(true));
    widget.bind(E.PAUSE, () => setPlaying(false));
    widget.bind(E.FINISH, () => { setPlaying(false); next(true); });
    widget.bind(E.PLAY_PROGRESS, e => {
      ring.setPosition(e.currentPosition, duration);
      if (!duration && e.loadedProgress) widget.getDuration(d => { duration = d; });
      const t = fmt(e.currentPosition) + " / " + fmt(duration);
      time.textContent = t; miniTime.textContent = t;
      if (!seeking) seek.value = Math.round((e.relativePosition || 0) * 1000);
      miniBar.style.transform = "scaleX(" + (e.relativePosition || 0) + ")";
    });
  };
  document.head.appendChild(api);
})();

// ── Visuals: CRT set + VHS shelf ──
(function visuals() {
  const shelf = document.getElementById("shelf"), toggle = document.getElementById("tapes-toggle");
  const screen = document.querySelector(".tv-screen");
  const TAPE_PREVIEW = 8;
  let sel = 0, open = false, onAir = false;

  function showTV(i, animate) {
    const [id, title, kind, len, views, year] = VIDEOS[i];
    document.getElementById("tv-kind").textContent = kind.toUpperCase();
    document.getElementById("tv-title").textContent = title;
    document.getElementById("tv-meta").textContent = `${len} · ${views} VIEWS · ${year}`;
    document.getElementById("tv-ch").textContent = "CH " + String(i + 1).padStart(2, "0");
    const w = document.getElementById("tv-watch");
    w.href = "https://www.youtube.com/watch?v=" + id;
    w.setAttribute("aria-label", "Watch " + title + " on YouTube");
    document.getElementById("tv-play").setAttribute("aria-label", "Play " + title);
    if (onAir) playTV();   // already watching: the new tape starts straight away
    else if (animate) { screen.classList.remove("switching"); void screen.offsetWidth; screen.classList.add("switching"); }
  }

  // the video plays inside the TV (privacy-enhanced YouTube embed), loaded only when asked for
  function playTV() {
    const id = VIDEOS[sel][0];
    let frame = screen.querySelector(".tv-embed");
    if (!frame) {
      frame = document.createElement("iframe");
      frame.className = "tv-embed";
      frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      screen.appendChild(frame);
    }
    frame.title = VIDEOS[sel][1] + " (YouTube video)";
    frame.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1&playsinline=1";
    onAir = true; screen.classList.add("on-air");
    document.getElementById("tv-off").hidden = false;
    if (window.yuPauseMusic) window.yuPauseMusic();
  }
  function stopTV() {
    const frame = screen.querySelector(".tv-embed");
    if (frame) frame.remove();
    onAir = false; screen.classList.remove("on-air");
    document.getElementById("tv-off").hidden = true;
  }
  document.getElementById("tv-play").addEventListener("click", playTV);
  document.getElementById("tv-off").addEventListener("click", stopTV);

  function renderShelf() {
    shelf.innerHTML = "";
    const list = open ? VIDEOS : VIDEOS.slice(0, TAPE_PREVIEW);
    list.forEach((v, i) => {
      const [id, title, kind, len, views, year] = v;
      const b = document.createElement("button");
      b.type = "button"; b.className = "tape"; b.setAttribute("role", "listitem");
      b.setAttribute("aria-pressed", String(i === sel));
      b.setAttribute("aria-label", `${title}, ${kind}, ${len}. Put it in the TV`);
      b.innerHTML = '<span class="tape-label"><span class="tape-title"></span><span class="tape-meta"><span></span><span></span></span></span><span class="tape-reels" aria-hidden="true"><i></i><i></i></span>';
      b.querySelector(".tape-title").textContent = title;
      const m = b.querySelectorAll(".tape-meta span");
      m[0].textContent = kind.toUpperCase().replace(" COVER", "");
      m[1].textContent = len;
      b.addEventListener("click", () => {
        sel = i; showTV(i, true);
        shelf.querySelectorAll(".tape").forEach((t, k) => t.setAttribute("aria-pressed", String(k === sel)));
        document.getElementById("tv").scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      shelf.appendChild(b);
    });
    toggle.setAttribute("aria-expanded", String(open));
    toggle.innerHTML = open ? "&#9650; FEWER TAPES" : `&#9660; SHOW ALL ${VIDEOS.length} TAPES`;
  }
  toggle.addEventListener("click", () => {
    open = !open; renderShelf();
    if (!open) document.getElementById("visuals").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // TV static, only animated while the set is on screen
  const c = document.getElementById("tv-static"), ctx = c.getContext("2d"), img = ctx.createImageData(c.width, c.height);
  const frame = () => { for (let k = 0; k < img.data.length; k += 4) { const v = Math.random() * 255; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255; } ctx.putImageData(img, 0, 0); };
  frame();
  const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer = null;
  if (!still) new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !timer) timer = setInterval(frame, 80);
    else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; }
  }).observe(screen);

  document.getElementById("vs-note").textContent = VIDEOS.length + " TAPES · PICK ONE";
  showTV(0, false);
  renderShelf();
})();

// ── Liner notes booklet ──
(function booklet() {
  const book = document.getElementById("booklet"), cover = document.getElementById("bk-cover");
  const spread = document.getElementById("bk-spread"), controls = document.getElementById("bk-controls");
  const L = document.getElementById("bk-left"), R = document.getElementById("bk-right");
  const prev = document.getElementById("bk-prev"), next = document.getElementById("bk-next");
  const pageno = document.getElementById("bk-pageno"), note = document.getElementById("bk-note");
  const pages = [...document.getElementById("bk-pages").content.children];
  const narrow = window.matchMedia("(max-width: 640px)");
  let at = 0;

  // collaborators (the full credited list lives in COLLABORATORS)
  const namesUl = pages.find(p => p.querySelector("#bk-names")).querySelector("#bk-names");
  COLLABORATORS.forEach(n => { const li = document.createElement("li"); li.textContent = n; namesUl.appendChild(li); });

  // the cover's video loop plays only while the booklet is on screen and closed, and never with reduced motion
  const vid = document.getElementById("bk-video");
  const calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (vid && !calm) new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !cover.hidden) { const p = vid.play(); if (p && p.catch) p.catch(() => {}); } else vid.pause();
  }, { threshold: 0.2 }).observe(cover);

  const step = () => narrow.matches ? 1 : 2;
  function show(animate) {
    at = Math.max(0, Math.min(at, pages.length - 1));
    if (!narrow.matches) at -= at % 2;
    L.replaceChildren(pages[at].cloneNode(true));
    R.replaceChildren(!narrow.matches && pages[at + 1] ? pages[at + 1].cloneNode(true) : document.createTextNode(""));
    const last = narrow.matches ? at + 1 : Math.min(at + 2, pages.length);
    pageno.textContent = (narrow.matches ? "PAGE " + (at + 1) : "PAGES " + (at + 1) + "–" + last) + " / " + pages.length;
    prev.disabled = at === 0; next.disabled = last >= pages.length;
    if (animate) { spread.classList.remove("turn"); void spread.offsetWidth; spread.classList.add("turn"); }
  }
  function open() {
    book.classList.add("opening");
    setTimeout(() => {
      cover.hidden = true; book.classList.remove("opening");
      spread.hidden = false; controls.hidden = false; spread.classList.add("in");
      at = 0; show(false); note.textContent = "USE THE ARROWS TO TURN PAGES";
      next.focus({ preventScroll: true });
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 420);
  }
  function close() {
    spread.hidden = true; controls.hidden = true; spread.classList.remove("in");
    cover.hidden = false; note.textContent = "TAP THE BOOKLET TO OPEN"; cover.focus({ preventScroll: true });
  }
  cover.addEventListener("click", open);
  prev.addEventListener("click", () => { at -= step(); show(true); });
  next.addEventListener("click", () => { at += step(); show(true); });
  document.getElementById("bk-close").addEventListener("click", close);
  book.addEventListener("keydown", e => {
    if (spread.hidden) return;
    if (e.key === "ArrowRight" && !next.disabled) next.click();
    if (e.key === "ArrowLeft" && !prev.disabled) prev.click();
  });
  controls.addEventListener("keydown", e => {
    if (e.key === "ArrowRight" && !next.disabled) next.click();
    if (e.key === "ArrowLeft" && !prev.disabled) prev.click();
  });
  narrow.addEventListener("change", () => { if (!spread.hidden) show(false); });
})();

// ── REC replays the intro ──
document.getElementById("rec").addEventListener("click", () => { if (window.yuBoot) window.yuBoot(); });

// ── VHS timecode ──
(function tc() {
  const el = document.getElementById("tc"), t0 = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    el.textContent = "SP " + [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, "0")).join(":");
  }, 1000);
})();

// ── Film grain ──
(function grain() {
  const c = document.getElementById("grain"), ctx = c.getContext("2d");
  const img = ctx.createImageData(c.width, c.height);
  function frame() {
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  }
  frame();
  const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!still) setInterval(frame, 90);
})();


// PREVIEW · the first-screen play button drives the main player
(function(){ var b=document.getElementById("hero-play"), p=document.getElementById("p-play"); if(b&&p) b.addEventListener("click", function(){ p.click(); }); })();

// PREVIEW · "next tape" bar: shown only when NEXT_TAPE is filled in (assets/data.js)
(function(){
  var cfg = typeof NEXT_TAPE !== "undefined" ? NEXT_TAPE : null;
  var bar = document.getElementById("next-tape"), t = document.getElementById("nt-title"), b = document.getElementById("nt-btn");
  if (!cfg || !bar || !t || !b || !cfg.title) return;
  var when = "";
  if (cfg.date) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cfg.date); when = m ? m[3] + "." + m[2] + "." + m[1].slice(2) : String(cfg.date); }
  t.textContent = String(cfg.title).toUpperCase() + (when ? "  \u00b7  " + when : "");   // plain text, never markup
  if (/^https:\/\//.test(cfg.url || "")) b.href = cfg.url; else b.hidden = true;        // only real https links get a button
  bar.hidden = false;
})();
