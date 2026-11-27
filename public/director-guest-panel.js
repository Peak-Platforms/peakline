/* Director "Guests" panel: Invite guest / End guest.
   Loaded by director.html with one script line. It uses things director.html already
   has: SCHOOL, the sign-in password saved in sessionStorage as 'dirpw', and toast(). */
(function () {
  if (document.getElementById('dgp')) return;

  // Where this script was loaded from is also where the guest actions live.
  var base = 'https://app.getpeaklink.com';
  try { base = new URL(document.currentScript.src).origin; } catch (e) {}
  var API = base + '/api/director-guest';
  var guests = {}; // room -> { url, state, live, timer }

  function school() { try { return SCHOOL; } catch (e) { return ''; } }
  function pw() { try { return sessionStorage.getItem('dirpw') || ''; } catch (e) { return ''; } }
  function say(m) { try { toast(m); } catch (e) { console.log(m); } }

  var css = document.createElement('style');
  css.textContent =
    '#dgp{position:fixed;right:12px;bottom:12px;z-index:9999;width:290px;font:12px/1.35 system-ui,sans-serif;background:#151515;color:#ddd;border:1px solid #333;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.5)}' +
    '#dgp .dgp-h{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer}' +
    '#dgp .dgp-h b{flex:1;letter-spacing:.08em;font-size:11px;color:#aaa}' +
    '#dgp .dgp-b{padding:8px 10px;display:none;border-top:1px solid #2a2a2a}' +
    '#dgp.open .dgp-b{display:block}' +
    '#dgp button{background:#2a7de1;color:#fff;border:0;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer}' +
    '#dgp button.dgp-sec{background:#333}#dgp button.dgp-end{background:#8a2b2b}#dgp button:disabled{opacity:.5;cursor:default}' +
    '.dgp-g{border:1px solid #2d2d2d;border-radius:8px;padding:7px;margin-top:8px}' +
    '.dgp-g input{width:100%;box-sizing:border-box;background:#0c0c0c;color:#ccc;border:1px solid #333;border-radius:5px;padding:4px 6px;font-size:11px}' +
    '.dgp-row{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}' +
    '.dgp-st{margin-top:5px;color:#9ab}.dgp-st.live{color:#f87171;font-weight:600}';
  document.head.appendChild(css);

  var box = document.createElement('div');
  box.id = 'dgp';
  box.innerHTML =
    '<div class="dgp-h"><b>GUESTS</b><span id="dgpCount" style="color:#888">0</span></div>' +
    '<div class="dgp-b"><button id="dgpInvite">+ Invite guest</button><div id="dgpList"></div>' +
    '<div style="margin-top:8px;color:#777">The guest\'s picture appears as a tile a few seconds after they join. The link and call last up to 6 hours. Press End guest when you finish.</div></div>';
  document.body.appendChild(box);
  box.querySelector('.dgp-h').addEventListener('click', function () { box.classList.toggle('open'); });
  document.getElementById('dgpInvite').addEventListener('click', invite);

  async function call(path, body) {
    var r = await fetch(API + '/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ school: school(), password: pw() }, body))
    });
    var j = {}; try { j = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, j: j };
  }

  function draw() {
    var rooms = Object.keys(guests);
    document.getElementById('dgpCount').textContent = rooms.length;
    if (rooms.length) box.classList.add('open');
    var list = document.getElementById('dgpList');
    list.innerHTML = '';
    rooms.forEach(function (room, i) {
      var g = guests[room];
      var card = document.createElement('div'); card.className = 'dgp-g';
      var title = document.createElement('b'); title.textContent = 'Guest ' + (i + 1);
      var inp = document.createElement('input'); inp.readOnly = true; inp.value = g.url;
      inp.addEventListener('click', function () { inp.select(); });
      var row = document.createElement('div'); row.className = 'dgp-row';
      var lb = btn(g.listen === false ? 'Listen' : 'Mute', 'dgp-sec', function () { g.listen = (g.listen === false); applyListen(); draw(); });
      row.appendChild(lb);
      row.appendChild(btn('Copy link', '', function () { copy(room); }));
      row.appendChild(btn('Reconnect', 'dgp-sec', function () { reconnect(room); }));
      row.appendChild(btn('End guest', 'dgp-end', function () { endGuest(room); }));
      var st = document.createElement('div'); st.className = 'dgp-st' + (g.live ? ' live' : ''); st.textContent = g.state;
      card.appendChild(title); card.appendChild(inp); card.appendChild(row); card.appendChild(st);
      list.appendChild(card);
    });
  }

  function applyListen() {
    Object.keys(guests).forEach(function (room) {
      var suffix = room.split('-').pop();
      var v = document.querySelector('video[id^="card-vid-"][id$="_src_' + suffix + '"]');
      if (v) v.muted = (guests[room].listen === false);
    });
  }
  setInterval(applyListen, 1000);

  function btn(label, cls, fn) {
    var b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls;
    b.addEventListener('click', fn); return b;
  }

  function copy(room) {
    var g = guests[room]; if (!g) return;
    if (navigator.clipboard) navigator.clipboard.writeText(g.url).then(function () { say('Link copied'); }, function () { say('Select the link and copy it'); });
    else say('Select the link and copy it');
  }

  // Keep trying until the guest has joined, then send their picture to the station.
  function watch(room) {
    var g = guests[room]; if (!g) return;
    clearTimeout(g.timer);
    g.timer = setTimeout(async function () {
      if (!guests[room]) return;
      var r;
      try { r = await call('start', { room: room }); } catch (e) { g.state = 'Cannot reach the Peak Link server'; draw(); return; }
      if (!guests[room]) return;
      if (r.ok) { g.state = 'LIVE - cut to this tile'; g.live = true; draw(); return; }
      if (r.j && r.j.error === 'guest_not_here') { g.state = 'Waiting for guest to join...'; draw(); watch(room); return; }
      if (r.j && r.j.error === 'room_gone') { g.state = 'Link expired'; draw(); return; }
      g.state = 'Problem: ' + ((r.j && (r.j.message || r.j.error)) || r.status); draw();
    }, 3500);
  }

  function reconnect(room) {
    var g = guests[room]; if (!g) return;
    g.live = false; g.state = 'Reconnecting - waiting for guest...'; draw(); watch(room);
  }

  async function invite() {
    if (!pw()) { say('Sign in first (password box at top)'); return; }
    var b = document.getElementById('dgpInvite'); b.disabled = true;
    try {
      var r = await call('create', {});
      if (!r.ok) {
        say(r.j.error === 'bad_login' ? 'Wrong password - sign in again' : (r.j.message || 'Could not make a guest link'));
        return;
      }
      guests[r.j.room] = { url: r.j.guestUrl, state: 'Waiting for guest to join...', live: false, timer: null };
      draw(); watch(r.j.room); copy(r.j.room);
    } catch (e) { say('Could not reach the Peak Link server'); }
    finally { b.disabled = false; }
  }

  async function endGuest(room) {
    var g = guests[room]; if (!g) return;
    clearTimeout(g.timer);
    g.state = 'Ending...'; draw();
    try { await call('end', { room: room }); } catch (e) {}
    delete guests[room]; draw(); say('Guest ended');
  }
})();
