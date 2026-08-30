/* 回放详情（公开，无登录）：?id=<6位短码> → 详情元数据 + 一键复制回放文本。 */
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
    box.innerHTML =
      '<div class="cn-detail">' +
        '<h2 class="cn-detail-name">' + P.esc(item.name || "未命名回放") + '</h2>' +
        '<div class="cn-detail-meta">' +
          '<span class="cn-badge cn-badge-mode">' + P.esc(P.modeLabel(item.mode)) + '</span>' +
          '<span class="cn-badge cn-badge-map">' + P.esc(P.mapLabel(item.map)) + '</span>' +
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
      '</div>';
    document.getElementById("cn-copy").onclick = doCopy;
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