/* 回放大厅（公开，无登录）：搜索 + 模式/地图 chips + 排序 + 滚动分页（before cursor, limit 50）。 */
(function () {
  "use strict";
  var P = window.CNPages;
  var state = { mode: "", map: "", q: "", sort: "created", next: null, loading: false, done: false, total: 0 };
  var listEl = document.getElementById("cn-list");
  var emptyEl = document.getElementById("cn-empty");
  var errEl = document.getElementById("cn-error");
  var sentinel = document.getElementById("cn-sentinel");
  var countEl = document.getElementById("cn-count");
  var searchEl = document.getElementById("cn-search");
  var LIMIT = 50;

  function chip(label, active, onclick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (active ? " on" : "");
    b.textContent = label;
    b.onclick = onclick;
    return b;
  }

  function renderChips() {
    var modesBox = document.getElementById("cn-mode-chips");
    modesBox.appendChild(chip("全部", !state.mode, function () { setMode(""); }));
    P.MODES.forEach(function (m) {
      modesBox.appendChild(chip(m.label, state.mode === m.key, function () { setMode(m.key); }));
    });
    var mapsBox = document.getElementById("cn-map-chips");
    mapsBox.appendChild(chip("全部", !state.map, function () { setMap(""); }));
    P.MAPS.forEach(function (m) {
      mapsBox.appendChild(chip(m.label, state.map === m.key, function () { setMap(m.key); }));
    });
    var sortBox = document.getElementById("cn-sort-chips");
    sortBox.appendChild(chip("最新", state.sort === "created", function () { setSort("created"); }));
    sortBox.appendChild(chip("最热", state.sort === "views", function () { setSort("views"); }));
  }

  function setMode(k) { if (state.mode === k) return; state.mode = k; resetAndLoad(); }
  function setMap(k) { if (state.map === k) return; state.map = k; resetAndLoad(); }
  function setSort(k) { if (state.sort === k) return; state.sort = k; resetAndLoad(); }

  function resetAndLoad() {
    state.next = null;
    state.done = false;
    state.total = 0;
    listEl.innerHTML = "";
    hideEmpty();
    hideError();
    load();
  }

  function showLoading() {
    var el = document.createElement("div");
    el.className = "cn-loading";
    el.id = "cn-loading";
    el.textContent = state.total ? "加载更多" : "载入中";
    listEl.appendChild(el);
  }
  function hideLoading() { var el = document.getElementById("cn-loading"); if (el) el.remove(); }
  function hideEmpty() { emptyEl.classList.add("hidden"); emptyEl.innerHTML = ""; }
  function showEmpty(filtered) {
    emptyEl.classList.remove("hidden");
    emptyEl.innerHTML = filtered
      ? "<b>没有符合条件的回放</b><p>换个筛选条件或搜索词试试。</p>"
      : "<b>还没有回放</b><p>登录后到终端「回放」页粘贴对局文本，发布第一条回放。</p>" +
        '<p><a href="index.html">前往登录 →</a></p>';
  }
  function showError(msg) {
    errEl.classList.remove("hidden");
    errEl.innerHTML = '<p>加载失败：' + P.esc(msg) + '</p><button type="button" id="cn-retry">重 试</button>';
    document.getElementById("cn-retry").onclick = resetAndLoad;
  }
  function hideError() { errEl.classList.add("hidden"); errEl.innerHTML = ""; }

  function updateCount() {
    if (countEl) countEl.textContent = state.total ? "已载入 " + state.total + " 条" : "";
  }

  function card(r) {
    return '<div class="cn-card">' +
      '<div class="cn-card-head">' +
        '<a class="cn-card-name" href="' + P.esc(P.linkTo(r.id)) + '">' + P.esc(r.name || "未命名回放") + '</a>' +
        '<button type="button" class="cn-btn-copy" data-copy="' + P.esc(r.id) + '">复制回放</button>' +
      '</div>' +
      '<div class="cn-card-meta">' +
        '<span class="cn-badge cn-badge-mode">' + P.esc(P.modeLabel(r.mode)) + '</span>' +
        '<span class="cn-badge cn-badge-map">' + P.esc(P.mapLabel(r.map)) + '</span>' +
        '<span class="cn-card-sub">作者 ' + P.esc(r.username || "-") + '</span>' +
        '<span class="cn-card-sub">' + P.esc(P.fmtSize(r.size)) + '</span>' +
        '<span class="cn-card-sub">' + P.esc(P.fmtTime(r.createdAt)) + '</span>' +
        '<span class="cn-card-sub">' + P.esc(P.fmtViews(r.views)) + ' 次观看</span>' +
      '</div>' +
    '</div>';
  }

  function renderItems(items) {
    var frag = document.createDocumentFragment();
    items.forEach(function (r) {
      var div = document.createElement("div");
      div.innerHTML = card(r);
      frag.appendChild(div.firstChild);
    });
    listEl.appendChild(frag);
  }

  async function load() {
    if (state.loading || state.done) return;
    state.loading = true;
    showLoading();
    try {
      var data = await P.apiGet("/replays", {
        mode: state.mode,
        map: state.map,
        q: state.q,
        sort: state.sort,
        before: state.next,
        limit: LIMIT
      });
      var items = (data && data.items) || [];
      state.next = data.next || null;
      state.total += items.length;
      if (!items.length) state.done = true;
      renderItems(items);
      if (state.done && !listEl.children.length) showEmpty(!!(state.q || state.mode || state.map));
      updateCount();
    } catch (e) {
      showError(e.message || String(e));
    } finally {
      state.loading = false;
      hideLoading();
      if (state.done && listEl.children.length) {
        var end = document.createElement("div");
        end.className = "cn-end";
        end.textContent = "— 到底了 —";
        listEl.appendChild(end);
      }
    }
  }

  // 滚动分页：IntersectionObserver 哨兵；老浏览器退回滚动监听。
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) load();
    }, { rootMargin: "300px" }).observe(sentinel);
  } else {
    window.addEventListener("scroll", function () {
      var r = sentinel.getBoundingClientRect();
      if (r.top < window.innerHeight + 300) load();
    });
  }

  document.getElementById("cn-search-form").onsubmit = function (e) {
    e.preventDefault();
    state.q = searchEl.value.trim();
    resetAndLoad();
  };

  listEl.addEventListener("click", async function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("[data-copy]") : null;
    if (!btn) return;
    var id = btn.getAttribute("data-copy");
    var old = btn.textContent;
    btn.disabled = true;
    btn.textContent = "解压中…";
    try {
      var d = await P.apiGet("/replays/" + id);
      var item = d && d.item;
      if (!item || !item.data) throw new Error("回放数据为空");
      var text = await P.gunzipText(item.data);
      // 上传侧存的是去掉 "=" 前缀后的正文；游戏粘贴时会再 stripPrefix，
      // 补回 "=" 保证「粘贴 → 启动」直接可用。
      await P.copyText("=" + text);
      P.toast("已复制，去游戏：菜单→重播→粘贴→启动");
    } catch (err) {
      P.toast(err.message || String(err), true);
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  });

  renderChips();
  load();
})();