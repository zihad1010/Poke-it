/* Poke it — frontend-only demo. All data is saved in the browser's localStorage. */

const $ = (id) => document.getElementById(id);
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch { toast("Storage full. Try a smaller photo."); return false; }
};

// ---------- Data ----------
let users = read("pokeit_users", []);
let posts = read("pokeit_posts", []);
let session = read("pokeit_session", null);

// Default admin account (change this!)
const ADMIN_INVITE = "POKE-ADMIN-2026"; // secret code needed to create an admin account (change it!)
if (!users.some((u) => u.role === "admin")) {
  users.push({ username: "admin", password: "admin123", role: "admin", phone: "01700000000" });
}
users.forEach((u) => { if (u.role === "admin" && !u.phone) u.phone = "01700000000"; });
write("pokeit_users", users);

const saveUsers = () => write("pokeit_users", users);
const savePosts = () => write("pokeit_posts", posts);

// ---------- UI helpers ----------
function show(id) {
  ["welcome", "auth", "app"].forEach((s) => $(s).classList.toggle("hidden", s !== id));
}
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text; // textContent keeps user input safe
  return e;
}
const STICKERS = ["😀", "😎", "🥳", "😺", "🐶", "🦊", "🐼", "🐸", "🦄", "🐧", "🔥", "⚡", "🌈", "🍕", "🎧", "🚀", "🌸", "👻"];
function avatarOf(username) {
  const u = users.find((x) => x.username === username);
  if (u && u.sticker) return u.sticker;
  return u && u.role === "admin" ? "🛡️" : username[0].toUpperCase();
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return new Date(ts).toLocaleDateString();
}

// ---------- Auth ----------
let mode = "user";
const titles = { user: "Login as User", admin: "Login as Admin", signup: "Create account" };

document.querySelectorAll("[data-mode]").forEach((b) =>
  b.addEventListener("click", () => {
    mode = b.dataset.mode;
    $("authTitle").textContent = titles[mode];
    $("authSubmit").textContent = mode === "signup" ? "Create account" : "Login";
    $("authMsg").textContent = "";
    $("authForm").reset();
    setSignupFields(mode === "signup");
    closeOtp();
    show("auth");
  })
);
$("backBtn").onclick = () => show("welcome");

// Extra fields are required only when creating an account
function setSignupFields(on) {
  $("typeRow").classList.toggle("hidden", !on);
  if (!on) $("acctType").value = "user";
  syncType();
}
function syncType() {
  const signup = mode === "signup";
  const admin = signup && $("acctType").value === "admin";
  $("signupFields").classList.toggle("hidden", !signup || admin);
  $("adminFields").classList.toggle("hidden", !admin);
  ["gender", "university", "department", "studentId"].forEach((id) => ($(id).required = signup && !admin));
  ["phone", "inviteCode"].forEach((id) => ($(id).required = admin));
}
$("acctType").onchange = syncType;

$("authForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const username = $("username").value.trim();
  const password = $("password").value;
  const msg = $("authMsg");
  msg.className = "msg";

  if (mode === "signup") {
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      msg.textContent = "That username is taken. Try another one.";
      return;
    }
    if ($("acctType").value === "admin") {
      const phone = $("phone").value.trim();
      if ($("inviteCode").value.trim() !== ADMIN_INVITE) { msg.textContent = "Wrong admin invite code."; return; }
      if (!/^\+?\d{10,15}$/.test(phone)) { msg.textContent = "Enter a valid phone number (10-15 digits)."; return; }
      users.push({ username, password, role: "admin", phone });
      saveUsers();
      toast("Admin account created. Please log in as admin.");
      mode = "admin";
      $("authTitle").textContent = titles.admin;
      $("authSubmit").textContent = "Login";
      $("authForm").reset();
      setSignupFields(false);
      return;
    }
    const sid = $("studentId").value.trim();
    if (users.some((u) => u.sid && u.sid === sid)) {
      msg.textContent = "An account with this ID already exists.";
      return;
    }
    users.push({
      username, password, role: "user",
      gender: $("gender").value,
      university: $("university").value.trim(),
      department: $("department").value.trim(),
      sid, // private: never shown in the UI, not even to the admin
    });
    saveUsers();
    toast("Account created. Please log in.");
    mode = "user";
    $("authTitle").textContent = titles.user;
    $("authSubmit").textContent = "Login";
    $("authForm").reset();
    setSignupFields(false);
    return;
  }

  const role = mode === "admin" ? "admin" : "user";
  const found = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password && u.role === role
  );
  if (!found) {
    msg.textContent = "Wrong username or password for this login type.";
    return;
  }
  if (found.role === "admin") { startOtp(found); return; }
  session = { username: found.username, role: found.role };
  write("pokeit_session", session);
  startApp();
});

$("logoutBtn").onclick = () => {
  session = null;
  localStorage.removeItem("pokeit_session");
  show("welcome");
};

// ---------- Hamburger navigation ----------
function setMenuOpen(open) {
  $("sideMenu").classList.toggle("open", open);
  $("menuBackdrop").classList.toggle("hidden", !open);
  $("hamburgerBtn").setAttribute("aria-expanded", String(open));
}
$("hamburgerBtn").addEventListener("click", () => setMenuOpen(true));
$("closeMenu").addEventListener("click", () => setMenuOpen(false));
$("menuBackdrop").addEventListener("click", () => setMenuOpen(false));
document.querySelectorAll(".menu-game").forEach(button => button.addEventListener("click", () => {
  const key = button.dataset.game;
  setMenuOpen(false);
  openGameView(key); renderGroupBoxes(); renderGames(); updateSpinUI();
  if (! $("gamesDlg").open) $("gamesDlg").showModal();
}));

// ---------- App ----------
let tab = "feed";

function startApp() {
  const isAdmin = session.role === "admin";
  $("whoami").textContent = (isAdmin ? "Admin: " : "@") + session.username;
  $("composer").classList.toggle("hidden", isAdmin);
  $("tabs").classList.toggle("hidden", !isAdmin);
  $("profileBtn").classList.toggle("hidden", isAdmin);
  $("sideMenu").classList.toggle("hidden", false);
  $("gamesBtn").classList.toggle("hidden", isAdmin);
  if (!isAdmin) { buildWheel(); updateSpinUI(); }
  tab = "feed";
  setTab("feed");
  show("app");
}

document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => setTab(t.dataset.tab)));
function setTab(name) {
  tab = name;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  render();
}

