/* 回放解析面板（详情页 r.html / 解析器 replay-tool.html 共用）。
 * 同一文件也打进游戏页平台 bundle，供游戏内原生“重播”窗口的“🔍 解析”使用（terminal.js 传 host）。
 * 输入是服务器解析好的回放 JSON（Main.java 格式）；解码/编码只在服务器（platform/replay-codec.js），
 * 本文件只负责显示，样式随渲染注入（只作用于 .rv 内部），不依赖页面 CSS。界面与分类沿用 tt 的 replay_viewer：配置、玩家、操作时间轴、类型/玩家筛选、导出 JSON。
 * 所有文本经 esc()、数字经 num()，颜色用 style 属性赋值，导入的 JSON 不能注入页面。 */
(function () {
  "use strict";
  // host: { esc, modeLabel, mapLabel, fmtDuration, copyText, toast }; public pages use CNPages.
  var P = null;
  var STYLE_ID = "cn-rv-style";
  var CSS = ".rv{margin-top:6px;color:#dce5ef;font-size:13px;line-height:1.5;text-align:left}.rv-h{font-size:13px;letter-spacing:3px;color:#8ff0bb;margin:22px 0 10px;font-weight:bold}.rv-sub{font-size:11px;color:#5c6b7d;letter-spacing:.5px;font-weight:normal}.rv-warn{border:1px solid rgba(255,184,107,.45);color:#ffb86b;font-size:12px;line-height:1.7;padding:10px 12px;margin-bottom:12px}.rv-actions{display:flex;gap:8px;flex-wrap:wrap}.rv-btn{border:1px solid #2a3542;background:transparent;color:#a9b8c9;font-size:12px;padding:4px 12px;cursor:pointer;letter-spacing:1px;font-family:inherit}.rv-btn:hover{border-color:#7cc8ff;color:#7cc8ff}.rv-kv{width:100%;border-collapse:collapse;margin-bottom:20px}.rv-kv td{padding:9px 6px;border-bottom:1px solid #1e2733;font-size:12px;color:#dce5ef;letter-spacing:.5px;word-break:break-all}.rv-kv td:first-child{width:90px;color:#8b9bad;letter-spacing:2px;font-size:11px;word-break:normal}.rv-mono{font-family:Consolas,\"Cascadia Mono\",monospace;color:#7cc8ff}.rv-hidden{display:none}.rv-scroll{overflow:auto;max-height:520px;border:1px solid #1e2733}.rv-players{max-height:300px}.rv-table{width:100%;border-collapse:collapse;font-size:12px}.rv-table th{position:sticky;top:0;background:#141c25;color:#8b9bad;font-weight:normal;letter-spacing:1px;text-align:left;padding:7px 8px;white-space:nowrap}.rv-table td{padding:6px 8px;border-top:1px solid #1a222c;color:#dce5ef;white-space:nowrap}.rv-dot{display:inline-block;width:9px;height:9px;margin-right:6px;vertical-align:0;border:1px solid rgba(255,255,255,.25)}.rv-badge{font-size:11px;padding:1px 6px;border:1px solid;letter-spacing:1px}.rv-stage{font-size:11px;color:#8b9bad}.rv-stage.pick{color:#ffb86b}.rv-filters{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px}.rv-filter{border:1px solid #2a3542;padding:4px 10px;font-size:12px;color:#a9b8c9;max-width:100%}.rv-filter summary{cursor:pointer;letter-spacing:1px}.rv-checks{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:2px 12px;max-height:180px;overflow:auto;padding:8px 0 4px}.rv-check{font-size:12px;color:#a9b8c9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}.rv-check input{accent-color:#7cc8ff;vertical-align:-2px}.rv-sentinel{height:1px}.rv-swatch{display:inline-block;width:22px;height:11px;vertical-align:-1px;border:1px solid rgba(255,255,255,.3)}.rv-team{display:inline-block;font-size:11px;padding:0 6px;margin-right:6px;border:1px solid;letter-spacing:1px;white-space:nowrap}";
  var NEUTRAL = 512;
  // Team deal recomputed by the server from the game's own rule (tags.teamDeal); colour index = native team colour.
  var TEAM_NAMES = ["灰", "红", "绿", "蓝", "黄", "紫", "青", "白", "黑"];
  // The game's own readable team text colours (bo.bq), not the raw territory colours.
  var TEAM_RGB = ["210,200,200", "255,120,120", "0,230,0", "150,150,255", "240,240,25", "255,70,255", "25,240,240", "255,255,255", "170,170,170"];
  var SPAWN_SPAN = 50, MULTI_PER_TICK = 7, MS_PER_TICK = 56, PAGE = 400;
  var EMOJIS = ["\u{1F970}","\u{1F60E}","\u{1F618}","\u{1F61C}","\u{1F917}","\u{1F973}","\u{1F607}","\u{1F60A}","\u{1F971}","\u{1F644}","\u{1F914}","\u{1F97A}","\u{1F621}","\u{1F62D}","\u{1F631}","\u{1F61E}","\u{1F480}","\u{1F479}","\u{1F44B}","\u{1F64F}","\u{1F44F}","\u{1F4AA}","\u{1F64B}‍♂️","\u{1F926}‍♂️","⬆️","➡️","⬇️","⬅️","\u{1F440}","❤️","\u{1F494}","\u{1F4A5}","\u{1F525}","\u{1FAA6}","\u{1F947}","\u{1F948}","\u{1F949}","\u{1F396}️","\u{1F3C5}","\u{1F451}","\u{1F389}","\u{1F4AF}","✝️","☪️","\u{1F549}️","☸️","✡️","☦️","⚛️"];
  var EMOJIS_CUSTOM = ["⚔️","⛵️","\u{1F4B0}","\u{1F91D}","⚖️","✌️","\u{1F54A}️","\u{1F6E1}️","\u{1F3F3}️","\u{1F44D}","\u{1F44E}","\u{1F198}","✊"];
  var FALLBACK_COLORS = ["#60a5fa","#f87171","#4ade80","#fbbf24","#a78bfa","#f472b6","#22d3ee","#fb923c","#a3e635","#e879f9","#38bdf8","#fca5a5"];
  var DIRS = ["↑上", "→右", "↓下", "←左"];

  function num(v) { var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function int(v) { return Math.trunc(num(v)); }
  function esc(v) { return P.esc(v); }

  function emojiOf(code) {
    code = int(code);
    if (code < 676) return String.fromCodePoint(0x1F1E6 + Math.floor(code / 26)) + String.fromCodePoint(0x1F1E6 + (code % 26));
    if (code - 676 < EMOJIS.length) return EMOJIS[code - 676];
    var j = code - (1024 - EMOJIS_CUSTOM.length);
    return j >= 0 && j < EMOJIS_CUSTOM.length ? EMOJIS_CUSTOM[j] : "⚛️";
  }
  function rate(r) { return "强度 " + ((int(r) + 1) / 1024 * 100).toFixed(2) + "%"; }
  function mmss(t) {
    if (t === null) return "?";
    var sec = Math.abs(t) * MS_PER_TICK / 1000, m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return (t < 0 ? "-" : "") + m + ":" + String(s).padStart(2, "0");
  }

  // Build a view model from the replay JSON. incomplete = timing unknown (truncated).
  function model(json, incomplete) {
    var humans = int(json.HumanCount), multi = humans > 1, base = multi ? SPAWN_SPAN + 1 : 0;
    var names = Array.isArray(json.PlayerNames) ? json.PlayerNames : [];
    var colors = Array.isArray(json.PlayerColors_RGB666) ? json.PlayerColors_RGB666 : [];
    var accounts = Array.isArray(json.AccountNames) ? json.AccountNames : [];
    // tt's "end" label is the replay's real end moment, not an operation.
    var all = Array.isArray(json.Operations) ? json.Operations : [];
    var endLabel = all.filter(function (o) { return o && o.Type === "end" && Number.isFinite(Number(o.Moment)); })[0] || null;
    var ops = all.filter(function (o) { return !(o && o.Type === "end"); }).map(function (o, i) {
      o = o && typeof o === "object" ? o : {};
      var raw = o.MultiTick !== undefined && o.MultiTick !== null ? int(o.MultiTick) : int(o.TiTick) + base;
      var t = null, pick = false;
      if (!incomplete) {
        pick = multi && raw <= SPAWN_SPAN;
        t = pick ? (raw - SPAWN_SPAN) * MULTI_PER_TICK : raw - base;
      }
      return { i: i, type: String(o.Type || "unknown"), player: int(o.PlayerIndex), d: o.data && typeof o.data === "object" ? o.data : {}, raw: raw, t: t, pick: pick };
    });
    var deadAt = {};
    ops.forEach(function (op) { if (op.type === "surrender" || op.type === "left") deadAt[op.player] = op.raw; });
    var last = 0;
    ops.forEach(function (op) { if (op.t !== null && op.t > last) last = op.t; });
    if (endLabel && !incomplete) last = Math.max(last, int(endLabel.Moment));
    return { json: json, humans: humans, multi: multi, names: names, colors: colors, accounts: accounts, ops: ops, deadAt: deadAt, incomplete: incomplete, totalSec: last * MS_PER_TICK / 1000 };
  }

  function colorOf(m, p) {
    var c = m.colors[p];
    if (Array.isArray(c) && c.length === 3) return "rgb(" + c.map(function (x) { return Math.round(Math.min(63, Math.max(0, int(x))) * 255 / 63); }).join(",") + ")";
    return FALLBACK_COLORS[p % FALLBACK_COLORS.length];
  }
  // tt 2026-10-26: in team games the territory colour is the team colour, so dots follow the deal.
  function dotColor(m, p) {
    var c = m.deal ? m.deal.players[p] : -1;
    return c >= 0 && c <= 8 ? "rgb(" + TEAM_RGB[c] + ")" : colorOf(m, p);
  }
  function dotHtml(m, p) {
    var c = m.deal ? m.deal.players[p] : -1, team = c >= 0 && c <= 8;
    return '<span class="rv-dot" data-color="' + int(p) + '"' + (team ? ' data-team="' + c + '" title="' + TEAM_NAMES[c] + (c === 0 ? "（人机）" : "队") + '"' : "") + "></span>";
  }
  function paintDots(scope, m) {
    scope.querySelectorAll(".rv-dot[data-color]").forEach(function (dot) { dot.style.background = dotColor(m, int(dot.getAttribute("data-color"))); });
  }
  function nameOf(m, p) {
    if (p === NEUTRAL) return "中立地区";
    var n = m.names[p];
    return typeof n === "string" && n.trim() ? n : "Player " + p;
  }
  function isBotOrDead(m, p, raw) {
    if (p === NEUTRAL) return false;
    if (p >= m.humans) return true;
    return m.deadAt[p] !== undefined && m.deadAt[p] <= raw;
  }
  function targetName(m, p, raw) {
    p = int(p);
    if (p === NEUTRAL) return "中立地区";
    if (m.deadAt[p] !== undefined && m.deadAt[p] <= raw) return "挂机玩家 #" + p + " " + nameOf(m, p);
    if (p >= m.humans) return "人机#" + p;
    return "#" + p + " " + nameOf(m, p);
  }

  // Same categories and colors as tt's viewer (all labels four characters).
  function kindOf(m, op) {
    var d = op.d;
    switch (op.type) {
      case "spawn": return { key: "0", label: "玩家选点", color: "#4ade80" };
      case "attack":
        if (int(d.defender) === NEUTRAL) return { key: "1N", label: "扩张空地", color: "#4ade80" };
        if (isBotOrDead(m, int(d.defender), op.raw)) return { key: "1B", label: "进攻人机", color: "#f59e0b" };
        return { key: "1P", label: "进攻玩家", color: "#f87171" };
      case "donate": return { key: "2", label: "支援玩家", color: "#60a5fa" };
      case "ship": return { key: "3", label: "发射船只", color: "#38bdf8" };
      case "recall": return { key: "4R", label: "召回船只", color: "#a78bfa" };
      case "intercept": return { key: "4I", label: "拦截船只", color: "#fbbf24" };
      case "call": case "peace": return { key: "PEACE", label: "和平投票", color: "#34d399" };
      case "withdraw": return { key: "5W", label: "撤销进攻", color: "#94a3b8" };
      case "emoji": return { key: "6", label: "发送表情", color: "#f472b6" };
      case "surrender": return { key: "8", label: "投降退出", color: "#64748b" };
      case "left": return { key: "9", label: "离开对局", color: "#64748b" };
      case "dig": return int(d.defender) === NEUTRAL ? { key: "10N", label: "进攻空地", color: "#fbbf24" } : { key: "10P", label: "指定进攻", color: "#fb923c" };
      default: return { key: "99", label: "未知操作", color: "#475569" };
    }
  }
  // Returns HTML: every text part is escaped; target players get the same colour dot as the player column.
  function detailOf(m, op) {
    var d = op.d, at = function (x, y) { return "(" + int(x) + ", " + int(y) + ")"; };
    var join = function (a) { return a.map(function (x) { return x && x.html !== undefined ? x.html : esc(x); }).join(" • "); };
    var target = function (p) { p = int(p); return { html: (p === NEUTRAL ? "" : dotHtml(m, p)) + esc(targetName(m, p, op.raw)) }; };
    switch (op.type) {
      case "spawn": return join(["选点坐标", at(d.x, d.y)]);
      case "attack": return join([rate(d.rate), target(d.defender)]);
      case "donate": return join([rate(d.rate), target(d.receiver)]);
      case "ship": return join([rate(d.rate), at(d.target_x, d.target_y), "登陆 " + (DIRS[int(d.direction)] || int(d.direction))]);
      case "recall": return join(["船 " + int(d.id), "召回"]);
      case "intercept": return join([rate(d.rate), "船 " + int(d.target_id)]);
      case "call": return join(["和平投票", "发起"]);
      case "withdraw": return join(["撤销进攻", target(d.target)]);
      case "emoji": return join(["发送表情", emojiOf(d.emoji_id)]);
      case "peace": return join(["和平投票", d.agreement ? "赞成" : "反对"]);
      case "surrender": return join(["退出对局", "投降"]);
      case "left": return join(["退出对局", "离开"]);
      case "dig": return join([rate(d.rate), target(d.defender), at(d.target_x, d.target_y)]);
      default: return esc("未知操作");
    }
  }

  // Accept the deal only in its exact shape: an integer team count and one colour index 0–8 per player.
  function teamDealOf(tags, json) {
    var d = tags && tags.teamDeal;
    if (!d || !Array.isArray(d.players) || d.players.length !== int(json.PlayerCount) || !(int(d.teams) >= 2 && int(d.teams) <= 8)) return null;
    for (var i = 0; i < d.players.length; i++) if (!(d.players[i] === int(d.players[i]) && d.players[i] >= 0 && d.players[i] <= 8)) return null;
    return d;
  }
  // Humans per team colour, in the order teams appear; bots are noted separately.
  function teamSummary(m, deal) {
    var counts = {}, order = [];
    for (var p = 0; p < m.humans; p++) { var c = deal.players[p]; if (counts[c] === undefined) { counts[c] = 0; order.push(c); } counts[c]++; }
    var bots = deal.players.slice(m.humans), spread = bots.some(function (c) { return c !== 0; });
    return order.map(function (c) { return TEAM_NAMES[c] + "队 " + counts[c] + " 人"; }).join(" · ") + (bots.length ? (spread ? " · 人机分散在各队" : " · 人机为灰队") : "");
  }
  function configRows(m, tags) {
    var j = m.json, mapKey = tags && tags.map ? tags.map : "";
    // tt mapped GameMode 0/1 to 单机/联机, but real 9-human BR replays carry
    // GameMode 0; online vs single comes from the human count instead.
    var mode = (tags && tags.mode ? P.modeLabel(tags.mode) + " · " : "") + (m.multi ? "联机" : "单机");
    return [
      ["地图", P.mapLabel(mapKey) + (mapKey && P.mapLabel(mapKey) !== mapKey ? "（" + mapKey + "）" : "") + " · 种子 " + int(j.MapSeed)],
      ["玩家", "总 " + int(j.PlayerCount) + " · 人类 " + m.humans + " · 视角 #" + int(j.SelectedPlayer)],
      ["模式", mode + " · 队伍 " + int(j.NumberTeams) + (j.IsZombieMode ? " · 僵尸" : "") + (j.IsContest ? " · 竞赛" : "")],
      ["地形", "水面" + (j.PassibleWater ? "可" : "不可") + "通行 · 山地" + (j.PassibleMountains ? "可" : "不可") + "通行"],
      m.deal ? ["分队", teamSummary(m, m.deal) + "（回放不存分队，按游戏开局规则推算）"] : null,
      ["回放", "格式 v" + int(j.TerritorialVersion) + " · " + m.ops.length + " 条操作" + (m.incomplete ? " · 不完整（缺少时间信息）" : " · 约 " + P.fmtDuration(m.totalSec))],
      ["时间轴", m.multi ? "联机：选点阶段为负值（前 50 个 MultiTick，1 MultiTick = 7 TiTick），对局阶段 TiTick = MultiTick − 51；时间按每 TiTick 约 56ms 估算" : "单机：TiTick = MultiTick；时间按每 TiTick 约 56ms 估算"]
    ].filter(Boolean);
  }

  function downloadText(name, text) {
    var url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }

  // opts: { tags, code (replay text, for 查看回放), fileName }
  function render(box, json, opts) {
    opts = opts || {};
    P = opts.host || window.CNPages;
    var host = P;
    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    // Fresh root per render so re-rendering the same box never stacks listeners.
    var root = document.createElement("div");
    box.innerHTML = "";
    box.appendChild(root);
    var tags = opts.tags || null;
    var m = model(json, !!(tags && tags.status === "incomplete"));
    m.deal = teamDealOf(tags, json);
    var state = { kinds: {}, players: {}, kindSel: {}, playerSel: {}, hidePick: false, shown: 0, rows: [] };
    m.ops.forEach(function (op) {
      var k = kindOf(m, op);
      op.kind = k;
      (state.kinds[k.key] = state.kinds[k.key] || { k: k, n: 0 }).n++;
      state.players[op.player] = (state.players[op.player] || 0) + 1;
    });
    var spawnAt = {};
    m.ops.forEach(function (op) { if (op.type === "spawn") spawnAt[op.player] = op.d; });

    var players = Object.keys(state.players).map(Number).sort(function (a, b) { return state.players[b] - state.players[a]; });
    root.innerHTML =
      '<div class="rv">' +
        (m.incomplete ? '<div class="rv-warn">这条回放不完整（常见于手机复制被截断），只能显示对局信息和读到的部分操作，时间未知。</div>' : "") +
        '<div class="rv-actions">' +
          '<button type="button" class="rv-btn" data-rv="export">导出 JSON</button>' +
          '<button type="button" class="rv-btn" data-rv="copy-json">复制 JSON</button>' +
          (opts.code ? '<button type="button" class="rv-btn" data-rv="watch">查看回放</button>' : "") +
        '</div>' +
        '<h3 class="rv-h">对局配置</h3><table class="rv-kv rv-cfg">' +
          configRows(m, tags).map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td></tr>"; }).join("") +
        "</table>" +
        '<h3 class="rv-h">玩家 <span class="rv-sub">' + players.length + ' 名有操作</span></h3>' +
        '<div class="rv-scroll rv-players"><table class="rv-table"><thead><tr><th>编号</th><th>名字</th>' + (m.deal ? "<th>颜色</th>" : "") + '<th>账号</th><th>操作数</th><th>选点</th></tr></thead><tbody>' +
          players.map(function (p) {
            var s = spawnAt[p];
            return '<tr><td class="rv-mono">' + p + "</td><td>" + dotHtml(m, p) + esc(nameOf(m, p)) + "</td>" + (m.deal ? '<td><span class="rv-swatch" data-own="' + p + '"></span></td>' : "") + '<td class="rv-mono">' + esc(typeof m.accounts[p] === "string" ? m.accounts[p] : "—") + "</td><td>" + state.players[p] + '</td><td class="rv-mono">' + (s ? "(" + int(s.x) + ", " + int(s.y) + ")" : "—") + "</td></tr>";
          }).join("") +
        "</tbody></table></div>" +
        '<h3 class="rv-h">操作时间轴</h3>' +
        '<div class="rv-filters">' +
          '<details class="rv-filter"><summary>类型：<span data-rv="kind-sum">全部</span></summary><div class="rv-checks" data-rv="kinds"></div></details>' +
          '<details class="rv-filter"><summary>玩家：<span data-rv="player-sum">全部</span></summary><div class="rv-checks" data-rv="players"></div></details>' +
          (m.multi && !m.incomplete ? '<label class="rv-check"><input type="checkbox" data-rv="hide-pick"> 隐藏选点阶段</label>' : "") +
          '<span class="rv-sub" data-rv="info"></span>' +
        "</div>" +
        '<div class="rv-scroll" data-rv="ops-scroll"><table class="rv-table rv-ops"><thead><tr><th>TiTick</th><th>时间</th><th>阶段</th><th>玩家</th><th>类型</th><th>详情</th></tr></thead><tbody data-rv="ops"></tbody></table><div class="rv-sentinel" data-rv="sentinel"></div></div>' +
      "</div>";
    var q = function (name) { return root.querySelector('[data-rv="' + name + '"]'); };
    paintDots(root, m);
    root.querySelectorAll(".rv-swatch[data-own]").forEach(function (sw) { var p = int(sw.getAttribute("data-own")); sw.style.background = colorOf(m, p); sw.title = colorOf(m, p); });

    var kindKeys = Object.keys(state.kinds);
    q("kinds").innerHTML = kindKeys.map(function (key) {
      var k = state.kinds[key];
      return '<label class="rv-check"><input type="checkbox" data-k="' + esc(key) + '"> ' + esc(k.k.label) + ' <span class="rv-sub">(' + k.n + ")</span></label>";
    }).join("");
    q("players").innerHTML = players.map(function (p) {
      return '<label class="rv-check"><input type="checkbox" data-p="' + p + '"> ' + dotHtml(m, p) + "#" + p + " " + esc(nameOf(m, p)) + ' <span class="rv-sub">(' + state.players[p] + ")</span></label>";
    }).join("");

    function apply() {
      var ks = Object.keys(state.kindSel), ps = Object.keys(state.playerSel);
      q("kind-sum").textContent = ks.length ? "已选 " + ks.length + "/" + kindKeys.length : "全部";
      q("player-sum").textContent = ps.length ? "已选 " + ps.length + "/" + players.length : "全部";
      state.rows = m.ops.filter(function (op) {
        if (ks.length && !state.kindSel[op.kind.key]) return false;
        if (ps.length && !state.playerSel[op.player]) return false;
        return !(state.hidePick && op.pick);
      });
      state.shown = 0;
      q("ops").innerHTML = "";
      more();
    }
    function more() {
      var frag = document.createDocumentFragment();
      state.rows.slice(state.shown, state.shown + PAGE).forEach(function (op) {
        var tr = document.createElement("tr");
        tr.innerHTML = '<td class="rv-mono">' + (op.t === null ? "?" : op.t) + '</td><td class="rv-mono">' + mmss(op.t) + "</td>" +
          '<td><span class="rv-stage' + (op.pick ? " pick" : "") + '">' + (op.t === null ? "未知" : op.pick ? "选点" : "对局") + "</span></td>" +
          "<td>" + dotHtml(m, op.player) + "#" + op.player + " " + esc(nameOf(m, op.player)) + "</td>" +
          '<td><span class="rv-badge">' + esc(op.kind.label) + "</span></td><td>" + detailOf(m, op) + "</td>";
        paintDots(tr, m);
        var badge = tr.querySelector(".rv-badge");
        badge.style.color = op.kind.color; badge.style.borderColor = op.kind.color;
        frag.appendChild(tr);
      });
      q("ops").appendChild(frag);
      state.shown = Math.min(state.rows.length, state.shown + PAGE);
      q("info").textContent = "共 " + state.rows.length + " 条" + (state.shown < state.rows.length ? "，已显示 " + state.shown + " 条（向下滚动自动加载）" : "");
    }
    // Load the next page when the end of the timeline scrolls into view (inside its own scroll box).
    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; }) && state.shown < state.rows.length) more();
      }, { root: q("ops-scroll"), rootMargin: "0px 0px 300px 0px" }).observe(q("sentinel"));
    } else PAGE = Infinity;
    root.addEventListener("change", function (e) {
      var t = e.target;
      if (t.hasAttribute("data-k")) { if (t.checked) state.kindSel[t.getAttribute("data-k")] = true; else delete state.kindSel[t.getAttribute("data-k")]; apply(); }
      else if (t.hasAttribute("data-p")) { if (t.checked) state.playerSel[t.getAttribute("data-p")] = true; else delete state.playerSel[t.getAttribute("data-p")]; apply(); }
      else if (t.getAttribute("data-rv") === "hide-pick") { state.hidePick = t.checked; apply(); }
    });
    root.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-rv]") : null;
      if (!b || b.tagName !== "BUTTON") return;
      var action = b.getAttribute("data-rv");
      var text = function () { return JSON.stringify(json, null, 2); };
      if (action === "export") downloadText(opts.fileName || "replay.json", text());
      else if (action === "copy-json") host.copyText(text()).then(function () { host.toast("JSON 已复制"); }, function (err) { host.toast(err.message || String(err), true); });
      else if (action === "watch") {
        // tt: 复制回放代码并打开官方对应版本的回放页。
        var w = window.open("https://territorial.io/" + int(json.TerritorialVersion), "_blank");
        host.copyText(opts.code).then(function () { host.toast("已复制回放代码" + (w ? "并打开 territorial.io" : "；弹窗被拦截，请允许弹窗后重试")); }, function (err) { host.toast(err.message || String(err), true); });
      }
    });
    apply();
  }

  window.CNReplayView = { render: render };
})();
