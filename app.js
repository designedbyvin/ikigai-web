(() => {
  const MOODS = [["joyful","Joyful"],["grateful","Grateful"],["calm","Calm"],["okay","Okay"],["tired","Tired"],["anxious","Anxious"],["sad","Sad"]];
  const MOOD_LABEL = Object.fromEntries(MOODS);
  const SCENE = {
    where: ["Home", "Work", "Café", "Outdoors", "On the road", "At the beach", "Travelling"],
    who: ["Alone", "Family", "Friends", "Partner", "Coworkers", "New people"],
    weather: ["Sunny", "Hot", "Cloudy", "Rainy", "Stormy", "Breezy", "Cool"]
  };
  const PROMPTS = {
    any: ["What made you smile today, even a little?","What's been taking up space in your head lately?","Describe one small moment you want to remember.","What would make tomorrow feel lighter?","Who did you think about today, and why?","What are you proud of this week?","If today had a soundtrack, what would play?","What do you need more of right now?"],
    joyful: ["What sparked this good feeling? Hold onto the details.","Who would you love to share today with?"],
    grateful: ["List three things you're thankful for, big or tiny.","Who made your day better without knowing it?"],
    calm: ["Where did you feel most at peace today?","What helped you slow down?"],
    okay: ["What's one thing that went right today?","What would turn an okay day into a good one?"],
    tired: ["What drained you today? What could refill you?","What can you let go of tonight?"],
    anxious: ["Write down what's worrying you. Which parts can you control?","What would you tell a friend feeling this way?"],
    sad: ["What's weighing on you? You can say it here.","What's one gentle thing you can do for yourself tonight?"]
  };
  const STARTERS = [
    "The moment I knew today would be different was when",
    "I didn't expect to",
    "Today started with",
    "If I could replay one part of today, it would be",
    "Someone said something that stuck with me:",
    "The funniest thing that happened was",
    "I kept thinking about",
    "On the way home, I noticed",
    "I wish I had said",
    "Right now, as I write this,",
    "The best thing I ate today was",
    "Something small that made me happy:",
    "A year from now, I want to remember that",
    "I surprised myself when"
  ];
  const MILESTONES = [100, 250, 500, 1000, 2000];
  const MS_TEXT = { 100: "100 words. You're warmed up.", 250: "250 words. That's a real story now.", 500: "500 words today. Lovely.", 1000: "1,000 words. A whole chapter.", 2000: "2,000 words. You had a lot to say." };

  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, "0");
  const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const fromKey = k => { const [y,m,d] = k.split("-").map(Number); return new Date(y, m-1, d); };
  const todayKey = () => keyOf(new Date());
  const shift = (k, n) => { const d = fromKey(k); d.setDate(d.getDate()+n); return keyOf(d); };
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const moodColor = m => m ? `var(--m-${m})` : "var(--soft)";
  const words = s => (String(s || "").trim().match(/\S+/g) || []).length;
  const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  // ---- Storage: IndexedDB with in-memory fallback ----
  let db = null; const mem = new Map();
  const openDB = () => new Promise(res => {
    try {
      const r = indexedDB.open("quiet-pages", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("entries", { keyPath: "date" });
      r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
  const tx = (mode, fn) => new Promise((res, rej) => {
    try { const t = db.transaction("entries", mode); const r = fn(t.objectStore("entries")); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }
    catch (e) { rej(e); }
  });
  const getAll = async () => { if (!db) return [...mem.values()]; try { return await tx("readonly", s => s.getAll()) || []; } catch (e) { return [...mem.values()]; } };
  const put = async e => { mem.set(e.date, e); if (db) try { await tx("readwrite", s => s.put(e)); } catch (x) {} };
  const remove = async d => { mem.delete(d); if (db) try { await tx("readwrite", s => s.delete(d)); } catch (x) {} };

  // ---- State ----
  let entries = new Map();
  let current = todayKey(), calSel = todayKey();
  let view = new Date(); view.setDate(1);
  let calMode = "month", yearView = new Date().getFullYear();
  let mood = null, scene = { where: null, who: [], weather: null };
  let promptIdx = 0, saveTimer = null, activeView = "write", msShown = new Set();
  const isRO = () => current !== todayKey();

  // ---- Toast ----
  let toastT;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800); }

  // ---- Navigation ----
  const VIEWS = ["write", "calendar", "pages"];
  function go(v, push = true) {
    if (!VIEWS.includes(v)) v = "write";
    if (activeView === "write" && v !== "write") flush();
    if (v !== "write" && document.body.classList.contains("focus")) exitFocus();
    activeView = v;
    VIEWS.forEach(n => { const el = $("v-" + n); el.hidden = n !== v; if (n === v) { el.classList.remove("view-anim"); void el.offsetWidth; el.classList.add("view-anim"); } });
    document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-current", t.dataset.view === v ? "page" : "false"));
    if (v === "calendar") { calSel = current; const d = fromKey(calSel); view = new Date(d.getFullYear(), d.getMonth(), 1); yearView = d.getFullYear(); renderCal(); }
    if (v === "pages") renderList();
    if (push) { try { history.replaceState(null, "", "#" + v); } catch (e) {} }
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll(".tab").forEach(t => t.onclick = () => go(t.dataset.view));

  // ---- Mood chips ----
  MOODS.forEach(([id, label]) => {
    const b = document.createElement("button");
    b.className = "mood"; b.type = "button"; b.dataset.mood = id; b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<span class="sw" style="background:var(--m-${id})"></span>${label}`;
    b.onclick = () => { if (isRO()) return; mood = mood === id ? null : id; paintMoods(); nextPrompt(true); queueSave(); };
    $("moods").appendChild(b);
  });
  const paintMoods = () => document.querySelectorAll(".mood").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mood === mood)));
  function nextPrompt(fromMood) {
    const list = mood && fromMood ? PROMPTS[mood] : (mood ? [...PROMPTS[mood], ...PROMPTS.any] : PROMPTS.any);
    promptIdx = (promptIdx + 1 + Math.floor(Math.random() * Math.max(1, list.length - 1))) % list.length;
    $("promptText").textContent = list[promptIdx];
  }
  $("newPrompt").onclick = () => nextPrompt(false);

  // ---- Scene ----
  Object.entries(SCENE).forEach(([kind, opts]) => {
    const box = $("sc-" + kind);
    opts.forEach(o => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip-btn"; b.textContent = o; b.dataset.v = o; b.setAttribute("aria-pressed", "false");
      b.onclick = () => {
        if (isRO()) return;
        if (kind === "who") {
          if (o === "Alone") scene.who = scene.who.includes("Alone") ? [] : ["Alone"];
          else { scene.who = scene.who.filter(x => x !== "Alone"); scene.who = scene.who.includes(o) ? scene.who.filter(x => x !== o) : [...scene.who, o]; }
        } else scene[kind] = scene[kind] === o ? null : o;
        paintScene(); queueSave();
      };
      box.appendChild(b);
    });
  });
  function sceneText(s) {
    if (!s) return "";
    const parts = [];
    if (s.where) parts.push(s.where === "On the road" || s.where.startsWith("At ") || s.where === "Travelling" || s.where === "Outdoors" ? s.where : (s.where === "Home" ? "At home" : "At " + s.where.toLowerCase()));
    if (s.who && s.who.length) parts.push(s.who.includes("Alone") ? "Alone" : "With " + s.who.map(w => w.toLowerCase()).join(", "));
    if (s.weather) parts.push(s.weather);
    return parts.join(" · ");
  }
  function paintScene() {
    ["where", "weather"].forEach(k => $("sc-" + k).querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === scene[k]))));
    $("sc-who").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(scene.who.includes(b.dataset.v))));
    const t = sceneText(scene);
    $("sceneSum").textContent = t || "Set the scene: where, who with, what weather";
    $("sceneSum").classList.toggle("empty", !t);
  }

  // ---- Story starters ----
  let starterPool = shuffle(STARTERS), starterAt = 0;
  function renderStarters() {
    const box = $("starters"); box.innerHTML = `<span class="lbl">Start with</span>`;
    for (let i = 0; i < 3; i++) {
      const s = starterPool[(starterAt + i) % starterPool.length];
      const b = document.createElement("button"); b.type = "button"; b.className = "starter"; b.textContent = s + "…";
      b.onclick = () => insertStarter(s);
      box.appendChild(b);
    }
    const more = document.createElement("button"); more.className = "icon-btn"; more.type = "button"; more.title = "More starters"; more.setAttribute("aria-label", "More starters");
    more.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M13 8a5 5 0 11-1.5-3.5M13 2.5v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    more.onclick = () => { starterAt = (starterAt + 3) % starterPool.length; renderStarters(); };
    box.appendChild(more);
  }
  function insertStarter(s) {
    if (isRO()) return;
    const t = $("body"); const v = t.value;
    const sep = !v.trim() ? "" : (v.endsWith("\n\n") ? "" : v.endsWith("\n") ? "\n" : "\n\n");
    t.value = v + sep + s + " ";
    t.focus(); t.setSelectionRange(t.value.length, t.value.length);
    t.scrollTop = t.scrollHeight;
    updateCount(); queueSave();
  }

  // ---- Write view ----
  function greeting(k) {
    const tk = todayKey();
    if (k === shift(tk, -1)) return `Yesterday. <em>Here's how it felt.</em>`;
    if (k !== tk) return `Looking back. <em>Here's how that day felt.</em>`;
    const h = new Date().getHours();
    const part = h < 5 ? "Still up?" : h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
    return `${part} <em>How are you feeling today?</em>`;
  }
  function openDay(k) {
    flush();
    current = k; const e = entries.get(k); const ro = isRO();
    $("when").textContent = fromKey(k).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    $("greet").innerHTML = greeting(k);
    $("title").value = e ? e.title || "" : ""; $("body").value = e ? e.body || "" : ""; $("highlight").value = e ? e.highlight || "" : "";
    mood = e ? e.mood : null; paintMoods(); nextPrompt(!!mood);
    scene = e && e.scene ? { where: e.scene.where || null, who: [...(e.scene.who || [])], weather: e.scene.weather || null } : { where: null, who: [], weather: null };
    paintScene();
    // milestones already passed don't re-celebrate
    msShown = new Set(MILESTONES.filter(m => words($("body").value) >= m).map(m => k + ":" + m));

    $("pageCard").classList.toggle("ro", ro);
    ["title", "body", "highlight"].forEach(id => $(id).readOnly = ro);
    $("title").placeholder = ro ? "Untitled page" : "Give today a title";
    $("body").placeholder = ro ? "" : "Start anywhere. No one is reading but you…";
    $("promptBox").hidden = ro; $("starters").hidden = ro; $("focusBtn").hidden = ro;
    $("scene").hidden = ro;
    const st = sceneText(scene);
    $("roScene").hidden = !(ro && st);
    $("roScene").innerHTML = st ? st.split(" · ").map(p => `<span>${esc(p)}</span>`).join("") : "";
    $("moods").hidden = ro && !(e && e.mood);
    $("hlBox").hidden = ro && !(e && e.highlight);
    $("title").hidden = $("body").hidden = ro && !e;
    $("pastEmpty").hidden = !(ro && !e);
    $("pageFoot").hidden = ro && !e;
    if (ro) {
      setStatus("Read only", false); $("status").classList.add("ro");
      requestAnimationFrame(() => { const t = $("body"); t.style.height = "auto"; t.style.height = Math.max(96, t.scrollHeight) + "px"; });
    } else {
      $("status").classList.remove("ro"); $("body").style.height = "";
      setStatus(e ? `Saved ${new Date(e.updated).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "Saves automatically", false);
    }
    $("nextD").disabled = k >= todayKey();
    resetDelete(); updateCount(); renderNudge();
    go("write");
    if (!ro) $("body").focus({ preventScroll: true });
  }
  $("prevD").onclick = () => openDay(shift(current, -1));
  $("nextD").onclick = () => { if (current < todayKey()) openDay(shift(current, 1)); };
  $("toToday").onclick = () => openDay(todayKey());

  function updateCount() {
    const w = words($("body").value);
    const txt = `${w.toLocaleString()} ${w === 1 ? "word" : "words"}`;
    $("count").textContent = txt; $("focusWc").textContent = txt;
    const del = $("del"); if (del) del.hidden = !entries.has(current);
    if (!isRO()) for (const m of MILESTONES) {
      const id = current + ":" + m;
      if (w >= m && !msShown.has(id)) { msShown.add(id); toast(MS_TEXT[m]); }
    }
  }
  function setStatus(t, saving) { $("statusText").textContent = t; $("status").classList.toggle("saving", !!saving); }
  function settle() { const s = $("status"); s.classList.remove("settle"); void s.offsetWidth; s.classList.add("settle"); }
  function queueSave() { if (isRO() && !saveTimer) return; setStatus("Saving…", true); clearTimeout(saveTimer); saveTimer = setTimeout(save, 600); }
  function flush() { if (saveTimer) { clearTimeout(saveTimer); save(); } }
  const sceneEmpty = s => !s.where && !s.weather && !(s.who && s.who.length);
  async function save() {
    saveTimer = null;
    const k = current, title = $("title").value, body = $("body").value, highlight = $("highlight").value;
    if (!title.trim() && !body.trim() && !highlight.trim() && !mood && sceneEmpty(scene)) {
      if (entries.has(k)) { entries.delete(k); await remove(k); }
      setStatus("Saves automatically", false);
    } else {
      const prev = entries.get(k);
      const entry = { date: k, title, highlight, body, mood, scene: { ...scene, who: [...scene.who] }, created: prev ? prev.created : Date.now(), updated: Date.now() };
      entries.set(k, entry); await put(entry);
      setStatus(`Saved ${new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`, false);
      settle();
    }
    updateCount(); renderNudge();
  }
  ["title", "highlight"].forEach(id => $(id).addEventListener("input", queueSave));
  $("body").addEventListener("input", () => { updateCount(); queueSave(); });
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); else if (activeView === "write") renderNudge(); });
  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (activeView === "write" && !isRO()) { clearTimeout(saveTimer); save(); } }
    if (e.key === "Escape" && document.body.classList.contains("focus")) exitFocus();
  });

  function resetDelete() {
    $("delWrap").innerHTML = `<button class="del" id="del" ${entries.has(current) ? "" : "hidden"}>Delete this page</button>`;
    $("del").onclick = () => {
      $("delWrap").innerHTML = `<span class="confirm">Delete for good? <button class="yes" id="yes">Delete</button><button class="no" id="no">Keep it</button></span>`;
      $("no").onclick = resetDelete;
      $("yes").onclick = async () => {
        clearTimeout(saveTimer); saveTimer = null;
        entries.delete(current); await remove(current);
        if (isRO()) { openDay(current); toast("Page deleted"); return; }
        $("title").value = ""; $("body").value = ""; $("highlight").value = "";
        mood = null; paintMoods(); scene = { where: null, who: [], weather: null }; paintScene();
        setStatus("Page deleted", false); resetDelete(); updateCount(); renderNudge();
      };
    };
  }

  // ---- Evening nudge ----
  function renderNudge() {
    const empty = !entries.has(todayKey());
    $("nudge").hidden = !(current === todayKey() && empty && new Date().getHours() >= 19);
  }

  // ---- On this day ----
  function renderOTD() {
    if (current !== todayKey()) { $("otd").hidden = true; return; }
    const t = fromKey(current);
    const monthAgo = new Date(t.getFullYear(), t.getMonth() - 1, t.getDate());
    const yearAgo = new Date(t.getFullYear() - 1, t.getMonth(), t.getDate());
    const picks = [["A week ago", shift(current, -7)]];
    if (monthAgo.getDate() === t.getDate()) picks.push(["A month ago", keyOf(monthAgo)]);
    if (yearAgo.getDate() === t.getDate()) picks.push(["A year ago", keyOf(yearAgo)]);
    for (let y = 2; y <= 5; y++) { const d = new Date(t.getFullYear() - y, t.getMonth(), t.getDate()); if (d.getDate() === t.getDate()) picks.push([`${y} years ago`, keyOf(d)]); }
    const found = picks.filter(([, k]) => entries.has(k));
    $("otd").hidden = !found.length;
    $("otdList").innerHTML = "";
    found.forEach(([label, k]) => {
      const e = entries.get(k);
      const b = document.createElement("button"); b.className = "otd-card"; b.type = "button";
      b.innerHTML = `<span class="when"><i class="sw sm" style="background:${moodColor(e.mood)}"></i>${label} · ${fromKey(k).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        <b>${esc(e.highlight || e.title || "Untitled page")}</b><p>${esc((e.body || "").trim() || (e.mood ? "Felt " + MOOD_LABEL[e.mood].toLowerCase() + "." : ""))}</p>`;
      b.onclick = () => openDay(k);
      $("otdList").appendChild(b);
    });
  }

  // ---- Focus mode + ambient sound ----
  let actx = null, sound = null;
  function noiseBuffer(type) {
    const len = actx.sampleRate * 4, buf = actx.createBuffer(2, len, actx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (type === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
      }
    }
    return buf;
  }
  function stopSound() { if (sound) { sound.stop(); sound = null; } }
  function playSound(kind) {
    stopSound();
    if (kind === "off") return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      actx.resume();
      const out = actx.createGain(); out.gain.value = 0; out.connect(actx.destination);
      out.gain.linearRampToValueAtTime(1, actx.currentTime + 1.5);
      const nodes = []; let timer = null;
      if (kind === "rain") {
        const src = actx.createBufferSource(); src.buffer = noiseBuffer("white"); src.loop = true;
        const hp = actx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 600;
        const lp = actx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5500;
        const g = actx.createGain(); g.gain.value = 0.12;
        const lfo = actx.createOscillator(); lfo.frequency.value = 0.08; const lfoG = actx.createGain(); lfoG.gain.value = 0.04;
        lfo.connect(lfoG); lfoG.connect(g.gain); lfo.start();
        src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); src.start();
        const low = actx.createBufferSource(); low.buffer = noiseBuffer("brown"); low.loop = true;
        const lg = actx.createGain(); lg.gain.value = 0.25; low.connect(lg); lg.connect(out); low.start();
        nodes.push(src, lfo, low);
      } else {
        const src = actx.createBufferSource(); src.buffer = noiseBuffer("brown"); src.loop = true;
        const lp = actx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
        const g = actx.createGain(); g.gain.value = 0.45;
        src.connect(lp); lp.connect(g); g.connect(out); src.start(); nodes.push(src);
        const clink = () => {
          const o = actx.createOscillator(), og = actx.createGain(), t = actx.currentTime;
          o.type = "sine"; o.frequency.value = 2200 + Math.random() * 1600;
          og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.025, t + 0.005); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
          o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.7);
          timer = setTimeout(clink, 2500 + Math.random() * 6000);
        };
        timer = setTimeout(clink, 1800);
      }
      sound = { stop: () => { clearTimeout(timer); const t = actx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + 0.5); setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch (e) {} }); out.disconnect(); }, 600); } };
    } catch (e) { toast("Sound isn't available in this browser."); }
  }
  document.querySelectorAll("[data-snd]").forEach(b => b.onclick = () => {
    document.querySelectorAll("[data-snd]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    playSound(b.dataset.snd);
  });
  function enterFocus() {
    if (isRO()) return;
    document.body.classList.add("focus"); $("focusBar").hidden = false; $("focusWc").hidden = false;
    window.scrollTo({ top: 0 }); $("body").focus({ preventScroll: true });
    try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
  }
  function exitFocus() {
    document.body.classList.remove("focus"); $("focusBar").hidden = true; $("focusWc").hidden = true;
    stopSound(); document.querySelectorAll("[data-snd]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.snd === "off")));
    try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {}
  }
  $("focusBtn").onclick = enterFocus;
  $("exitFocus").onclick = exitFocus;

  // ---- Calendar view ----
  ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d => { const s = document.createElement("span"); s.className = "dow"; s.textContent = d.slice(0, 1); s.title = d; $("dows").appendChild(s); });
  $("legend").innerHTML = MOODS.map(([id, l]) => `<span><i class="sw sm" style="background:var(--m-${id})"></i>${l}</span>`).join("");
  function streak() {
    // Forgiving: one missed day is a rest day; two missed in a row ends the streak. Today doesn't count as missed yet.
    let k = entries.has(todayKey()) ? todayKey() : shift(todayKey(), -1), n = 0, miss = 0, guard = 0;
    while (guard++ < 4000) {
      if (entries.has(k)) { n++; miss = 0; }
      else { miss++; if (miss >= 2) break; }
      k = shift(k, -1);
    }
    return n;
  }
  function setMode(m) {
    calMode = m;
    $("modeMonth").setAttribute("aria-pressed", String(m === "month")); $("modeYear").setAttribute("aria-pressed", String(m === "year"));
    renderCal();
  }
  $("modeMonth").onclick = () => setMode("month");
  $("modeYear").onclick = () => setMode("year");

  function renderCal() {
    const tk = todayKey(), now = new Date();
    $("monthGrid").hidden = calMode !== "month"; $("yearGrid").hidden = calMode !== "year";
    if (calMode === "month") {
      const y = view.getFullYear(), m = view.getMonth();
      $("monthLabel").textContent = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      const start = new Date(y, m, 1 - new Date(y, m, 1).getDay());
      const box = $("days"); box.innerHTML = ""; let count = 0;
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        if (i >= 35 && d.getMonth() !== m) break;
        const k = keyOf(d), e = entries.get(k);
        const b = document.createElement("button");
        b.className = "day"; b.type = "button"; b.textContent = d.getDate();
        if (d.getMonth() !== m) b.classList.add("other");
        if (k === tk) b.classList.add("today");
        if (k === calSel) b.classList.add("sel");
        if (k > tk) b.disabled = true;
        b.setAttribute("aria-label", d.toDateString() + (e ? ", has a page" : ""));
        if (e) {
          b.classList.add("has"); if (d.getMonth() === m) count++;
          const dot = document.createElement("span"); dot.className = "dot"; dot.style.background = moodColor(e.mood); b.appendChild(dot);
        }
        b.onclick = () => { calSel = k; renderCal(); };
        b.ondblclick = () => openDay(k);
        box.appendChild(b);
      }
      $("nextM").disabled = y > now.getFullYear() || (y === now.getFullYear() && m >= now.getMonth());
      $("stMonth").textContent = count; $("stMonthLbl").textContent = "pages this month";
    } else {
      $("monthLabel").textContent = String(yearView);
      const box = $("year"); box.innerHTML = `<span></span>` + Array.from({ length: 31 }, (_, i) => `<span class="dn">${(i + 1) % 5 === 0 || i === 0 ? i + 1 : ""}</span>`).join("");
      let count = 0;
      for (let m = 0; m < 12; m++) {
        const ml = document.createElement("span"); ml.className = "ml"; ml.textContent = new Date(yearView, m, 1).toLocaleDateString(undefined, { month: "short" }); box.appendChild(ml);
        const dim = new Date(yearView, m + 1, 0).getDate();
        for (let d = 1; d <= 31; d++) {
          const b = document.createElement("button"); b.type = "button"; b.className = "px";
          if (d > dim) { b.classList.add("none"); b.disabled = true; b.tabIndex = -1; box.appendChild(b); continue; }
          const k = `${yearView}-${pad(m + 1)}-${pad(d)}`, e = entries.get(k);
          if (k > tk) { b.classList.add("future"); b.disabled = true; b.tabIndex = -1; }
          if (k === tk) b.classList.add("today");
          if (e) { count++; b.style.background = moodColor(e.mood); }
          b.title = fromKey(k).toDateString() + (e ? (e.mood ? " · " + MOOD_LABEL[e.mood] : " · page written") : "");
          b.setAttribute("aria-label", b.title);
          b.onclick = () => { calSel = k; view = new Date(yearView, m, 1); setMode("month"); };
          box.appendChild(b);
        }
      }
      $("nextM").disabled = yearView >= now.getFullYear();
      $("stMonth").textContent = count; $("stMonthLbl").textContent = `pages in ${yearView}`;
    }
    $("stStreak").textContent = streak(); $("stTotal").textContent = entries.size;
    renderPreview(); renderRecap();
  }
  function renderPreview() {
    const card = $("preview");
    if (calMode === "year") { card.hidden = true; return; }
    card.hidden = false;
    const e = entries.get(calSel), d = fromKey(calSel);
    const label = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    const isToday = calSel === todayKey();
    if (e) {
      const w = words(e.body), st = sceneText(e.scene);
      card.innerHTML = `<span class="eyebrow">${esc(label)}</span>
        <h3>${esc(e.title || "Untitled page")}</h3>
        <div class="meta">${e.mood ? `<span class="chip"><i class="sw sm" style="background:var(--m-${e.mood})"></i>${MOOD_LABEL[e.mood]}</span>` : ""}<span>${w} ${w === 1 ? "word" : "words"}</span>${st ? `<span>${esc(st)}</span>` : ""}</div>
        ${e.highlight ? `<p class="hl">★ ${esc(e.highlight)}</p>` : ""}
        <p class="snip">${esc((e.body || "").trim() || "No words yet, just a feeling.")}</p>
        <button class="primary" id="openSel">${isToday ? "Keep writing" : "Read this page"}</button>`;
    } else {
      card.innerHTML = `<span class="eyebrow">${esc(label)}</span>
        <h3>${isToday ? "Today's page is still blank." : "Nothing written this day."}</h3>
        <p class="snip">${isToday ? "Take a few minutes. How are you feeling?" : "This day has passed, so it stays blank. Today's page is still open."}</p>
        <button class="primary" id="openSel">${isToday ? "Start writing" : "Go to today"}</button>`;
    }
    $("openSel").onclick = () => openDay(e || isToday ? calSel : todayKey());
  }
  function renderRecap() {
    const now = new Date();
    let list, title, sub;
    if (calMode === "month") {
      const y = view.getFullYear(), m = view.getMonth(), prefix = `${y}-${pad(m + 1)}`;
      list = [...entries.values()].filter(e => e.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date));
      const isNow = y === now.getFullYear() && m === now.getMonth();
      const name = view.toLocaleDateString(undefined, { month: "long" });
      title = isNow ? `${name} so far` : `${name} recap`;
      sub = "Month in review";
    } else {
      list = [...entries.values()].filter(e => e.date.startsWith(String(yearView))).sort((a, b) => a.date.localeCompare(b.date));
      title = yearView === now.getFullYear() ? `${yearView} so far` : `${yearView} in review`;
      sub = "Year in moods";
    }
    const card = $("recap");
    if (!list.length) { card.innerHTML = `<span class="eyebrow">${sub}</span><h3>${esc(title)}</h3><p class="most">No pages here yet. The recap fills in as you write.</p>`; return; }
    const totalW = list.reduce((s, e) => s + words(e.body), 0);
    const longest = list.reduce((a, e) => words(e.body) > words(a.body) ? e : a, list[0]);
    const counts = {}; list.forEach(e => { if (e.mood) counts[e.mood] = (counts[e.mood] || 0) + 1; });
    const moodTotal = Object.values(counts).reduce((a, b) => a + b, 0);
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const bar = MOODS.filter(([id]) => counts[id]).map(([id]) => `<span style="width:${counts[id] / moodTotal * 100}%;background:var(--m-${id})" title="${MOOD_LABEL[id]}: ${counts[id]}"></span>`).join("");
    const hls = list.filter(e => e.highlight || e.title).slice(-8).reverse();
    card.innerHTML = `<span class="eyebrow">${sub}</span><h3>${esc(title)}</h3>
      <div class="recap-nums"><div><b>${list.length}</b><small>${list.length === 1 ? "page" : "pages"}</small></div><div><b>${totalW.toLocaleString()}</b><small>words</small></div><div><b>${words(longest.body).toLocaleString()}</b><small>longest page</small></div></div>
      ${moodTotal ? `<div class="moodbar">${bar}</div><p class="most">Felt <b>${MOOD_LABEL[top[0]].toLowerCase()}</b> most often, ${top[1]} ${top[1] === 1 ? "day" : "days"}.</p>` : ""}
      ${hls.length ? `<span class="eyebrow" style="margin-top:4px">Highlights</span><ul class="hl-list">${hls.map(e => `<li><button data-k="${e.date}"><small>${fromKey(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small><span>${esc(e.highlight || e.title)}</span></button></li>`).join("")}</ul>` : ""}`;
    card.querySelectorAll("[data-k]").forEach(b => b.onclick = () => openDay(b.dataset.k));
  }
  $("prevM").onclick = () => { if (calMode === "month") view.setMonth(view.getMonth() - 1); else yearView--; renderCal(); };
  $("nextM").onclick = () => { if ($("nextM").disabled) return; if (calMode === "month") view.setMonth(view.getMonth() + 1); else yearView++; renderCal(); };
  $("goToday").onclick = () => { calSel = todayKey(); view = new Date(); view.setDate(1); yearView = new Date().getFullYear(); renderCal(); };

  // ---- Pages view ----
  function renderList() {
    const q = $("q").value.trim().toLowerCase();
    const all = [...entries.values()].sort((a, b) => b.date.localeCompare(a.date))
      .filter(e => !q || [e.title, e.highlight, e.body, MOOD_LABEL[e.mood], sceneText(e.scene)].join(" ").toLowerCase().includes(q));
    const box = $("list");
    if (!all.length) {
      box.innerHTML = `<div class="card empty"><p>${q ? `No pages mention “${esc(q)}”.` : "No pages yet. Your first one is waiting."}</p>${q ? "" : `<button class="primary" id="startW">Write today's page</button>`}</div>`;
      if (!q) $("startW").onclick = () => openDay(todayKey());
      return;
    }
    const groups = new Map();
    all.forEach(e => { const g = e.date.slice(0, 7); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(e); });
    box.innerHTML = "";
    groups.forEach((list, g) => {
      const sec = document.createElement("div"); sec.className = "month-group";
      sec.innerHTML = `<h3>${fromKey(g + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })} · ${list.length}</h3><div class="card entries"></div>`;
      const wrap = sec.querySelector(".entries");
      list.forEach(e => {
        const d = fromKey(e.date), b = document.createElement("button");
        b.className = "entry"; b.type = "button";
        b.innerHTML = `<span class="d"><b>${d.getDate()}</b><small>${d.toLocaleDateString(undefined, { weekday: "short" })}</small></span>
          <span style="min-width:0"><span class="t"><i class="sw sm" style="width:10px;height:10px;background:${moodColor(e.mood)}"></i><span>${esc(e.title || e.highlight || "Untitled page")}</span></span>
          <p>${esc(e.highlight && e.title ? "★ " + e.highlight : ((e.body || "").trim() || (e.mood ? "Felt " + MOOD_LABEL[e.mood].toLowerCase() + "." : "")))}</p></span>`;
        b.onclick = () => openDay(e.date);
        wrap.appendChild(b);
      });
      box.appendChild(sec);
    });
  }
  $("q").addEventListener("input", renderList);

  // ---- Import / Export ----
  let downloads = null;
  const stamp = () => todayKey();
  const sortedEntries = () => [...entries.values()].sort((a, b) => a.date.localeCompare(b.date));
  function toJSON() { return JSON.stringify({ app: "ikigai", version: 1, exported: new Date().toISOString(), entries: sortedEntries() }, null, 2); }
  function toMarkdown() {
    const out = ["# Ikigai journal", "", `Exported ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} · ${entries.size} pages`, ""];
    sortedEntries().forEach(e => {
      out.push("---", "", `## ${fromKey(e.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`, "");
      const meta = [];
      if (e.mood) meta.push(`Mood: ${MOOD_LABEL[e.mood]}`);
      const st = sceneText(e.scene); if (st) meta.push(`Scene: ${st}`);
      if (meta.length) out.push("*" + meta.join(" · ") + "*", "");
      if (e.highlight) out.push(`> ★ ${e.highlight}`, "");
      if (e.title) out.push(`### ${e.title}`, "");
      if ((e.body || "").trim()) out.push(e.body.trim(), "");
    });
    return out.join("\n");
  }
  function backupMsg(text, err) { const m = document.createElement("div"); m.className = "msg" + (err ? " err" : ""); m.textContent = text; return m; }
  async function saveFile(filename, data, box) {
    if (!downloads) {
      try {
        const type = filename.endsWith(".json") ? "application/json" : "text/markdown";
        const url = URL.createObjectURL(new Blob([data], { type: type + ";charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        box.querySelector(".out").replaceChildren(backupMsg(`Saved ${filename}. Check your downloads folder.`));
      } catch (e) {
        try { await navigator.clipboard.writeText(data); box.querySelector(".out").replaceChildren(backupMsg("Your browser blocked the download, so the backup was copied to your clipboard. Paste it into a text file to keep it.")); }
        catch (x) { box.querySelector(".out").replaceChildren(backupMsg("Your browser blocked the download. Try another browser.", true)); }
      }
      return;
    }
    try { await downloads.save({ filename, data }); box.querySelector(".out").replaceChildren(backupMsg(`Saved ${filename}.`)); }
    catch (e) {
      const code = e && e.code;
      if (code === "declined") box.querySelector(".out").replaceChildren(backupMsg("Export cancelled. Nothing was saved."));
      else if (code === "rate_limited") box.querySelector(".out").replaceChildren(backupMsg("A save prompt is already open. Finish that one first.", true));
      else box.querySelector(".out").replaceChildren(backupMsg("The file couldn't be saved here. Try again in claude.ai in your browser.", true));
    }
  }
  function closeBackup() { $("backup").hidden = true; $("backup").innerHTML = ""; }
  $("exportBtn").onclick = () => {
    const box = $("backup");
    if (!box.hidden && box.dataset.mode === "export") return closeBackup();
    box.dataset.mode = "export"; box.hidden = false;
    if (!entries.size) { box.innerHTML = `<h3>Export</h3><p>There are no pages to export yet.</p><div class="row"><button class="ghost" id="bkClose">Close</button></div>`; $("bkClose").onclick = closeBackup; return; }
    box.innerHTML = `<h3>Export ${entries.size} ${entries.size === 1 ? "page" : "pages"}</h3>
      <div class="row">
        <button class="opt" id="exJson"><b>Backup file (.json)</b><small>Everything, including moods and scenes. Use this to import later.</small></button>
        <button class="opt" id="exMd"><b>Readable text (.md)</b><small>Your pages as a document you can read or print anywhere.</small></button>
      </div>
      <div class="out"></div>
      <div class="row"><button class="ghost" id="bkClose">Close</button></div>`;
    $("bkClose").onclick = closeBackup;
    $("exJson").onclick = () => saveFile(`ikigai-backup-${stamp()}.json`, toJSON(), box);
    $("exMd").onclick = () => saveFile(`ikigai-journal-${stamp()}.md`, toMarkdown(), box);
  };

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function cleanEntry(x) {
    if (!x || typeof x !== "object" || !DATE_RE.test(x.date || "")) return null;
    const str = v => typeof v === "string" ? v : "";
    const sc = x.scene && typeof x.scene === "object" ? x.scene : {};
    const e = {
      date: x.date, title: str(x.title).slice(0, 200), highlight: str(x.highlight).slice(0, 200), body: str(x.body),
      mood: MOOD_LABEL[x.mood] ? x.mood : null,
      scene: { where: SCENE.where.includes(sc.where) ? sc.where : null, who: Array.isArray(sc.who) ? sc.who.filter(w => SCENE.who.includes(w)) : [], weather: SCENE.weather.includes(sc.weather) ? sc.weather : null },
      created: Number(x.created) || Date.now(), updated: Number(x.updated) || Date.now()
    };
    if (e.date > todayKey()) return null;
    if (!e.title.trim() && !e.body.trim() && !e.highlight.trim() && !e.mood && sceneEmpty(e.scene)) return null;
    return e;
  }
  $("importBtn").onclick = () => { $("importFile").value = ""; $("importFile").click(); };
  $("importFile").addEventListener("change", async () => {
    const f = $("importFile").files && $("importFile").files[0]; if (!f) return;
    const box = $("backup"); box.dataset.mode = "import"; box.hidden = false;
    let list;
    try {
      const data = JSON.parse(await f.text());
      list = (Array.isArray(data) ? data : data.entries || []).map(cleanEntry).filter(Boolean);
    } catch (e) { list = null; }
    if (!list || !list.length) {
      box.innerHTML = `<h3>Import</h3><div class="out"></div><div class="row"><button class="ghost" id="bkClose">Close</button></div>`;
      box.querySelector(".out").replaceChildren(backupMsg(list ? `${f.name} has no pages Ikigai can read.` : `${f.name} isn't an Ikigai backup. Choose the .json file you exported from Ikigai.`, true));
      $("bkClose").onclick = closeBackup; return;
    }
    const fresh = list.filter(e => !entries.has(e.date));
    const newer = list.filter(e => entries.has(e.date) && e.updated > entries.get(e.date).updated);
    const same = list.length - fresh.length - newer.length;
    const parts = [];
    if (fresh.length) parts.push(`${fresh.length} new ${fresh.length === 1 ? "page" : "pages"}`);
    if (newer.length) parts.push(`${newer.length} newer ${newer.length === 1 ? "version" : "versions"} of pages you have`);
    if (same) parts.push(`${same} you already have (kept as they are)`);
    box.innerHTML = `<h3>Import from ${esc(f.name)}</h3><p>Found ${list.length} ${list.length === 1 ? "page" : "pages"}: ${esc(parts.join(", "))}. Nothing you have is deleted.</p>
      <div class="out"></div><div class="row">${fresh.length + newer.length ? `<button class="primary" id="doImport">Import ${fresh.length + newer.length} ${fresh.length + newer.length === 1 ? "page" : "pages"}</button>` : ""}<button class="ghost" id="bkClose">${fresh.length + newer.length ? "Cancel" : "Close"}</button></div>`;
    $("bkClose").onclick = closeBackup;
    const btn = $("doImport");
    if (btn) btn.onclick = async () => {
      btn.disabled = true;
      const todo = [...fresh, ...newer];
      for (const e of todo) { entries.set(e.date, e); await put(e); }
      if (todo.some(e => e.date === current)) { const k = current; current = null; openDay(k); go("pages"); }
      renderList(); closeBackup();
      toast(`Imported ${todo.length} ${todo.length === 1 ? "page" : "pages"}.`);
    };
  });

  // ---- Boot ----
  renderStarters();
  (async () => {
    db = await openDB();
    if (!db) $("warn").hidden = false;
    (await getAll()).forEach(e => entries.set(e.date, e));
    const start = (location.hash || "").slice(1);
    openDay(todayKey());
    if (start && start !== "write") go(start);
    setInterval(() => { if (activeView === "write") renderNudge(); }, 60000);
    // Inside claude.ai the page saves through its downloads capability; on your own site it uses a normal browser download.
    try { downloads = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (e) { downloads = null; }
  })();
})();
