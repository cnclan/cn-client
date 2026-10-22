/* 回放解析器（tt 的 replay_viewer 并入回放大厅）：回放代码 → JSON（解析）、JSON → 回放代码（生成）。
 * 两个方向都由服务器转换（/replays/decode、/replays/encode，需登录）；本页只收发数据并显示。 */
(function () {
  "use strict";
  var P = window.CNPages;
  var $ = function (id) { return document.getElementById(id); };
  var codeEl = $("cn-tool-code"), jsonEl = $("cn-tool-json"), statusEl = $("cn-tool-status"), resultEl = $("cn-tool-result");

  function status(text, isErr) {
    statusEl.textContent = text;
    statusEl.style.color = isErr ? "#ff7d6b" : "";
  }

  function show(json, tags, code) {
    resultEl.classList.remove("hidden");
    window.CNReplayView.render(resultEl, json, { tags: tags, code: code, fileName: "replay_" + (tags && tags.map ? String(tags.map).replace(/\W+/g, "_") : "map") + "_v" + Number(json.TerritorialVersion) + ".json" });
  }

  async function busy(btn, label, work) {
    var old = btn.textContent;
    btn.disabled = true;
    btn.textContent = label;
    try { await work(); }
    catch (e) {
      if (e && e.status === 401) { status("登录已过期，请重新登录后再试", true); return; }
      status(e.message || String(e), true);
    }
    finally { btn.disabled = false; btn.textContent = old; }
  }

  $("cn-tool-parse").onclick = function () {
    var code = codeEl.value.replace(/\s+/g, "");
    if (!code) { status("请先粘贴回放代码", true); return; }
    busy(this, "解析中…", async function () {
      status("服务器解析中…");
      var d = await P.apiSend("POST", "/replays/decode", { data: await P.gzipBase64(code) });
      var json = JSON.parse(await P.gunzipText(d.data));
      show(json, d.tags, code.replace(/^=/, ""));
      status("已解析 · " + P.modeLabel(d.tags.mode) + " · " + P.mapLabel(d.tags.map) + " · " + P.tagFacts(d.tags).join(" · "));
    });
  };

  $("cn-tool-encode").onclick = function () {
    var text = jsonEl.value.trim();
    if (!text) { status("请先粘贴回放 JSON 或选择文件", true); return; }
    var parsed;
    try { parsed = JSON.parse(text); } catch (_) { status("不是有效的 JSON 文本", true); return; }
    busy(this, "生成中…", async function () {
      status("服务器生成中…");
      var d = await P.apiSend("POST", "/replays/encode", { data: await P.gzipBase64(text) });
      var code = await P.gunzipText(d.data);
      codeEl.value = code;
      show(parsed, d.tags, code);
      status("已生成回放代码（" + code.length + " 字符），已写回上方输入框");
    });
  };

  $("cn-tool-copy").onclick = function () {
    var code = codeEl.value.replace(/\s+/g, "");
    if (!code) { status("输入框里没有回放代码", true); return; }
    P.copyText("=" + code.replace(/^=/, "")).then(function () { P.toast("已复制，去游戏：菜单→重播→粘贴→启动"); }, function (e) { P.toast(e.message || String(e), true); });
  };
  $("cn-tool-clear").onclick = function () { codeEl.value = ""; jsonEl.value = ""; resultEl.innerHTML = ""; resultEl.classList.add("hidden"); status(""); };
  $("cn-tool-file").onclick = function () { $("cn-tool-file-input").click(); };
  $("cn-tool-file-input").onchange = function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { jsonEl.value = String(rd.result || ""); status("已读取 " + f.name + "，点「生成回放代码」"); };
    rd.onerror = function () { status("读取文件失败", true); };
    rd.readAsText(f);
    e.target.value = "";
  };

  if (P.savedToken()) $("cn-tool").classList.remove("hidden");
  else $("cn-tool-login").classList.remove("hidden");
})();
