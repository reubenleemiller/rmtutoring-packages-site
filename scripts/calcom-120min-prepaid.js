  (function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if(typeof namespace === "string"){cal.ns[namespace] = cal.ns[namespace] || api;p(cal.ns[namespace], ar);p(cal, ["initNamespace", namespace]);} else p(cal, ar); return;} p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
Cal("init", "prepaid-120-min", {origin:"https://cal.com"});

  
  // Important: Please add the following attributes to the element that should trigger the calendar to open upon clicking.
  // `data-cal-link="rleemiller/prepaid-120-min"`
  // data-cal-namespace="prepaid-120-min"
  // `data-cal-config='{"layout":"month_view"}'`

  Cal.ns["prepaid-120-min"]("ui", {"cssVarsPerTheme":{"light":{"cal-brand":"#27163E"}},"hideEventTypeDetails":false,"layout":"month_view"});