/* 公开页共享运行时（回放大厅 replays.html / 回放详情 r.html，S8）。
 * API 隧道机制与登录壳一致：gateway.js 提供受限格式的后端地址；
 * 网络失败时安全解析 gateway.js 并自愈重试一次。 */
(function () {
  "use strict";
  function apiOrigin(value) {
    var text = String(value || "").trim().replace(/\/+$/, "").replace(/(?:\/api)+$/, "");
    try {
      var u = new URL(text);
      if (u.protocol !== "https:" || u.username || u.password || u.port || u.pathname !== "/" || u.search || u.hash || !/^(?:[a-z0-9-]+\.)+trycloudflare\.com$/i.test(u.hostname)) return "";
      return u.origin;
    } catch (_) { return ""; }
  }
  function gatewayOrigin(text) {
    var match = /^\s*window\.__CN_API_BASE\s*=\s*("(?:\\.|[^"\\])*")\s*;?\s*$/.exec(String(text || ""));
    if (!match) return "";
    try { return apiOrigin(JSON.parse(match[1])); } catch (_) { return ""; }
  }
  var API = apiOrigin(window.__CN_API_BASE);

  var retried = false;
  function gatewayWarn(reason) {
    console.warn("[CN gateway][WARN] " + reason + "；检查公开站 gateway.js 与隧道发布状态。");
  }
  function refreshGateway() {
    return fetch("gateway.js?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) { gatewayWarn("刷新地址失败 (HTTP " + r.status + ")"); return null; }
        return r.text();
      })
      .then(function (t) {
        if (t === null) return null;
        var fresh = gatewayOrigin(t);
        if (!fresh) { gatewayWarn("gateway.js 格式错误或地址不受信任"); return null; }
        window.__CN_API_BASE = fresh;
        if (fresh && fresh !== API) { API = fresh; return fresh; }
        return null;
      })
      .catch(function () { gatewayWarn("刷新地址时网络请求失败"); return null; });
  }

  async function apiGet(path, params) {
    if (!API) {
      if (!retried) {
        retried = true;
        var recovered = await refreshGateway();
        if (recovered) return apiGet(path, params);
      }
      throw new Error("连接地址不可用，请稍后重试。");
    }
    var url = API + "/api" + path;
    var sp = new URLSearchParams();
    for (var k in params || {}) {
      var v = params[k];
      if (v !== undefined && v !== null && v !== "") sp.set(k, v);
    }
    var qs = sp.toString();
    if (qs) url += "?" + qs;
    try {
      var r = await fetch(url, { cache: "no-store" });
      var body = await r.json().catch(function () { return null; });
      if (!r.ok) {
        var err = new Error((body && body.error) || "HTTP " + r.status);
        err.status = r.status;
        throw err;
      }
      return body;
    } catch (e) {
      if (e && e.status) throw e;
      if (retried) throw e;
      retried = true;
      var fresh = await refreshGateway();
      if (fresh) return apiGet(path, params);
      throw e;
    }
  }

  // 模式/地图枚举与后端 REPLAY_MODES / REPLAY_MAPS 同源（§5.6 顺序）
  var MODES = [
    { key: "team", label: "团队" },
    { key: "br", label: "大逃杀" },
    { key: "1v1", label: "1V1" },
    { key: "zombie", label: "僵尸" },
    { key: "other", label: "其他" }
  ];
  var MAPS = [
    { key: "Asia", label: "亚洲" },
    { key: "Europe", label: "欧洲" },
    { key: "World 1", label: "世界1" },
    { key: "British Isles", label: "不列颠群岛" },
    { key: "North America", label: "北美" },
    { key: "South America", label: "南美" },
    { key: "Africa", label: "非洲" },
    { key: "Caucasia", label: "高加索" },
    { key: "World 2", label: "世界2" },
    { key: "Middle East", label: "地中海沿岸" },
    { key: "other", label: "其他" }
  ];
  function modeLabel(key) { var m = MODES.find(function (x) { return x.key === key; }); return m ? m.label : key; }
  function mapLabel(key) { var m = MAPS.find(function (x) { return x.key === key; }); return m ? m.label : key; }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  }

  function fmtTime(ts) {
    var d = new Date(Number(ts) || 0);
    if (isNaN(d.getTime())) return "-";
    var p = function (x) { return String(x).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function fmtViews(n) { return String(Number(n) || 0); }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // 详情接口 data = gzip+base64。老浏览器无 DecompressionStream → 明确报错提示。
  async function gunzipText(b64) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("当前浏览器不支持 gzip 解压，请使用新版 Chrome / Edge / Firefox / Safari");
    }
    var bytes = base64ToBytes(b64);
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (!ok) return Promise.reject(new Error("复制失败，请手动选择复制"));
    return Promise.resolve();
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  function toast(msg, isErr) {
    var el = document.createElement("div");
    el.className = "cn-toast" + (isErr ? " cn-toast-err" : "");
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.remove(); }, 400);
    }, 3000);
  }

  function linkTo(id) { return "r.html?id=" + id; }

  window.CNPages = {
    apiGet: apiGet,
    esc: esc,
    fmtSize: fmtSize,
    fmtTime: fmtTime,
    fmtViews: fmtViews,
    modeLabel: modeLabel,
    mapLabel: mapLabel,
    MODES: MODES,
    MAPS: MAPS,
    gunzipText: gunzipText,
    copyText: copyText,
    toast: toast,
    linkTo: linkTo
  };
})();