// ---------- Profile (visible only to the account owner) ----------
let profileEdit = false;
function renderProfile() {
  const me = users.find((u) => u.username === session.username);
  const body = $("profileBody");
  body.replaceChildren();
  body.style.cssText = "display:flex;flex-direction:column;gap:14px";
  body.append(el("div", "avatar", avatarOf(me.username)), el("h2", "", "@" + me.username));

  if (profileEdit) body.append(profileForm(me));
  else {
    const dl = el("dl");
    [["Gender", me.gender], ["University", me.university], ["Department", me.department], ["Your ID", me.sid], ["Points", String(me.points || 0)]].forEach(([k, v]) => {
      dl.append(el("dt", "", k), el("dd", "", v || "Not set"));
    });
    const edit = el("button", "btn ghost sm", "Edit details");
    edit.type = "button";
    edit.onclick = () => { profileEdit = true; renderProfile(); };
    body.append(dl, el("p", "hint", "Only you can see these details. Your username cannot be changed."), edit);
  }

  body.append(el("strong", "", "Choose your sticker"));
  const grid = el("div", "stickers");
  STICKERS.forEach((s) => {
    const b = el("button", "sticker" + (me.sticker === s ? " on" : ""), s);
    b.type = "button";
    b.setAttribute("aria-label", "Use sticker " + s);
    b.onclick = () => { me.sticker = s; saveUsers(); renderProfile(); render(); toast("Sticker updated."); };
    grid.append(b);
  });
  body.append(grid);
}
// Edit form: everything except the username can be updated
function profileForm(me) {
  const f = el("form", "profile-form");
  const field = (label, node) => { const l = el("label", "", label); l.append(node); return l; };
  const user = el("input"); user.value = "@" + me.username; user.disabled = true;
  const gender = el("select"); gender.required = true;
  [["", "Select gender"], ["Male", "Male"], ["Female", "Female"], ["Other", "Other"]].forEach(([v, t]) => { const o = el("option", "", t); o.value = v; gender.append(o); });
  gender.value = me.gender || "";
  const mk = (val, max) => { const i = el("input"); i.value = val || ""; i.maxLength = max; i.required = true; return i; };
  const uni = mk(me.university, 80), dep = mk(me.department, 80), sid = mk(me.sid, 20);
  sid.inputMode = "numeric";
  const msg = el("p", "msg");
  msg.setAttribute("role", "alert");
  const save = el("button", "btn primary sm", "Save");
  const cancel = el("button", "btn ghost sm", "Cancel");
  cancel.type = "button";
  cancel.onclick = () => { profileEdit = false; renderProfile(); };
  const row = el("div", "actions"); row.append(save, cancel);
  f.append(field("Username (cannot be changed)", user), field("Gender", gender), field("University", uni), field("Department", dep), field("Your ID (private)", sid), msg, row);
  f.onsubmit = (e) => {
    e.preventDefault();
    users = read("pokeit_users", users);
    const cur = users.find((u) => u.username === me.username);
    const id = sid.value.trim();
    if (users.some((u) => u !== cur && u.sid && u.sid === id)) { msg.textContent = "Another account already uses this ID."; return; }
    cur.gender = gender.value; cur.university = uni.value.trim(); cur.department = dep.value.trim(); cur.sid = id;
    saveUsers();
    profileEdit = false;
    renderProfile();
    refreshRank(); // King/Queen title follows gender
    toast("Profile updated.");
  };
  return f;
}
$("profileBtn").onclick = () => { profileEdit = false; renderProfile(); $("profileDlg").showModal(); };
$("closeProfile").onclick = () => $("profileDlg").close();

// ---------- Composer ----------
let imgData = "";
$("postImg").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    // Shrink image so localStorage doesn't fill up
    const img = new Image();
    img.onload = () => {
      const max = 800, scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * scale; c.height = img.height * scale;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      imgData = c.toDataURL("image/jpeg", 0.7);
      $("preview").src = imgData;
      $("preview").classList.remove("hidden");
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

$("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("postText").value.trim();
  const toId = $("toId").value.trim();
  if (!toId) { toast("Please enter the To ID."); return; }
  if (!text && !imgData) { toast("Write something or add a photo."); return; }
  posts.unshift({
    id: Date.now(),
    author: session.username,
    toId,
    text, image: imgData,
    status: "pending", // admin must approve
    time: Date.now(),
    likes: [],
    comments: [],
  });
  if (!savePosts()) { posts.shift(); return; }
  $("composer").reset();
  imgData = "";
  $("preview").classList.add("hidden");
  toast("Sent for approval.");
  render();
});

// ---------- Feed ----------
function render() {
  renderRoyal();
  const isAdmin = session.role === "admin";
  const pending = posts.filter((p) => p.status === "pending");
  $("pendingCount").textContent = pending.length;
  renderCgResults();
  renderCtResults();
  if (isAdmin && tab === "cg") { renderCgAdmin(); return; }

  let list;
  if (isAdmin && tab === "pending") list = pending;
  else {
    // everyone sees approved posts; users also see their own pending ones
    list = posts.filter((p) => p.status === "approved" || (!isAdmin && p.author === session.username && p.status === "pending"));
  }

  const feed = $("feed");
  feed.replaceChildren();
  if (!list.length) {
    feed.append(el("p", "empty", tab === "pending" ? "No posts waiting for approval." : "No posts yet. Be the first to post!"));
    return;
  }
  const box = el("div");
  box.style.cssText = "display:flex;flex-direction:column;gap:22px";
  list.forEach((p) => box.append(postCard(p)));
  feed.append(box);
}

function postCard(p) {
  const isAdmin = session.role === "admin";
  const card = el("article", "card post");

  const head = el("div", "post-head");
  head.append(el("div", "avatar", avatarOf(p.author)));
  const who = el("div");
  const isKing = p.author === kingName;
  who.append(el("strong", isKing ? "gold" : "", (isKing ? "⭐ " : "") + p.author), el("small", "", timeAgo(p.time)));
  head.append(who);
  if (p.status === "pending") head.append(el("span", "badge", "Waiting for approval"));
  card.append(head);

  if (p.toId) {
    const me = users.find((u) => u.username === session.username);
    const mine = session.role === "user" && me && me.sid && me.sid === p.toId;
    const to = el("span", "to-id" + (mine ? " for-you" : ""), "To ID : " + p.toId + (mine ? "  (this is for you)" : ""));
    card.append(to);
  }
  if (p.text) card.append(el("p", "post-text", p.text));
  if (p.image) { const i = el("img", "post-img"); i.src = p.image; i.alt = "Photo by " + p.author; card.append(i); }

  // Admin moderation
  if (isAdmin) {
    const row = el("div", "actions");
    if (p.status === "pending") {
      const ok = el("button", "act approve", "Approve");
      ok.onclick = () => { p.status = "approved"; savePosts(); toast("Post approved."); render(); };
      row.append(ok);
    }
    const del = el("button", "act reject", p.status === "pending" ? "Reject" : "Delete");
    del.onclick = () => { posts = posts.filter((x) => x.id !== p.id); savePosts(); toast("Post removed."); render(); };
    row.append(del);
    card.append(row);
  }

  // Reactions & comments only on approved posts
  if (p.status === "approved") {
    const liked = p.likes.includes(session.username);
    const actions = el("div", "actions");
    const like = el("button", "act" + (liked ? " liked" : ""));
    const heart = el("span", "heart", liked ? "♥" : "♡");
    like.append(heart, " " + p.likes.length);
    like.setAttribute("aria-label", liked ? "Remove reaction" : "React");
    like.onclick = () => {
      p.likes = liked ? p.likes.filter((u) => u !== session.username) : [...p.likes, session.username];
      savePosts(); render();
    };
    actions.append(like, el("span", "hint", p.comments.length + " comments"));
    card.append(actions);

    const cm = el("div", "comments");
    p.comments.forEach((c, i) => {
      const line = el("p", "comment");
      const txt = el("span", "txt");
      txt.append(el("b", "", c.user + " "), document.createTextNode(c.text));
      line.append(txt);
      if (isAdmin) {
        const d = el("button", "del-c", "Delete");
        d.type = "button";
        d.onclick = () => { p.comments.splice(i, 1); savePosts(); toast("Comment deleted."); render(); };
        line.append(d);
      }
      cm.append(line);
    });
    const form = el("form", "comment-form");
    const input = el("input"); input.placeholder = "Write a comment…"; input.maxLength = 300; input.required = true;
    const send = el("button", "btn sm", "Send");
    form.append(input, send);
    form.onsubmit = (e) => {
      e.preventDefault();
      const t = input.value.trim();
      if (!t) return;
      p.comments.push({ user: session.username, text: t, time: Date.now() });
      savePosts(); render();
    };
    cm.append(form);
    card.append(cm);
  }
  return card;
}

