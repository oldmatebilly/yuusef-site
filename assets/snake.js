// ── Hidden extra: Snake on the CD player's display ──
// Tap the spinning CD 5 times to open it. The snake eats CDs: the 1st CD starts a released song
// at its loudest section, and every 5th CD after that (6th, 11th, 16th …) switches to a new one.
// Scores go to the leaderboard in Supabase through submit_score(), which re-checks names,
// rate limits and impossible scores on the database side.
(function snake() {
  "use strict";
  const disc = document.getElementById("cd");
  if (!disc) return;

  // ── settings ──
  // phones get a taller board that fits a portrait screen
  const PORTRAIT = window.matchMedia && matchMedia("(max-width: 600px)").matches;
  const COLS = PORTRAIT ? 15 : 21, ROWS = PORTRAIT ? 19 : 15;
  const TICK_START = 150, TICK_MIN = 75, TICK_STEP = 3;   // ms per move; speeds up with each CD
  const SONG_EVERY = 5;   // CD 1 starts a song, then every 5th CD after it (6, 11, 16 …) changes it
  const API = "https://mdpmfgewfelvvumldtrh.supabase.co/rest/v1";
  const KEY = "sb_publishable_ELUfzX1gFHSOnBcsI0r3yA_0LFmnopH";
  const H = { apikey: KEY, "Content-Type": "application/json" };
  if (KEY.startsWith("eyJ")) H.Authorization = "Bearer " + KEY;

  // released songs: [SoundCloud slug, loudest-section position in seconds, title on the display]
  // hook = start of the loudest section in the "yuusef library index (songs)" sheet, plus 6 s
  const SNIPS = [
    ["dont-ever-say-that-its-all-good", 43, "DONT EVER SAY THAT ITS ALL GOOD"],
    ["love-it-when-she-get-bad", 72, "LOVE IT WHEN SHE GET BAD"],
    ["how-to-love-again", 34, "HOW TO LOVE AGAIN"],
    ["pick-a-side-remastered", 62, "PICK A SIDE"],
    ["i-like-dying-in-my-dreams", 75, "I LIKE DYING IN MY DREAMS"],
    ["dont-wanna-feel-anymore", 60, "DON'T WANNA FEEL ANYMORE"],
    ["perfect_paradisemp3", 53, "PERFECT PARADISE"],
    ["ur-alone-me-too-lol-prod-cupid-yuusef-x-moral", 34, "UR ALONE, ME TOO LOL"],
    ["how-does-it-feel", 36, "HOW DOES IT FEEL"],
    ["the-view-from-halfway-down-prod-myss", 56, "THE VIEW FROM HALFWAY DOWN"],
    ["scars-that-wont-heal", 32, "SCARS THAT WON'T HEAL"],
    ["i-replay-awkward-conversation-moments-in-my-head", 34, "I REPLAY AWKWARD CONVERSATION MOMENTS IN MY HEAD"],
    ["nation-of-sheep-led-by-pigs", 18, "NATION OF SHEEP, LED BY PIGS"],
    ["i-shouldve-stayed-outside", 111, "I SHOULD'VE STAYED OUTSIDE"],
    ["theres-nobody-else-prod-nextime", 20, "THERE'S NOBODY ELSE"],
    ["one-in-a-million-slowed", 61, "ONE IN A MILLION (SLOWED)"],
    ["ur-dead", 45, "UR DEAD"],
  ];

  const ERRORS = {
    NAME_LENGTH: "NAME: 1 TO 24 CHARACTERS.",
    NO_LINKS: "NO LINKS IN NAMES.",
    NO_CONTACT: "NO PHONE NUMBERS OR EMAILS IN NAMES.",
    BLOCKED_WORDS: "TRY A DIFFERENT NAME.",
    BAD_SCORE: "THAT SCORE DIDN'T CHECK OUT.",
    SLOW_DOWN: "ONE SCORE EVERY 20 SECONDS. TRY AGAIN IN A SEC.",
    DAILY_LIMIT: "THAT'S ENOUGH SCORES FOR TODAY.",
  };

  // ── 5 taps on the CD opens it ──
  let taps = 0, tapTimer = 0;
  disc.addEventListener("click", () => {
    taps++; clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { taps = 0; }, 1600);
    if (taps >= 5) { taps = 0; open(); }
  });

  // ── build the screen once, on first open ──
  let root = null, cv, ctx, msgEl, scoreEl, hiEl, overEl, boardEl, startEl, form, nameIn, formMsg, closeBtn, lastFocus = null;
  const $ = (sel, el) => (el || root).querySelector(sel);
  function build() {
    root = document.createElement("div");
    root.className = "snk";
    root.id = "snake";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Disc snake");
    root.innerHTML = `
      <div class="snk-box">
        <div class="snk-top">
          <span class="snk-title">&#9654; DISC SNAKE</span>
          <span class="snk-score">CD <b id="snk-score">0</b></span>
          <span class="snk-hi">HI <b id="snk-hi">&ndash;</b></span>
          <button type="button" class="snk-x" id="snk-close" aria-label="Close">&#10005;</button>
        </div>
        <div class="snk-screen">
          <canvas id="snk-cv" width="${COLS * 16}" height="${ROWS * 16}" aria-label="Game screen"></canvas>
          <div class="snk-card" id="snk-start">
            <p class="snk-big">DISC SNAKE</p>
            <p>EAT THE CDS. THE FIRST ONE STARTS A SONG, EVERY 5 AFTER THAT CHANGE IT.</p>
            <p class="snk-dim">ARROWS / WASD &middot; SWIPE OR USE THE PAD ON PHONES &middot; SPACE PAUSES</p>
            <button type="button" class="btn btn-primary snk-go" data-act="start">&#9654; START</button>
            <ol class="snk-board" id="snk-board-start"></ol>
          </div>
          <div class="snk-card" id="snk-over" hidden>
            <p class="snk-big">GAME OVER</p>
            <p id="snk-final"></p>
            <form id="snk-form" autocomplete="off">
              <label class="snk-dim" for="snk-name">NAME FOR THE LEADERBOARD</label>
              <div class="snk-row">
                <input id="snk-name" maxlength="24" required spellcheck="false" autocapitalize="off">
                <button type="submit" class="btn btn-primary" id="snk-submit">SUBMIT</button>
              </div>
              <p class="snk-dim" id="snk-formmsg" aria-live="polite"></p>
            </form>
            <ol class="snk-board" id="snk-board"></ol>
            <button type="button" class="btn btn-primary snk-go" data-act="start">&#9654; PLAY AGAIN</button>
          </div>
        </div>
        <div class="lcd snk-msg"><span id="snk-msg" aria-live="polite">TAP START</span></div>
        <div class="snk-pad" aria-hidden="true">
          <button type="button" data-dir="up">&#9650;</button>
          <button type="button" data-dir="left">&#9664;</button>
          <button type="button" data-dir="pause">II</button>
          <button type="button" data-dir="right">&#9654;</button>
          <button type="button" data-dir="down">&#9660;</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    cv = $("#snk-cv"); ctx = cv.getContext("2d");
    msgEl = $("#snk-msg"); scoreEl = $("#snk-score"); hiEl = $("#snk-hi");
    startEl = $("#snk-start"); overEl = $("#snk-over"); boardEl = $("#snk-board");
    form = $("#snk-form"); nameIn = $("#snk-name"); formMsg = $("#snk-formmsg"); closeBtn = $("#snk-close");

    closeBtn.addEventListener("click", close);
    root.addEventListener("click", e => { if (e.target === root) close(); });
    root.querySelectorAll('[data-act="start"]').forEach(b => b.addEventListener("click", start));
    root.querySelectorAll(".snk-pad button").forEach(b => b.addEventListener("pointerdown", e => {
      e.preventDefault();
      const d = b.dataset.dir;
      if (d === "pause") togglePause(); else turn(d);
    }));
    form.addEventListener("submit", submitScore);

    // swipes on the screen
    let sx = 0, sy = 0, tracking = false;
    cv.addEventListener("touchstart", e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; tracking = true; }, { passive: true });
    cv.addEventListener("touchmove", e => {
      if (!tracking) return;
      const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
      sx = t.clientX; sy = t.clientY;
    }, { passive: true });
    cv.addEventListener("touchend", () => { tracking = false; });
    try { nameIn.value = localStorage.getItem("yu_snake_name") || ""; } catch (e) {}
  }

  // ── open / close ──
  let isOpen = false;
  function open() {
    if (!root) build();
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;
    // pause the main player so the game's songs don't clash; the visitor resumes it afterwards
    const cd = document.getElementById("cd"), playBtn = document.getElementById("p-play");
    if (cd && cd.classList.contains("playing") && playBtn) playBtn.click();
    root.hidden = false;
    document.documentElement.classList.add("snk-open");
    addEventListener("keydown", onKey, true);
    state = "idle"; showCard(startEl); draw(); say("TAP START");
    loadBoard($("#snk-board-start"));
    initDecks();
    setTimeout(() => $('[data-act="start"]', startEl).focus(), 30);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    stopLoop(); state = "idle";
    root.hidden = true;
    document.documentElement.classList.remove("snk-open");
    removeEventListener("keydown", onKey, true);
    stopMusic();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") togglePause(); });
  function showCard(el) { startEl.hidden = el !== startEl; overEl.hidden = el !== overEl; }
  function say(t) { msgEl.textContent = t; }

  // ── game state ──
  let state = "idle";   // idle | play | pause | over
  let body = [], dir = "right", queue = [], food = null, score = 0, tick = TICK_START, timer = 0;
  let playedMs = 0, lastStamp = 0, best = 0;
  const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPP = { up: "down", down: "up", left: "right", right: "left" };

  function start() {
    const cy = Math.floor(ROWS / 2);
    body = [[6, cy], [5, cy], [4, cy]];
    dir = "right"; queue = []; score = 0; tick = TICK_START; playedMs = 0; submitted = false;
    stopMusic();
    scoreEl.textContent = "0";
    placeFood();
    showCard(null);
    state = "play"; lastStamp = performance.now();
    say("GO");
    stopLoop(); timer = setTimeout(step, tick);
    cv.focus && cv.focus();
  }
  function stopLoop() { clearTimeout(timer); timer = 0; }
  function togglePause() {
    if (state === "play") { state = "pause"; playedMs += performance.now() - lastStamp; stopLoop(); say("PAUSED · SPACE OR II TO GO ON"); draw(); if (live) live.w.pause(); }
    else if (state === "pause") { state = "play"; lastStamp = performance.now(); say("GO"); timer = setTimeout(step, tick); if (live) live.w.play(); }
  }
  function turn(d) {
    if (state === "idle" || state === "over") return;
    if (state === "pause") togglePause();
    const last = queue.length ? queue[queue.length - 1] : dir;
    if (d === last || d === OPP[last] || queue.length >= 2) return;
    queue.push(d);
  }
  function placeFood() {
    const free = [];
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++)
      if (!body.some(([bx, by]) => bx === x && by === y)) free.push([x, y]);
    food = free[Math.floor(Math.random() * free.length)];
  }
  function step() {
    if (state !== "play") return;
    if (queue.length) dir = queue.shift();
    const [vx, vy] = VEC[dir], [hx, hy] = body[0];
    const nx = hx + vx, ny = hy + vy;
    const eats = food && nx === food[0] && ny === food[1];
    const hitsSelf = body.some(([bx, by], i) => bx === nx && by === ny && (eats || i < body.length - 1));
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || hitsSelf) return gameOver();
    body.unshift([nx, ny]);
    if (eats) {
      score++; scoreEl.textContent = String(score);
      tick = Math.max(TICK_MIN, tick - TICK_STEP);
      if ((score - 1) % SONG_EVERY === 0) changeSong(); else say(live ? "CD " + score + " · \u266A " + live.song[2] : "CD " + score);
      placeFood();
    } else body.pop();
    draw();
    timer = setTimeout(step, tick);
  }
  function gameOver() {
    state = "over"; stopLoop();
    playedMs += performance.now() - lastStamp;
    draw(true);
    say(score ? "GAME OVER · " + score + " CD" + (score === 1 ? "" : "S") : "GAME OVER");
    if (score > best) { best = score; if (best > (parseInt(hiEl.textContent, 10) || 0)) hiEl.textContent = String(best); }
    $("#snk-final").textContent = score + " CD" + (score === 1 ? "" : "S") + " EATEN";
    form.hidden = score < 1;
    formMsg.textContent = "";
    $("#snk-submit").disabled = false;
    showCard(overEl);
    loadBoard(boardEl);
    setTimeout(() => (score > 0 ? nameIn : $('[data-act="start"]', overEl)).focus(), 30);
  }

  // ── drawing: red LCD pixels, unlit cells faintly visible ──
  const C = { bg: "#170306", off: "#2a0a10", on: "#ff4a5f", head: "#ffd0d6", cd: "#e9ecef", hole: "#170306" };
  function draw(dead) {
    const s = 16;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = C.off;
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) ctx.fillRect(x * s + 6, y * s + 6, 4, 4);
    if (food) {   // a tiny CD: silver disc with a hole
      const cx = food[0] * s + s / 2, cy = food[1] * s + s / 2;
      ctx.fillStyle = C.cd; ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#b9bec4"; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.hole; ctx.beginPath(); ctx.arc(cx, cy, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowColor = "rgba(255,74,95,0.7)"; ctx.shadowBlur = 6;
    body.forEach(([x, y], i) => {
      ctx.fillStyle = i === 0 ? (dead ? C.on : C.head) : C.on;
      ctx.globalAlpha = dead && i ? 0.55 : 1;
      ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    if (state === "pause") {
      ctx.fillStyle = "rgba(23,3,6,0.6)"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = C.on; ctx.font = "28px VT323, monospace"; ctx.textAlign = "center";
      ctx.fillText("PAUSED", cv.width / 2, cv.height / 2 + 8);
    }
  }

  // ── keys: only while the game is open ──
  function onKey(e) {
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); close(); return; }
    if (e.target === nameIn) return;   // typing a name
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };
    if (map[k]) { e.preventDefault(); if (state === "idle") start(); turn(map[k]); return; }
    if (k === " ") { e.preventDefault(); if (state === "idle" || state === "over") start(); else togglePause(); }
  }

  // ── soundtrack: two hidden SoundCloud players take turns ──
  // The next song is always waiting in the spare player. When it's due, the spare starts muted,
  // jumps to the song's loudest section, unmutes, and the old song stops, so there's no gap.
  // Some phones block sound started this way; the display still shows the title.
  const SC_OPTS = { auto_play: false, visual: false, show_artwork: false, show_comments: false, show_user: false,
                    show_reposts: false, show_teaser: false, hide_related: true, buying: false, sharing: false, download: false };
  const scUrl = song => "https://soundcloud.com/yuu_sef/" + song[0];
  let decks = [], live = null, order = [], pending = false;
  function nextSong() {
    if (!order.length) order = SNIPS.slice().sort(() => Math.random() - 0.5);
    return order.pop();
  }
  function volume() {
    try { const v = parseInt(localStorage.getItem("yu_vol"), 10); if (v >= 0 && v <= 100) return Math.max(v, 40); } catch (e) {}
    return 80;
  }
  function initDecks() {
    if (decks.length) return;
    const go = () => { decks = [makeDeck(nextSong()), makeDeck(nextSong())]; };
    if (window.SC && SC.Widget) go();
    else {
      const s = document.createElement("script");
      s.src = "https://w.soundcloud.com/player/api.js"; s.async = true; s.onload = go;
      document.head.appendChild(s);
    }
  }
  function makeDeck(song) {
    const host = document.createElement("div");
    host.className = "snk-sc";
    const f = document.createElement("iframe");
    f.allow = "autoplay"; f.title = "game soundtrack"; f.tabIndex = -1;
    f.src = "https://w.soundcloud.com/player/?url=" + encodeURIComponent(scUrl(song)) + "&" +
            Object.entries(SC_OPTS).map(([k, v]) => k + "=" + v).join("&");
    host.appendChild(f); document.body.appendChild(host);
    const d = { w: SC.Widget(f), song, ready: false, phase: "idle", used: false, timer: 0 };   // phase: idle | starting | on
    const E = SC.Widget.Events;
    d.w.bind(E.READY, () => { d.ready = true; if (pending) changeSong(); });
    d.w.bind(E.PLAY, () => { if (d.phase === "starting") d.w.seekTo(d.song[1] * 1000); });
    d.w.bind(E.PLAY_PROGRESS, ev => {
      if (d.phase !== "starting" || ev.currentPosition < d.song[1] * 1000 - 400) return;
      clearTimeout(d.timer);
      d.phase = "on"; d.used = true;
      d.w.setVolume(volume());
      if (live && live !== d) quiet(live);
      live = d;
      const other = decks.find(x => x !== d);
      if (other && other.used) reload(other);
    });
    return d;
  }
  function quiet(d) {
    clearTimeout(d.timer);
    try { d.w.pause(); d.w.setVolume(0); } catch (e) {}
    d.phase = "idle";
  }
  function reload(d) {
    d.ready = false; d.used = false; d.song = nextSong();
    d.w.load(scUrl(d.song), Object.assign({}, SC_OPTS, { callback: () => { d.ready = true; if (pending) changeSong(); } }));
  }
  function changeSong() {
    const spare = decks.find(d => d !== live && d.ready && !d.used && d.phase === "idle");
    if (!spare || state !== "play") { pending = !!decks.length && state === "play"; say("CD " + score); return; }
    pending = false;
    say("CD " + score + " · \u266A " + spare.song[2]);
    spare.phase = "starting";
    spare.w.setVolume(0);
    spare.w.play();
    spare.timer = setTimeout(() => { if (spare.phase === "starting") quiet(spare); }, 6000);   // blocked or slow: keep the old song
  }
  function stopMusic() {
    pending = false;
    decks.forEach(quiet);
    if (live) { const old = live; live = null; reload(old); }
  }

  // ── leaderboard ──
  let submitted = false, myId = null;
  async function call(path, opts) {
    const r = await fetch(API + path, Object.assign({ headers: H, cache: "no-store" }, opts));
    const txt = await r.text();
    let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (!r.ok) { const m = data && (data.message || data.hint) || ""; const err = new Error(m); err.code = (m.match(/[A-Z_]{5,}/) || [""])[0]; throw err; }
    return data;
  }
  async function loadBoard(el) {
    el.innerHTML = '<li class="snk-dim">LOADING HI-SCORES…</li>';
    try {
      const rows = await call("/snake_scores?select=id,name,score&order=score.desc,created_at.asc&limit=10");
      el.innerHTML = "";
      if (!rows || !rows.length) { el.innerHTML = '<li class="snk-dim">NO SCORES YET. BE THE FIRST.</li>'; return; }
      hiEl.textContent = String(Math.max(best, rows[0].score));
      rows.forEach((r, i) => {
        const li = document.createElement("li");
        if (r.id === myId) li.className = "me";
        const n = document.createElement("span"); n.textContent = String(i + 1).padStart(2, "0") + " " + r.name.toUpperCase();
        const s = document.createElement("b"); s.textContent = String(r.score);
        li.append(n, s); el.appendChild(li);
      });
    } catch (e) {
      el.innerHTML = '<li class="snk-dim">HI-SCORES WON\'T LOAD RIGHT NOW.</li>';
    }
  }
  async function submitScore(e) {
    e.preventDefault();
    if (submitted || score < 1) return;
    const name = nameIn.value.trim().replace(/\s+/g, " ");
    if (!name) { formMsg.textContent = ERRORS.NAME_LENGTH; return; }
    const btn = $("#snk-submit"); btn.disabled = true; formMsg.textContent = "SENDING…";
    try {
      const res = await call("/rpc/submit_score", { method: "POST", body: JSON.stringify({ p_name: name.slice(0, 24), p_score: score, p_ms: Math.round(playedMs) }) });
      const row = Array.isArray(res) ? res[0] : res;
      submitted = true; myId = row && row.score_id;
      try { localStorage.setItem("yu_snake_name", name); } catch (err) {}
      formMsg.textContent = row && row.score_rank ? "SAVED · YOU'RE #" + row.score_rank : "SAVED";
      loadBoard(boardEl);
    } catch (err) {
      btn.disabled = false;
      formMsg.textContent = ERRORS[err.code] || "COULDN'T SAVE THAT. TRY AGAIN.";
    }
  }
})();
