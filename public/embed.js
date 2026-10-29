/*
 * Junbi timetable for a club's own website.
 * Paste this where the timetable should go (Junbi gives you the exact code under Classes):
 *   <div class="junbi-timetable" data-token="..."></div>
 *   <script src="https://junbi.co.uk/embed.js" async></script>
 * Optional: data-theme="dark", data-accent="c8102e" (your colour, no #), data-signup="1" (adds a Sign up button).
 */
(function () {
  var scripts = document.getElementsByTagName("script");
  var origin = "https://junbi.co.uk";
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].getAttribute("src") || "";
    if (/\/embed\.js(\?|$)/.test(src)) {
      try { origin = new URL(src, location.href).origin; } catch (e) {}
      break;
    }
  }
  var frames = {};

  function mount(el) {
    if (el.getAttribute("data-junbi-ready")) return;
    var token = el.getAttribute("data-token") || "";
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return;
    el.setAttribute("data-junbi-ready", "1");
    var id = "jt" + Math.random().toString(36).slice(2, 10);
    var q = "frame=" + id;
    var theme = el.getAttribute("data-theme");
    var accent = (el.getAttribute("data-accent") || "").replace("#", "");
    if (theme === "dark") q += "&theme=dark";
    if (/^[0-9a-fA-F]{6}$/.test(accent)) q += "&accent=" + accent;
    if (el.getAttribute("data-signup") === "1") q += "&signup=1";
    var f = document.createElement("iframe");
    f.src = origin + "/embed/timetable/" + token + "?" + q;
    f.title = "Class timetable";
    f.loading = "lazy";
    f.style.cssText = "width:100%;border:0;display:block;height:420px;background:transparent";
    f.setAttribute("allowtransparency", "true");
    frames[id] = f;
    el.appendChild(f);
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data || typeof e.data.junbiTimetable !== "string") return;
    var f = frames[e.data.junbiTimetable];
    var h = Number(e.data.height);
    if (f && h > 0 && h < 20000) f.style.height = Math.ceil(h) + "px";
  });

  function run() {
    var els = document.querySelectorAll(".junbi-timetable");
    for (var j = 0; j < els.length; j++) mount(els[j]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