// ---------- Admin OTP ----------
// DEMO: real SMS needs a backend + SMS provider (Twilio, Firebase Phone Auth...).
// Here the "SMS" is shown on screen so the full flow can be tested.
const OTP_TTL = 2 * 60 * 1000;
let pendingAdmin = null, otp = null;
const maskPhone = (p) => p.slice(0, -4).replace(/\d/g, "*") + p.slice(-4);

function sendOtp() {
  const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
  otp = { code, exp: Date.now() + OTP_TTL, tries: 0 };
  $("smsDemo").textContent = "📱 Demo SMS to " + maskPhone(pendingAdmin.phone) + ": Your Poke it code is " + code + ". It expires in 2 minutes.";
}
function startOtp(admin) {
  pendingAdmin = admin;
  sendOtp();
  $("otpInput").value = "";
  $("otpMsg").textContent = "";
  $("authForm").classList.add("hidden");
  $("otpForm").classList.remove("hidden");
}
function closeOtp() {
  otp = null; pendingAdmin = null;
  $("otpForm").classList.add("hidden");
  $("authForm").classList.remove("hidden");
}
$("otpBack").onclick = closeOtp;
$("otpResend").onclick = () => { sendOtp(); $("otpMsg").textContent = ""; toast("New code sent."); };
$("otpForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const m = $("otpMsg");
  if (!otp || Date.now() > otp.exp) { m.textContent = "This code expired. Send a new code."; return; }
  if (otp.tries >= 5) { m.textContent = "Too many wrong tries. Send a new code."; return; }
  if ($("otpInput").value.trim() !== otp.code) { otp.tries++; m.textContent = "Wrong code. Try again."; return; }
  session = { username: pendingAdmin.username, role: "admin" };
  write("pokeit_session", session);
  closeOtp();
  startApp();
});

// ---------- Spin game ----------
const PRIZES = [{ t: "+5", v: 5 }, { t: "+10", v: 10 }, { t: "+2", v: 2 }, { t: "+20", v: 20 }, { t: "Try again", v: 0 }, { t: "+50", v: 50 }];
const SPIN_COOLDOWN = 60 * 1000; // 1 minute between spins (change as you like)
let wheelDeg = 0, spinning = false;

function buildWheel() {
  const seg = 360 / PRIZES.length;
  const colors = ["#ff4f7b", "#ffd84d", "#ffffff", "#b9afff", "#ffd84d", "#ff4f7b"];
  const w = $("wheel");
  w.style.background = "conic-gradient(" + colors.map((c, i) => c + " " + i * seg + "deg " + (i + 1) * seg + "deg").join(",") + ")";
  w.replaceChildren();
  PRIZES.forEach((p, i) => {
    const s = el("span", "", p.t);
    s.style.transform = "translate(-50%,-50%) rotate(" + (i * seg + seg / 2) + "deg) translateY(-70px)";
    w.append(s);
  });
}
function updateSpinUI() {
  if (!session || session.role !== "user") return;
  const me = users.find((u) => u.username === session.username);
  if (!me) return;
  $("pts").textContent = me.points || 0;
  const n = read("pokeit_games", []).filter((g) => !g.winner && g[g.turn] === session.username).length;
  $("gamesBtn").dataset.n = n || ""; // badge: games waiting for your move
  document.querySelector('.gtile[data-g="ttt"]').dataset.n = n || "";
  const left = me.lastSpin ? Math.ceil((SPIN_COOLDOWN - (Date.now() - me.lastSpin)) / 1000) : 0;
  $("spinBtn").disabled = spinning || left > 0;
  $("spinBtn").textContent = spinning ? "Spinning…" : left > 0 ? "Next spin in " + left + "s" : "Spin";
}
$("spinBtn").onclick = () => {
  const me = users.find((u) => u.username === session.username);
  if (spinning || !me || (me.lastSpin && Date.now() - me.lastSpin < SPIN_COOLDOWN)) return;
  spinning = true;
  updateSpinUI();
  const seg = 360 / PRIZES.length;
  const i = Math.floor(Math.random() * PRIZES.length);
  wheelDeg = (Math.floor(wheelDeg / 360) + 6) * 360 + (360 - (i * seg + seg / 2));
  $("wheel").style.transform = "rotate(" + wheelDeg + "deg)";
  setTimeout(() => {
    const prize = PRIZES[i];
    addPoints(me, prize.v);
    me.lastSpin = Date.now();
    saveUsers();
    spinning = false;
    toast(prize.v ? "You won " + prize.t + " points!" : "No luck this time. Try again soon.");
    updateSpinUI();
    refreshRank();
  }, 4200);
};
setInterval(updateSpinUI, 1000);

// ---------- Games panel (hidden until the 🎮 button is clicked) ----------
$("gamesBtn").onclick = () => { openGameView(null); renderGroupBoxes(); renderGames(); updateSpinUI(); $("gamesDlg").showModal(); };
$("closeGames").onclick = () => $("gamesDlg").close();
const PANELS = { spin: "spinCard", ttt: "tttPanel", rps: "rpsPanel", mem: "memPanel", rank: "rankPanel", room: "roomPanel", cg: "cgPanel", ct: "ctPanel" };
const GAME_TITLES = { spin: "🎡 Spin wheel", ttt: "⭕❌ Tic-Tac-Toe", rps: "✊ Rock Paper Scissors", mem: "🧠 Memory Match", rank: "🏆 Ranking", room: "👥 Group room", cg: "🎓 CG guess", ct: "📝 CT number guess" };
function openGameView(key) { // key = null shows the game menu
  $("gameMenu").classList.toggle("hidden", !!key);
  $("gamesBar").classList.toggle("hidden", !key);
  $("gameTitle").textContent = key ? GAME_TITLES[key] : "";
  Object.entries(PANELS).forEach(([k, id]) => $(id).classList.toggle("hidden", k !== key));
  if (key === "rank") renderLeaderboard();
  if (key === "mem" && !memCards.length) newMemory();
  if (key === "cg") renderCg();
  if (key === "ct") renderCt();
}
document.querySelectorAll(".gtile").forEach((t) => t.addEventListener("click", () => openGameView(t.dataset.g)));
$("gamesBack").onclick = () => openGameView(null);

