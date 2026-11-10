/* 回放详情（公开，无登录）：?id=<6位短码> → 详情元数据 + 自动标签 + 一键复制回放文本 + 解析对局。
 * 解析由服务器完成（/replays/:id/json），本页只显示；已登录管理员可删除任何回放。 */
(function () {
  "use strict";
  var P = window.CNPages;
  var box = document.getElementById("cn-detail");
  var id = new URLSearchParams(location.search).get("id") || "";
  var item = null;

  function loading() {
    box.innerHTML = '<div class="cn-loading">载入中</div>';
  }

  function missing(title) {
    box.innerHTML =
      '<div class="cn-empty"><b>' + P.esc(title || "回放不存在") + '</b>' +
      '<p>从分享链接进入详情页（形如 r.html?id=XXXXXX），或到大厅挑选。</p>' +
      '<p><a href="replays.html">← 回放大厅</a></p></div>';
  }

  function error(msg) {
    box.innerHTML =
      '<div class="cn-error"><p>加载失败：' + P.esc(msg) + '</p>' +
      '<button type="button" id="cn-reload">重 试</button></div>';
    document.getElementById("cn-reload").onclick = function () { location.reload(); };
  }

  function render() {
    var tags = item.tags;
    var parseable = !tags || (tags.status !== "invalid" && tags.status !== "custom-map");
    box.innerHTML =
      '<div class="cn-detail">' +
        '<h2 class="cn-detail-name">' + P.esc(item.name || "未命名回放") + '</h2>' +
        '<div class="cn-detail-meta">' +
          '<span class="cn-badge cn-badge-mode">' + P.esc(P.modeLabel(item.mode)) + '</span>' +
          '<span class="cn-badge cn-badge-map">' + P.esc(P.mapLabel(item.map)) + '</span>' +
          P.tagFacts(tags).map(function (f) { return '<span class="cn-badge ' + (f === "回放不完整" || f === "无法解析" ? "cn-badge-warn" : "cn-badge-map") + '">' + P.esc(f) + '</span>'; }).join("") +
        '</div>' +
        '<table class="cn-detail-table">' +
          '<tr><td>作者</td><td>' + P.esc(item.username || "-") + '</td></tr>' +
          '<tr><td>大小</td><td>' + P.esc(P.fmtSize(item.size)) + '</td></tr>' +
          '<tr><td>上传时间</td><td>' + P.esc(P.fmtTime(item.createdAt)) + '</td></tr>' +
          '<tr><td>观看次数</td><td>' + P.esc(P.fmtViews(item.views)) + '</td></tr>' +
          '<tr><td>分享链接</td><td class="mono">r.html?id=' + P.esc(item.id) + '</td></tr>' +
        '</table>' +
        '<button type="button" class="cn-btn-main" id="cn-copy">复制回放文本</button>' +
        '<div class="cn-tip">复制后打开游戏：菜单 → 重播 → 粘贴 → 启动</div>' +
        '<div class="cn-btn-row">' +
          (parseable ? '<button type="button" class="chip" id="cn-parse-btn">解析对局</button>' : '<span class="cn-card-sub">' + (tags && tags.status === "custom-map" ? "自定义地图回放暂不支持解析" : "这条回放无法解析") + '</span>') +
          '<button type="button" class="chip" id="cn-like-btn">♡ <span id="cn-like-n">' + (item.likes | 0) + '</span></button>' +
          '<button type="button" class="chip hidden" id="cn-admin-feat"></button>' +
          '<button type="button" class="cn-btn-danger hidden" id="cn-admin-del">删除（管理员）</button>' +
        '</div>' +
        '<div class="cn-parse hidden" id="cn-parse"></div>' +
      '</div>';
    document.getElementById("cn-copy").onclick = doCopy;
    var parseBtn = document.getElementById("cn-parse-btn");
    if (parseBtn) parseBtn.onclick = doParse;
    showAdminDelete();
    setupLike();
  }

  // Like: one per account (login required). The page opens with the heart already filled if this account liked it.
  async function setupLike() {
    var btn = document.getElementById("cn-like-btn"), n = document.getElementById("cn-like-n");
    if (!btn) return;
    var on = false;
    var paint = function () { btn.classList.toggle("on", on); btn.firstChild.nodeValue = on ? "♥ " : "♡ "; btn.setAttribute("aria-pressed", String(on)); };
    if (P.savedToken()) { try { var d = await P.apiSend("GET", "/replays/liked"); on = (d.ids || []).indexOf(id) >= 0; paint(); } catch (_) {} }
    btn.onclick = async function () {
      if (!P.savedToken()) { P.toast("登录后才能点赞：先在登录页登录，再回到这里", true); return; }
      btn.disabled = true;
      try { var r = await P.apiSend("POST", "/replays/" + id + "/like", { liked: !on }); on = !!r.liked; n.textContent = String(r.likes | 0); paint(); }
      catch (e) { P.toast(e.status === 401 ? "登录已失效，请重新登录后再点赞" : (e.message || String(e)), true); }
      finally { btn.disabled = false; }
    };
  }

  async function doCopy() {
    var btn = document.getElementById("cn-copy");
    if (!item) return;
    btn.disabled = true;
    btn.textContent = "解压中…";
    try {
      var text = await P.gunzipText(item.data);
      await P.copyText("=" + text);
      P.toast("已复制，去游戏：菜单→重播→粘贴→启动");
    } catch (e) {
      P.toast(e.message || String(e), true);
    } finally {
      btn.disabled = false;
      btn.textContent = "复制回放文本";
    }
  }

  async function doParse() {
    var btn = document.getElementById("cn-parse-btn");
    var panel = document.getElementById("cn-parse");
    btn.disabled = true;
    btn.textContent = "解析中…";
    panel.classList.remove("hidden");
    panel.innerHTML = '<div class="cn-loading">服务器解析中</div>';
    try {
      var d = await P.apiGet("/replays/" + id + "/json");
      var json = JSON.parse(await P.gunzipText(d.data));
      var code = await P.gunzipText(item.data);
      window.CNReplayView.render(panel, json, { tags: d.tags, code: code, fileName: "replay_" + id + ".json" });
      btn.classList.add("hidden");
    } catch (e) {
      panel.innerHTML = '<div class="cn-error"><p>解析失败：' + P.esc(e.message || String(e)) + '</p></div>';
      btn.disabled = false;
      btn.textContent = "重新解析";
    }
  }

  // Only a session the server confirms as admin sees the button; the DELETE route
  // re-checks the role itself (the button is convenience, not the permission).
  async function showAdminDelete() {
    if (!P.savedToken()) return;
    try {
      var me = await P.apiSend("GET", "/auth/me");
      if (!me || !me.user || me.user.role !== "admin") return;
    } catch (_) { return; }
    var feat = document.getElementById("cn-admin-feat");
    if (feat) {
      var paintFeat = function () { feat.textContent = item.featured ? "取消精华（管理员）" : "设为精华（管理员）"; };
      paintFeat();feat.classList.remove("hidden");
      feat.onclick = async function () {
        feat.disabled = true;
        try { var r = await P.apiSend("POST", "/replays/" + id + "/feature", { featured: !item.featured }); item.featured = !!r.featured; paintFeat(); P.toast(item.featured ? "已设为精华" : "已取消精华"); }
        catch (e) { P.toast(e.message || String(e), true); }
        finally { feat.disabled = false; }
      };
    }
    var btn = document.getElementById("cn-admin-del");
    if (!btn) return;
    btn.classList.remove("hidden");
    btn.onclick = async function () {
      if (!confirm("以管理员身份永久删除这条回放？分享链接将立即失效，无法恢复。")) return;
      btn.disabled = true;
      try {
        await P.apiSend("DELETE", "/replays/" + id);
        P.toast("已删除");
        missing("回放已删除");
      } catch (e) {
        btn.disabled = false;
        P.toast(e.message || String(e), true);
      }
    };
  }

  if (!/^[A-Za-z0-9]{6}$/.test(id)) {
    missing("缺少有效的回放 ID");
    return;
  }
  loading();
  P.apiGet("/replays/" + id)
    .then(function (d) {
      item = d && d.item;
      if (!item) throw new Error("回放不存在或已被删除");
      render();
    })
    .catch(function (e) {
      if (e && e.status === 404) missing("回放不存在或已被删除");
      else error(e.message || String(e));
    });
})();
