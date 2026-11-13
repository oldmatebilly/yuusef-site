// ── Guestbook: notes pinned instantly, word filter on the database (Supabase) ──
// The publishable key is meant to be public; the database only lets visitors read
// visible notes and post or remove through the pin_note / remove_note functions.
(function guestbook() {
  const API = "https://mdpmfgewfelvvumldtrh.supabase.co/rest/v1";
  const KEY = "sb_publishable_ELUfzX1gFHSOnBcsI0r3yA_0LFmnopH";
  const H = { apikey: KEY, "Content-Type": "application/json" };
  if (KEY.startsWith("eyJ")) H.Authorization = "Bearer " + KEY;

  const $ = id => document.getElementById(id);
  const form = $("gb-form");
  if (!form) return;
  const text = $("gb-text"), nameIn = $("gb-name"), msg = $("gb-msg"), chars = $("gb-chars");
  const wall = $("wall"), more = $("gb-more"), count = $("gb-count"), pinBtn = $("gb-pin");
  const COLOURS = ["bone", "blood", "chrome", "xerox", "pink", "cyan", "yellow", "lilac", "orange", "lime"];
  const PAGE = 20;
  let notes = [], shown = PAGE, busy = false, loaded = false, failed = false;

  // keys for notes this browser pinned, so the visitor can take their own down
  const KEYS_LS = "yu_notes";
  const readKeys = () => { try { return JSON.parse(localStorage.getItem(KEYS_LS)) || {}; } catch (e) { return {}; } };
  const writeKeys = k => { try { localStorage.setItem(KEYS_LS, JSON.stringify(k)); } catch (e) {} };
  let myKeys = readKeys();

  const say = (t, kind) => { msg.textContent = t; msg.className = "gb-msg" + (kind ? " " + kind : ""); };
  text.addEventListener("input", () => { chars.textContent = text.value.length + " / 200"; });

  // quick checks in the browser for instant feedback; the database checks everything again
  const hasLink = t => /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|xyz|gg|ly|me|app|link)\b)/i.test(t);
  const hasContact = t => /\d[\d\s().-]{7,}\d/.test(t) || /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t);

  const ERRORS = {
    NOTE_LENGTH: "WRITE BETWEEN 2 AND 200 CHARACTERS.",
    NAME_LENGTH: "KEEP YOUR NAME UNDER 24 CHARACTERS.",
    NO_LINKS: "NO LINKS ON THE WALL, SORRY.",
    NO_CONTACT: "KEEP PHONE NUMBERS AND EMAILS OFF THE WALL.",
    BLOCKED_WORDS: "THAT NOTE HAS WORDS THAT DON'T GET PINNED HERE. TRY REWORDING IT.",
    SLOW_DOWN: "ONE NOTE A MINUTE. GIVE IT A SEC.",
    DAILY_LIMIT: "THAT'S YOUR NOTES FOR TODAY. COME BACK TOMORROW.",
    WALL_BUSY: "THE WALL IS BUSY RIGHT NOW. TRY AGAIN IN A BIT."
  };

  const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };
  const ago = iso => {
    const ms = Date.parse(iso);
    const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
    if (s < 60) return "JUST NOW"; const m = Math.floor(s / 60); if (m < 60) return m + "M AGO";
    const h = Math.floor(m / 60); if (h < 24) return h + "H AGO"; const d = Math.floor(h / 24);
    if (d < 30) return d + "D AGO";
    return new Date(ms).toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, ".");
  };

  async function call(path, opts) {
    const r = await fetch(API + path, Object.assign({ headers: H, cache: "no-store" }, opts));
    let body = null; try { body = await r.json(); } catch (e) {}
    if (!r.ok) { const e = new Error((body && body.message) || ("HTTP " + r.status)); e.status = r.status; throw e; }
    return body;
  }

  function render() {
    wall.replaceChildren();
    count.textContent = notes.length
      ? notes.length + (notes.length === 1 ? " NOTE ON THE WALL" : " NOTES ON THE WALL")
      : "PIN A NOTE TO THE WALL";
    if (!notes.length) {
      const p = document.createElement("p"); p.className = "wall-empty";
      p.textContent = failed ? "THE WALL WON'T LOAD RIGHT NOW. TRY AGAIN SOON."
        : loaded ? "THE WALL IS EMPTY. BE THE FIRST TO PIN A NOTE." : "LOADING THE WALL…";
      wall.appendChild(p); more.hidden = true; return;
    }
    notes.slice(0, shown).forEach(n => {
      const el = document.createElement("article");
      const mine = !!myKeys[n.id];
      el.className = "note " + (COLOURS.includes(n.color) ? n.color : "bone") + (mine ? " mine" : "");
      el.style.setProperty("--tilt", ((hash(n.id) % 50) / 10) + "deg");
      const p = document.createElement("p"); p.className = "note-text"; p.textContent = n.text;
      const foot = document.createElement("div"); foot.className = "note-foot";
      const who = document.createElement("span"); who.className = "note-name"; who.textContent = "— " + (n.name || "anon");
      const when = document.createElement("span"); when.textContent = ago(n.created_at);
      foot.append(who, when); el.append(p, foot);
      if (mine) {
        const del = document.createElement("button");
        del.type = "button"; del.className = "note-del"; del.textContent = "✕";
        del.setAttribute("aria-label", "Remove your note");
        del.addEventListener("click", () => {
          if (!del.classList.contains("armed")) {   // two-step confirm, no browser dialogs
            del.classList.add("armed"); del.textContent = "REMOVE?";
            setTimeout(() => { del.classList.remove("armed"); del.textContent = "✕"; }, 3000);
            return;
          }
          removeNote(n);
        });
        el.appendChild(del);
      }
      wall.appendChild(el);
    });
    more.hidden = notes.length <= shown;
  }
  more.addEventListener("click", () => { shown += PAGE; render(); });

  async function load() {
    try {
      const rows = await call("/notes?select=id,created_at,text,name,color&order=created_at.desc&limit=200");
      notes = Array.isArray(rows) ? rows.filter(n => n && typeof n.text === "string") : [];
      loaded = true; failed = false;
      // forget keys for notes that are gone
      const ids = new Set(notes.map(n => n.id)); let changed = false;
      Object.keys(myKeys).forEach(id => { if (!ids.has(id) && notes.length < 200) { delete myKeys[id]; changed = true; } });
      if (changed) writeKeys(myKeys);
    } catch (e) { if (!loaded) failed = true; }
    render();
  }

  async function removeNote(n) {
    if (busy) return; busy = true;
    try {
      const ok = await call("/rpc/remove_note", { method: "POST", body: JSON.stringify({ p_id: n.id, p_token: myKeys[n.id] }) });
      if (ok === true) {
        delete myKeys[n.id]; writeKeys(myKeys);
        notes = notes.filter(x => x.id !== n.id); render(); say("NOTE REMOVED.", "ok");
      } else say("COULDN'T REMOVE THAT NOTE.", "err");
    } catch (e) { say("COULDN'T REMOVE THAT NOTE. TRY AGAIN IN A MOMENT.", "err"); }
    busy = false;
  }

  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    if (busy) return;
    const body = text.value.trim().replace(/\n{3,}/g, "\n\n");
    const name = nameIn.value.trim().slice(0, 24);
    if (body.length < 2) return say("WRITE A FEW WORDS FIRST.", "err");
    if (hasLink(body) || hasLink(name)) return say(ERRORS.NO_LINKS, "err");
    if (hasContact(body) || hasContact(name)) return say(ERRORS.NO_CONTACT, "err");
    busy = true; pinBtn.disabled = true; say("PINNING…");
    const color = (form.querySelector('input[name="gb-color"]:checked') || {}).value || "bone";
    try {
      const res = await call("/rpc/pin_note", { method: "POST", body: JSON.stringify({ p_text: body.slice(0, 200), p_name: name, p_color: color }) });
      const row = Array.isArray(res) ? res[0] : res;
      if (row && row.note_id) {
        myKeys[row.note_id] = row.note_token; writeKeys(myKeys);
        notes.unshift({ id: row.note_id, created_at: new Date().toISOString(), text: body.slice(0, 200), name, color });
      }
      text.value = ""; chars.textContent = "0 / 200"; render();
      say("PINNED. THANKS FOR STOPPING BY.", "ok");
    } catch (e) {
      const code = Object.keys(ERRORS).find(k => (e.message || "").includes(k));
      say(code ? ERRORS[code] : "COULDN'T PIN THAT. TRY AGAIN IN A MOMENT.", "err");
    }
    busy = false; pinBtn.disabled = false;
  });

  // load when the wall gets near the screen, then refresh every 30s while it's in view
  let timer = null;
  const sec = document.getElementById("guestbook");
  const start = () => { if (!timer) { load(); timer = setInterval(() => { if (!document.hidden) load(); }, 30000); } };
  const stop = () => { clearInterval(timer); timer = null; };
  render();
  if ("IntersectionObserver" in window && sec) {
    new IntersectionObserver(([e]) => { e.isIntersecting ? start() : stop(); }, { rootMargin: "400px 0px" }).observe(sec);
  } else start();
})();