// ---------- Tic-Tac-Toe with a friend (turn based, saved in localStorage) ----------
let games = read("pokeit_games", []);
let openGame = null;
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

$("challengeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const m = $("tttMsg");
  const name = $("friendName").value.trim().toLowerCase();
  const friend = users.find((u) => u.role === "user" && u.username.toLowerCase() === name);
  if (!friend) { m.textContent = "No user with that username."; return; }
  if (friend.username === session.username) { m.textContent = "Challenge a friend, not yourself."; return; }
  games = read("pokeit_games", []);
  const g = { id: Date.now(), x: session.username, o: friend.username, cells: Array(9).fill(""), turn: "x", winner: null };
  games.push(g);
  saveGames();
  openGame = g.id;
  m.textContent = "";
  $("friendName").value = "";
  renderGames();
});
function saveGames() { write("pokeit_games", games); }

function renderGames() {
  if (!session || session.role !== "user") return;
  games = read("pokeit_games", []);
  const mine = games.filter((g) => g.x === session.username || g.o === session.username);
  const list = $("gameList");
  list.replaceChildren();
  if (!mine.length) list.append(el("p", "hint", "No games yet. Challenge a friend by username."));
  mine.slice().reverse().forEach((g) => {
    const opp = g.x === session.username ? g.o : g.x;
    let status;
    if (g.winner === "draw") status = "Draw";
    else if (g.winner) status = g[g.winner] === session.username ? "You won" : "You lost";
    else status = g[g.turn] === session.username ? "Your turn" : "Waiting for @" + opp;
    const row = el("button", "game-row" + (g.id === openGame ? " on" : ""), "vs @" + opp + ": " + status);
    row.type = "button";
    row.onclick = () => { openGame = g.id; renderGames(); };
    list.append(row);
  });
  drawBoard();
}

function drawBoard() {
  const b = $("board");
  b.replaceChildren();
  const g = games.find((x) => x.id === openGame);
  b.classList.toggle("hidden", !g);
  if (!g) return;
  const myMark = g.x === session.username ? "x" : "o";
  const myTurn = !g.winner && g.turn === myMark;
  g.cells.forEach((c, i) => {
    const cell = el("button", "cell" + (c ? " " + c : ""), c.toUpperCase());
    cell.type = "button";
    cell.disabled = !!c || !myTurn;
    cell.setAttribute("aria-label", "Cell " + (i + 1) + (c ? ", " + c.toUpperCase() : ""));
    cell.onclick = () => playMove(g.id, i);
    b.append(cell);
  });
}

function playMove(id, i) {
  games = read("pokeit_games", []);
  const g = games.find((x) => x.id === id);
  if (!g || g.winner || g.cells[i] || g[g.turn] !== session.username) return;
  g.cells[i] = g.turn;
  if (LINES.some((l) => l.every((k) => g.cells[k] === g.turn))) {
    g.winner = g.turn;
    const me = users.find((u) => u.username === session.username);
    addPoints(me, 10);
    saveUsers();
    toast("You won! +10 points");
  } else if (g.cells.every(Boolean)) {
    g.winner = "draw";
    toast("It's a draw.");
  } else {
    g.turn = g.turn === "x" ? "o" : "x";
  }
  saveGames();
  updateSpinUI();
  renderGames();
  refreshRank();
}

// Keep two open tabs in sync (friend plays in another tab)
window.addEventListener("storage", (e) => {
  if (e.key === "pokeit_users") { users = read("pokeit_users", users); if (session) { render(); renderLeaderboard(); } }
  if (e.key === "pokeit_games" && session && session.role === "user") renderGames();
  if (e.key === "pokeit_rooms" && session && session.role === "user") {
    renderGroupBoxes();
    if (openRoom && !$("roomPanel").classList.contains("hidden")) renderRoom();
  }
});

// ---------- Ranking: King / Queen ----------
let kingName = null;
function addPoints(u, n) {
  if (!n) return;
  u.points = (u.points || 0) + n;
  u.pointsAt = Date.now(); // on a tie, whoever reached the score first stays on top
}
function ranking() {
  return users
    .filter((u) => u.role === "user" && (u.points || 0) > 0)
    .sort((a, b) => (b.points - a.points) || ((a.pointsAt || 0) - (b.pointsAt || 0)) || a.username.localeCompare(b.username));
}
const titleOf = (u) => (u.gender === "Male" ? "King" : u.gender === "Female" ? "Queen" : "Champion");

function renderRoyal() {
  const box = $("royal");
  box.replaceChildren();
  const top = ranking()[0];
  kingName = top ? top.username : null;
  box.classList.toggle("hidden", !top);
  if (!top) return;
  const info = el("div");
  info.append(el("small", "", titleOf(top) + " of Poke it"), el("strong", "gold", "@" + top.username));
  box.append(el("span", "crown", "⭐"), info, el("span", "pts-label", top.points + " pts"));
}

function renderLeaderboard() {
  const p = $("rankPanel");
  p.replaceChildren();
  const r = ranking().slice(0, 10);
  if (!r.length) { p.append(el("p", "hint", "No points yet. Spin the wheel or win a game to join the ranking.")); return; }
  const ol = el("ol", "rank-list");
  r.forEach((u, i) => {
    const li = el("li", (i === 0 ? "first" : "") + (session && u.username === session.username ? " me" : ""));
    const name = el("span", i === 0 ? "gold" : "", "@" + u.username);
    if (i === 0) name.append(el("small", "", titleOf(u)));
    li.append(el("span", "pos", i === 0 ? "⭐" : "#" + (i + 1)), name, el("b", "", u.points + " pts"));
    ol.append(li);
  });
  p.append(ol);
}
function refreshRank() { renderRoyal(); renderLeaderboard(); if (session) render(); }

// ---------- Rock Paper Scissors + Memory Match (solo games) ----------
const meNow = () => users.find((u) => u.username === session.username);
// Points from solo games have a cooldown so they can't be farmed
function canEarn(me, key, ms) {
  me.earn = me.earn || {};
  if (me.earn[key] && Date.now() - me.earn[key] < ms) return false;
  me.earn[key] = Date.now();
  return true;
}

const RPS = ["rock", "paper", "scissors"];
const RPS_ICON = { rock: "✊", paper: "✋", scissors: "✌️" };
const rpsScore = [0, 0];
document.querySelectorAll(".rps").forEach((b) =>
  b.addEventListener("click", () => {
    const mine = b.dataset.m;
    const cpu = RPS[Math.floor(Math.random() * 3)];
    let text;
    if (mine === cpu) text = "Draw";
    else if (cpu === RPS[(RPS.indexOf(mine) + 1) % 3]) { rpsScore[1]++; text = "You lose"; }
    else {
      rpsScore[0]++;
      text = "You win!";
      const me = meNow();
      if (canEarn(me, "rps", 15000)) { addPoints(me, 2); saveUsers(); text += " +2 points"; updateSpinUI(); refreshRank(); }
      else text += " (points once every 15 seconds)";
    }
    $("rpsResult").textContent = RPS_ICON[mine] + " vs " + RPS_ICON[cpu] + ": " + text;
    $("rpsScore").textContent = rpsScore[0] + " : " + rpsScore[1];
  })
);

const MEM_ICONS = ["🐶", "🦊", "🐼", "🐸", "🦄", "🐧", "🚀", "🍕"];
let memCards = [], memOpen = [], memMoves = 0, memLock = false;

function newMemory() {
  const deck = [...MEM_ICONS, ...MEM_ICONS].map((v) => ({ v, up: false, done: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  memCards = deck; memOpen = []; memMoves = 0; memLock = false;
  $("memMsg").textContent = "Find all 8 pairs to earn 5 points.";
  drawMemory();
}
function drawMemory() {
  $("memMoves").textContent = memMoves;
  const g = $("memGrid");
  g.replaceChildren();
  memCards.forEach((c, i) => {
    const shown = c.up || c.done;
    const b = el("button", "mem-card" + (shown ? " up" : "") + (c.done ? " done" : ""), shown ? c.v : "?");
    b.type = "button";
    b.disabled = shown || memLock;
    b.setAttribute("aria-label", shown ? c.v : "Hidden card " + (i + 1));
    b.onclick = () => flipCard(i);
    g.append(b);
  });
}
function flipCard(i) {
  const c = memCards[i];
  if (memLock || c.up || c.done) return;
  c.up = true;
  memOpen.push(i);
  if (memOpen.length === 2) {
    memMoves++;
    const [a, b] = memOpen;
    if (memCards[a].v === memCards[b].v) {
      memCards[a].done = memCards[b].done = true;
      memCards[a].up = memCards[b].up = false;
      memOpen = [];
      if (memCards.every((x) => x.done)) finishMemory();
    } else {
      memLock = true;
      setTimeout(() => { memCards[a].up = memCards[b].up = false; memOpen = []; memLock = false; drawMemory(); }, 800);
    }
  }
  drawMemory();
}
function finishMemory() {
  const me = meNow();
  let msg = "Done in " + memMoves + " moves!";
  if (canEarn(me, "mem", 60000)) { addPoints(me, 5); saveUsers(); msg += " +5 points"; updateSpinUI(); refreshRank(); }
  else msg += " (points once per minute)";
  $("memMsg").textContent = msg;
}
$("memNew").onclick = newMemory;

// ---------- Group rooms: every game can be played with a group ----------
// Create a room, share the 4-letter code, friends join, host starts the game.
let rooms = read("pokeit_rooms", []);
let openRoom = null;
const GAME_NAMES = { spin: "Spin wheel", ttt: "Tic-Tac-Toe", rps: "Rock Paper Scissors", mem: "Memory Match" };
const MAX_PLAYERS = 8, WIN_POINTS = 10;
const saveRooms = () => write("pokeit_rooms", rooms);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const teamOf = (r, mark) => r.players.filter((_, i) => (i % 2 === 0) === (mark === "x"));

// a "Play with a group" box inside each game
Object.keys(GAME_NAMES).forEach((k) => { const d = el("div", "group-box"); d.dataset.game = k; $(PANELS[k]).append(d); });

function renderGroupBoxes() {
  if (!session || session.role !== "user") return;
  rooms = read("pokeit_rooms", []);
  document.querySelectorAll(".group-box").forEach((box) => {
    const game = box.dataset.game;
    box.replaceChildren(el("h3", "", "👥 Play with a group"));
    const create = el("button", "btn primary sm", "Create room");
    create.type = "button";
    create.onclick = () => createRoom(game);
    const form = el("form", "comment-form");
    const input = el("input"); input.placeholder = "Room code"; input.maxLength = 4; input.required = true;
    form.append(input, el("button", "btn sm", "Join"));
    form.onsubmit = (e) => { e.preventDefault(); joinRoom(input.value.trim().toUpperCase()); };
    box.append(create, form);
    rooms.filter((r) => r.game === game && r.players.includes(session.username)).slice(-4).reverse().forEach((r) => {
      const state = r.status === "lobby" ? "waiting for players" : r.status === "playing" ? "in progress" : "finished";
      const b = el("button", "game-row", "Room " + r.id + ": " + state + " (" + r.players.length + " players)");
      b.type = "button";
      b.onclick = () => enterRoom(r.id);
      box.append(b);
    });
  });
}

function createRoom(game) {
  rooms = read("pokeit_rooms", []);
  let code;
  do { code = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join(""); }
  while (rooms.some((r) => r.id === code));
  rooms.push({ id: code, game, host: session.username, players: [session.username], status: "lobby", st: {}, winners: [] });
  saveRooms();
  enterRoom(code);
}
function joinRoom(code) {
  rooms = read("pokeit_rooms", []);
  const r = rooms.find((x) => x.id === code);
  if (!r) { toast("No room with that code."); return; }
  if (!r.players.includes(session.username)) {
    if (r.status !== "lobby") { toast("That game already started."); return; }
    if (r.players.length >= MAX_PLAYERS) { toast("That room is full."); return; }
    r.players.push(session.username);
    saveRooms();
  }
  enterRoom(code);
}
function enterRoom(id) {
  openRoom = id;
  openGameView("room");
  $("gameTitle").textContent = "👥 Room " + id;
  renderRoom();
}

// change a room safely: re-read, edit, save, redraw
function roomAct(id, fn) {
  rooms = read("pokeit_rooms", []);
  const r = rooms.find((x) => x.id === id);
  if (!r) return;
  const was = r.status;
  fn(r);
  saveRooms();
  renderRoom();
  if (was !== "done" && r.status === "done") { updateSpinUI(); refreshRank(); }
}
function initRoom(r) {
  r.status = "playing";
  if (r.game === "spin") r.st = { spins: {} };
  if (r.game === "ttt") r.st = { cells: Array(9).fill(""), turn: "x", n: { x: 0, o: 0 } };
  if (r.game === "rps") r.st = { round: 1, picks: {}, scores: {}, last: "" };
  if (r.game === "mem") r.st = { cards: shuffle([...MEM_ICONS, ...MEM_ICONS]).map((v) => ({ v, o: null })), open: [], turn: 0, scores: {}, at: 0 };
}
function finishRoom(r, winners, text) {
  r.status = "done"; r.winners = winners; r.st.result = text;
  if (winners.length) {
    users = read("pokeit_users", users);
    winners.forEach((n) => { const u = users.find((x) => x.username === n); if (u) addPoints(u, WIN_POINTS); });
    saveUsers();
  }
}

function renderRoom() {
  if (!session || session.role !== "user") return;
  rooms = read("pokeit_rooms", []);
  const box = $("roomBody"), me = session.username;
  const r = rooms.find((x) => x.id === openRoom);
  box.replaceChildren();
  if (!r) { box.append(el("p", "hint", "This room no longer exists.")); return; }

  const chips = el("div", "chips");
  r.players.forEach((p) => chips.append(el("span", "chip" + (p === me ? " me" : ""), "@" + p + (p === r.host ? " (host)" : ""))));
  box.append(el("p", "hint", GAME_NAMES[r.game] + ", room code " + r.id), chips);

  if (r.status === "lobby") {
    box.append(el("p", "", "Share the code " + r.id + " with friends. You need at least 2 players."));
    if (r.host === me) {
      const go = el("button", "btn primary sm", "Start game");
      go.type = "button"; go.disabled = r.players.length < 2;
      go.onclick = () => roomAct(r.id, (x) => { if (x.status === "lobby" && x.players.length >= 2) initRoom(x); });
      box.append(go);
    }
    const leave = el("button", "btn ghost sm", r.host === me ? "Close room" : "Leave room");
    leave.type = "button";
    leave.onclick = () => {
      rooms = read("pokeit_rooms", []);
      if (r.host === me) rooms = rooms.filter((x) => x.id !== r.id);
      else { const x = rooms.find((y) => y.id === r.id); if (x) x.players = x.players.filter((p) => p !== me); }
      saveRooms(); openRoom = null; renderGroupBoxes(); openGameView(null);
    };
    box.append(leave);
    return;
  }

  ({ spin: roomSpin, ttt: roomTtt, rps: roomRps, mem: roomMem })[r.game](r, box, me);

  if (r.status === "done") {
    box.append(el("p", "rps-result", r.st.result),
      el("p", "hint", r.winners.length ? "Winners (+" + WIN_POINTS + " points each): " + r.winners.map((n) => "@" + n).join(", ") : "No winners this time."));
  }
}

// --- Spin wheel: everyone spins once, highest prize wins
function roomSpin(r, box, me) {
  const sp = r.st.spins, next = r.players.find((p) => !sp[p]);
  const ul = el("ul", "room-list");
  r.players.forEach((p) => ul.append(el("li", "", "@" + p + ": " + (sp[p] ? sp[p].t : "not spun yet"))));
  box.append(ul);
  if (r.status !== "playing") return;
  if (next === me) {
    const b = el("button", "btn primary", "🎡 Spin now");
    b.type = "button";
    b.onclick = () => roomAct(r.id, (x) => {
      if (x.status !== "playing" || x.st.spins[me]) return;
      x.st.spins[me] = PRIZES[Math.floor(Math.random() * PRIZES.length)];
      if (x.players.every((p) => x.st.spins[p])) {
        const max = Math.max(...x.players.map((p) => x.st.spins[p].v));
        const w = max > 0 ? x.players.filter((p) => x.st.spins[p].v === max) : [];
        finishRoom(x, w, w.length ? "Highest spin wins!" : "Nobody scored. Draw.");
      }
    });
    box.append(b);
  } else box.append(el("p", "hint", "Waiting for @" + next + " to spin."));
}

// --- Tic-Tac-Toe: players split into Team X and Team O and rotate turns
function roomTtt(r, box, me) {
  const s = r.st, playing = r.status === "playing";
  const team = teamOf(r, s.turn), nextUser = playing ? team[s.n[s.turn] % team.length] : null;
  box.append(el("p", "hint", "Team X: " + teamOf(r, "x").map((n) => "@" + n).join(", ") + ". Team O: " + teamOf(r, "o").map((n) => "@" + n).join(", ") + "."));
  if (playing) box.append(el("p", "", nextUser === me ? "Your turn (" + s.turn.toUpperCase() + ")" : "Waiting for @" + nextUser + " (" + s.turn.toUpperCase() + ")"));
  const board = el("div", "board");
  s.cells.forEach((c, i) => {
    const cell = el("button", "cell" + (c ? " " + c : ""), c.toUpperCase());
    cell.type = "button";
    cell.disabled = !!c || nextUser !== me;
    cell.onclick = () => roomAct(r.id, (x) => {
      const t = x.st.turn, tm = teamOf(x, t);
      if (x.status !== "playing" || x.st.cells[i] || tm[x.st.n[t] % tm.length] !== me) return;
      x.st.cells[i] = t; x.st.n[t]++;
      if (LINES.some((l) => l.every((k) => x.st.cells[k] === t))) finishRoom(x, tm, "Team " + t.toUpperCase() + " wins!");
      else if (x.st.cells.every(Boolean)) finishRoom(x, [], "It's a draw.");
      else x.st.turn = t === "x" ? "o" : "x";
    });
    board.append(cell);
  });
  box.append(board);
}

// --- Rock Paper Scissors: 3 rounds, everyone picks, the winning shape scores
function roomRps(r, box, me) {
  const s = r.st;
  box.append(el("p", "", r.status === "playing" ? "Round " + s.round + " of 3" : "Game over"));
  if (s.last) box.append(el("p", "hint", "Last round: " + s.last));
  box.append(el("p", "hint", "Scores: " + r.players.map((p) => "@" + p + " " + (s.scores[p] || 0)).join(", ")));
  if (r.status !== "playing") return;
  if (s.picks[me]) {
    box.append(el("p", "hint", "Locked in. Waiting for " + r.players.filter((p) => !s.picks[p]).map((p) => "@" + p).join(", ") + "."));
    return;
  }
  const row = el("div", "rps-btns");
  RPS.forEach((m) => {
    const b = el("button", "rps", RPS_ICON[m]);
    b.type = "button"; b.setAttribute("aria-label", m);
    b.onclick = () => roomAct(r.id, (x) => {
      if (x.status !== "playing" || x.st.picks[me]) return;
      x.st.picks[me] = m;
      if (x.players.every((p) => x.st.picks[p])) resolveRps(x);
    });
    row.append(b);
  });
  box.append(row);
}
function resolveRps(x) {
  const s = x.st, types = [...new Set(Object.values(s.picks))];
  let text = x.players.map((p) => "@" + p + " " + RPS_ICON[s.picks[p]]).join(", ") + ": ";
  if (types.length === 2) {
    const [a, b] = types;
    const win = b === RPS[(RPS.indexOf(a) + 2) % 3] ? a : b;
    x.players.filter((p) => s.picks[p] === win).forEach((p) => (s.scores[p] = (s.scores[p] || 0) + 1));
    text += RPS_ICON[win] + " wins the round";
  } else text += "draw";
  s.last = text; s.picks = {};
  if (s.round >= 3) {
    const max = Math.max(0, ...x.players.map((p) => s.scores[p] || 0));
    const w = max ? x.players.filter((p) => (s.scores[p] || 0) === max) : [];
    finishRoom(x, w, w.length ? "Most round wins takes it!" : "No round wins. Draw.");
  } else s.round++;
}

// --- Memory Match: shared board, take turns, a match gives you another go
function roomMem(r, box, me) {
  const s = r.st, cur = r.players[s.turn % r.players.length], playing = r.status === "playing";
  box.append(el("p", "hint", "Scores: " + r.players.map((p) => "@" + p + " " + (s.scores[p] || 0)).join(", ")));
  if (playing) box.append(el("p", "", cur === me ? "Your turn: flip two cards" : "Waiting for @" + cur));
  const grid = el("div", "mem-grid");
  s.cards.forEach((c, i) => {
    const shown = c.o || s.open.includes(i);
    const b = el("button", "mem-card" + (shown ? " up" : "") + (c.o ? " done" : ""), shown ? c.v : "?");
    b.type = "button";
    b.disabled = shown || cur !== me || !playing || s.open.length >= 2;
    b.onclick = () => roomAct(r.id, (x) => {
      const st = x.st;
      if (x.status !== "playing" || x.players[st.turn % x.players.length] !== me || st.open.length >= 2 || st.cards[i].o || st.open.includes(i)) return;
      st.open.push(i);
      if (st.open.length === 2) {
        const [a, c2] = st.open;
        if (st.cards[a].v === st.cards[c2].v) {
          st.cards[a].o = st.cards[c2].o = me;
          st.scores[me] = (st.scores[me] || 0) + 1;
          st.open = [];
          if (st.cards.every((k) => k.o)) {
            const max = Math.max(...x.players.map((p) => st.scores[p] || 0));
            finishRoom(x, x.players.filter((p) => (st.scores[p] || 0) === max), "Most pairs wins!");
          }
        } else st.at = Date.now();
      }
    });
    grid.append(b);
  });
  box.append(grid);
  if (playing && s.open.length === 2) {
    // after a short peek, hide the cards and pass the turn
    setTimeout(() => roomAct(r.id, (x) => {
      const st = x.st;
      if (st.open.length === 2 && Date.now() - st.at >= 900) { st.open = []; st.turn = (st.turn + 1) % x.players.length; }
    }), Math.max(100, 1000 - (Date.now() - s.at)));
  }
}

// ---------- CG Guess: range guesses + owner approval ----------
const cgEntries = () => read("pokeit_cg_entries", []); // IDs only; no CGPA is stored.
const cgGuesses = () => read("pokeit_cg_guesses", []);
const cgFriendsData = () => read("pokeit_cg_friends", []);
let cgResultsOpen = false;
let ctResultsOpen = false;
$("cgResultsToggle").addEventListener("click", () => {
  cgResultsOpen = !cgResultsOpen;
  $("cgResultsPanel").classList.toggle("hidden", !cgResultsOpen);
  $("cgResultsToggle").setAttribute("aria-expanded", String(cgResultsOpen));
  $("cgResultsToggle").innerHTML = `☰ CG Guess Results <span id="cgResultsCount">(${cgGuesses().length})</span> ${cgResultsOpen ? "▴" : "▾"}`;
  if (cgResultsOpen) renderCgResults();
});
$("ctResultsToggle").addEventListener("click", () => {
  ctResultsOpen = !ctResultsOpen;
  $("ctResultsPanel").classList.toggle("hidden", !ctResultsOpen);
  $("ctResultsToggle").setAttribute("aria-expanded", String(ctResultsOpen));
  $("ctResultsToggle").innerHTML = `☰ CT Guess Results <span id="ctResultsCount">(${ctGuesses().length})</span> ${ctResultsOpen ? "▴" : "▾"}`;
  if (ctResultsOpen) renderCtResults();
});
function renderCgResults() {
  const panel = $("cgResultsPanel");
  if (!panel) return;
  const all = cgGuesses().slice().sort((a, b) => (b.t || 0) - (a.t || 0));
  const count = $("cgResultsCount");
  if (count) count.textContent = `(${all.length})`;
  panel.replaceChildren();
  if (!cgResultsOpen) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  panel.append(el("p", "hint", "Shows who guessed whom. Guessed CGPA ranges are hidden."));
  if (!all.length) panel.append(el("p", "hint", "No CG guesses yet."));
  all.forEach(g => {
    const fromUser = users.find(u => u.username === g.user && u.role === "user");
    const fromId = fromUser?.sid || "ID not linked";
    panel.append(el("div", "cg-row", `ID ${fromId} guessed ID ${g.studentId || "Unknown ID"}`));
  });
}
function renderCtResults() {
  const panel = $("ctResultsPanel");
  if (!panel) return;
  const all = ctGuesses().slice().sort((a, b) => (b.t || 0) - (a.t || 0));
  const count = $("ctResultsCount");
  if (count) count.textContent = `(${all.length})`;
  panel.replaceChildren();
  if (!ctResultsOpen) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  panel.append(el("p", "hint", "Shows who guessed which student and course. CT marks are hidden."));
  if (!all.length) panel.append(el("p", "hint", "No CT guesses yet."));
  all.forEach(g => {
    const fromUser = users.find(u => u.username === g.user && u.role === "user");
    const fromId = fromUser?.sid || "ID not linked";
    panel.append(el("div", "cg-row", `ID ${fromId} guessed ID ${g.studentId} — ${g.course}`));
  });
}
const cgIds = () => cgEntries().map((x) => x.id);
function rangeOptions() {
  const sel = $("cgVal");
  const previous = sel.value;
  sel.replaceChildren();
  const first = el("option", "", "Select a range"); first.value = ""; sel.append(first);
  for (let n = 0; n < 400; n += 5) {
    const low = (n / 100).toFixed(2), high = ((n + 5) / 100).toFixed(2);
    const o = el("option", "", low + " to " + high); o.value = low + "-" + high; sel.append(o);
  }
  if ([...sel.options].some(o => o.value === previous)) sel.value = previous;
}
function refreshCgIdOptions() {
  const sel = $("cgId"), previous = sel.value;
  sel.replaceChildren();
  const first = el("option", "", "Select student ID"); first.value = ""; sel.append(first);
  cgIds().forEach(id => { const o = el("option", "", id); o.value = id; sel.append(o); });
  if (cgIds().includes(previous)) sel.value = previous;
}
$("cgForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const m = $("cgMsg"), id = $("cgId").value, range = $("cgVal").value;
  const me = users.find(u => u.username === session.username);
  if (!id || !range) { m.textContent = "Select an ID and a CGPA range."; return; }
  if (me && me.sid === id) { m.textContent = "You can't guess your own ID."; return; }
  const owner = users.find(u => u.role === "user" && u.sid === id);
  if (!owner) { m.textContent = "This ID is not linked to a registered user yet."; return; }
  if (cgFriendsData().some(f => f.users.includes(session.username) && f.users.includes(owner.username))) {
    m.textContent = "You are already friends with this student."; return;
  }
  const all = cgGuesses();
  if (all.some(g => g.user === session.username && g.studentId === id && g.status === "pending")) {
    m.textContent = "You already have a pending request for this ID."; return;
  }
  const [low, high] = range.split("-").map(Number);
  all.push({ id: Date.now() + Math.random(), user: session.username, target: owner.username,
    studentId: id, low, high, status: "pending", t: Date.now() });
  write("pokeit_cg_guesses", all);
  m.textContent = "Request sent to @" + owner.username + ". They can accept or decline.";
  $("cgVal").value = "";
  renderCg();
});
function friendsOf(name) {
  return [...new Set(cgFriendsData().filter(f => f.users.includes(name)).map(f => {
    const other = f.users.find(u => u !== name);
    return other ? avatarOf(other) + " @" + other : "";
  }).filter(Boolean))];
}
function renderCg() {
  if (!session || session.role !== "user") return;
  refreshCgIdOptions(); rangeOptions();
  const notifications = $("cgNotifications"); notifications.replaceChildren();
  const all = cgGuesses();
  const incoming = all.filter(g => g.target === session.username && g.status === "pending");
  if (!incoming.length) notifications.append(el("p", "hint", "No new requests."));
  incoming.forEach(g => {
    const row = el("div", "cg-row");
    row.append(el("span", "", "@" + g.user + " guessed your CGPA range: " + g.low.toFixed(2) + " to " + g.high.toFixed(2) + " (ID " + g.studentId + ")."));
    const accept = el("button", "act approve", "Accept"); accept.type = "button";
    accept.onclick = () => {
      const latest = cgGuesses(), req = latest.find(x => x.id === g.id);
      if (!req || req.status !== "pending" || req.target !== session.username) return;
      req.status = "accepted"; write("pokeit_cg_guesses", latest);
      const friends = cgFriendsData();
      if (!friends.some(f => f.users.includes(req.user) && f.users.includes(req.target))) {
        friends.push({ users: [req.user, req.target], t: Date.now() }); write("pokeit_cg_friends", friends);
      }
      toast("You and @" + req.user + " are now friends!"); renderCg();
    };
    const decline = el("button", "act reject", "Decline"); decline.type = "button";
    decline.onclick = () => {
      const latest = cgGuesses(), req = latest.find(x => x.id === g.id);
      if (req && req.target === session.username && req.status === "pending") {
        req.status = "declined"; write("pokeit_cg_guesses", latest); renderCg();
      }
    };
    row.append(accept, decline); notifications.append(row);
  });
  const sent = all.filter(g => g.user === session.username && g.status === "pending");
  if (sent.length) {
    notifications.append(el("strong", "", "Requests you sent"));
    sent.forEach(g => notifications.append(el("div", "cg-friend", "Waiting for @" + g.target + " — range " + g.low.toFixed(2) + " to " + g.high.toFixed(2))));
  }
  const box = $("cgFriends"); box.replaceChildren();
  const friends = friendsOf(session.username);
  if (!friends.length) box.append(el("p", "hint", "No friends yet. Send a guess request!"));
  friends.forEach(x => box.append(el("div", "cg-friend", x)));
}

// ---------- CT number guessing: at most two guesses per course per user ----------
const ctGuesses = () => read("pokeit_ct_guesses", []);
function refreshCtIdOptions() {
  const sel = $("ctId"), previous = sel.value;
  sel.replaceChildren();
  const first = el("option", "", "Select student ID"); first.value = ""; sel.append(first);
  cgIds().forEach(id => { const o = el("option", "", id); o.value = id; sel.append(o); });
  if (cgIds().includes(previous)) sel.value = previous;
}
function renderCt() {
  if (!session || session.role !== "user") return;
  refreshCtIdOptions();
  const me = users.find(u => u.username === session.username);
  const guesses = ctGuesses().filter(g => g.user === session.username);
  const course = $("ctCourse").value.trim().toLowerCase();
  const targetId = $("ctId").value;
  const used = course && targetId ? guesses.filter(g => g.studentId === targetId && g.course.trim().toLowerCase() === course).length : 0;
  $("ctAttempts").textContent = course && targetId ? `Guesses used for ID ${targetId}, ${$("ctCourse").value.trim()}: ${used}/2` : "Maximum: 2 guesses per student ID and course.";
}
$("ctCourse").addEventListener("input", renderCt);
$("ctId").addEventListener("change", renderCt);
$("ctForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = $("ctId").value;
  const course = $("ctCourse").value.trim();
  const mark = Number($("ctMark").value);
  const me = users.find(u => u.username === session.username);
  const msg = $("ctMsg");
  if (!id || !course || !Number.isFinite(mark) || mark < 0 || mark > 100) { msg.textContent = "Select an ID, enter a course name and a mark from 0 to 100."; return; }
  if (me && me.sid === id) { msg.textContent = "You can't guess your own ID."; return; }
  if (!users.some(u => u.role === "user" && u.sid === id)) { msg.textContent = "This ID is not linked to a registered user yet."; return; }
  const all = ctGuesses();
  const used = all.filter(g => g.user === session.username && g.studentId === id && g.course.trim().toLowerCase() === course.trim().toLowerCase()).length;
  if (used >= 2) { msg.textContent = "You have used both guesses for this student ID and course."; return; }
  all.push({ id: Date.now() + Math.random(), user: session.username, studentId: id, course, mark, t: Date.now() });
  write("pokeit_ct_guesses", all);
  msg.textContent = "CT guess submitted. The mark will not appear in public results.";
  $("ctMark").value = "";
  renderCt();
  renderCtResults();
});

// Admin registers IDs only. Admin cannot set or view CGPAs.
function renderCgAdmin() {
  const feed = $("feed"); feed.replaceChildren();
  const card = el("div", "card post");
  card.append(el("h2", "", "CG Guess: student ID list"),
    el("p", "hint", "Add IDs for users to select. Admin cannot set or view CGPAs. For notifications, an ID must match the ID on a registered user's profile."));
  const form = el("form", "profile-form");
  const id = el("input"); id.placeholder = "Student ID"; id.required = true; id.maxLength = 20;
  const add = el("button", "btn primary sm", "Add student ID"); form.append(id, add);
  form.onsubmit = e => {
    e.preventDefault(); const sid = id.value.trim(); if (!sid) return;
    const list = cgEntries();
    if (list.some(x => x.id === sid)) { toast("This student ID is already listed."); return; }
    list.push({ id: sid }); write("pokeit_cg_entries", list); toast("Student ID added."); renderCgAdmin();
  };
  card.append(form);
  const entries = cgEntries();
  if (!entries.length) card.append(el("p", "hint", "No student IDs added yet."));
  entries.forEach(x => {
    const owner = users.find(u => u.role === "user" && u.sid === x.id);
    const count = cgGuesses().filter(g => g.studentId === x.id).length;
    const row = el("div", "cg-row");
    row.append(el("span", "", "ID " + x.id + (owner ? " — @" + owner.username : " — not linked to a user") + " (" + count + " requests)"));
    const del = el("button", "act reject", "Delete"); del.type = "button";
    del.onclick = () => {
      write("pokeit_cg_entries", cgEntries().filter(y => y.id !== x.id));
      write("pokeit_cg_guesses", cgGuesses().filter(g => g.studentId !== x.id)); renderCgAdmin();
    };
    row.append(del); card.append(row);
  });
  feed.append(card);
}

// ---------- Boot ----------
if (session && users.some((u) => u.username === session.username)) startApp();
else show("welcome");