(function () {
  "use strict";

  var ACCENTS = { studio: "#0a7494", oss: "#6d4bf0", tools: "#087a43", content: "#96650a" };
  var DEFAULT_ACCENT = "#0a7494";
  var STATUS_LABEL = { live: "运行中", wip: "开发中", pause: "已暂停", archived: "已归档" };

  function el(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function highlight(text, query) {
    var safe = escapeHtml(text);
    if (!query) return safe;
    var q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return safe.replace(new RegExp("(" + q + ")", "gi"), "<mark>$1</mark>");
  }

  function hostOf(url) {
    try { return new URL(url).hostname; } catch (e) { return url; }
  }

  var state = { data: null, query: "", category: "all" };

  /* sites.json 优先；file:// 打开时回退到页面内嵌数据 */
  function loadData() {
    return fetch("./sites.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () {
        var node = el("sites-embed");
        if (node) return JSON.parse(node.textContent);
        throw new Error("缺少站点数据");
      });
  }

  function accentFor(site) { return ACCENTS[site.category] || DEFAULT_ACCENT; }

  function categoryName(id) {
    var cats = state.data.categories || [];
    for (var i = 0; i < cats.length; i++) if (cats[i].id === id) return cats[i].name;
    return "";
  }

  function matches(site, query) {
    if (!query) return true;
    var hay = [site.name, site.tagline, site.description, site.url, hostOf(site.url),
      categoryName(site.category), (site.features || []).join(" "), (site.pipeline || []).join(" ")].join(" ").toLowerCase();
    return hay.includes(query.toLowerCase());
  }

  function visibleSites() {
    return (state.data.sites || []).filter(function (s) {
      return (state.category === "all" || s.category === state.category) && matches(s, state.query);
    });
  }

  var GITHUB_ICON = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
    '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';

  function renderCard(site, index) {
    var query = state.query;
    var host = hostOf(site.url);
    var status = site.status || "live";
    var isHero = site.size === "hero" && !query;

    var card = document.createElement("a");
    card.className = "card" + (isHero ? " card--hero" : "");
    card.href = site.url;
    card.target = "_blank";
    card.rel = "noopener";
    card.style.setProperty("--accent", accentFor(site));
    card.style.animationDelay = Math.min(index, 8) * 50 + "ms";

    var features = (site.features || []).map(function (f) {
      return "<li>" + highlight(f, query) + "</li>";
    }).join("");

    var flow = (site.pipeline || []).map(function (step, i) {
      return (i ? '<span class="card__flow-sep" aria-hidden="true">→</span>' : "") +
        '<span class="card__flow-step">' + highlight(step, query) + "</span>";
    }).join("");
    var pipeline = flow ? '<div class="card__flow">' + flow + "</div>" : "";

    var repo = site.repo
      ? '<span class="card__repo">' + GITHUB_ICON + "源码仓库</span>"
      : "";

    card.innerHTML =
      '<div class="card__id">' +
        '<span class="card__icon" aria-hidden="true">' +
          escapeHtml((site.name || "?").trim().charAt(0).toUpperCase()) + "</span>" +
        '<span class="card__idtext">' +
          '<span class="card__titlerow">' +
            '<span class="card__name">' + highlight(site.name, query) + "</span>" +
            '<span class="dot dot--' + status + '" title="' + STATUS_LABEL[status] + '"></span>' +
          "</span>" +
          '<span class="card__domain">' + highlight(host, query) + "</span>" +
        "</span>" +
      "</div>" +
      '<div class="card__main">' +
        '<span class="card__tagline">' + highlight(site.tagline || "", query) + "</span>" +
        pipeline +
        '<p class="card__desc">' + highlight(site.description || "", query) + "</p>" +
        (features ? '<ul class="card__features">' + features + "</ul>" : "") +
        repo +
      "</div>" +
      '<span class="card__arrow" aria-hidden="true">&#8599;</span>';

    var repoNode = card.querySelector(".card__repo");
    if (repoNode) {
      repoNode.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        window.open(site.repo, "_blank", "noopener");
      });
    }
    return card;
  }

  function renderChips() {
    var chips = el("chips");
    chips.textContent = "";
    var sites = state.data.sites || [];
    var defs = [{ id: "all", name: "全部" }]
      .concat(state.data.categories || [])
      .filter(function (c) {
        return c.id === "all" || sites.some(function (s) { return s.category === c.id; });
      });

    defs.forEach(function (c) {
      var count = c.id === "all"
        ? sites.length
        : sites.filter(function (s) { return s.category === c.id; }).length;
      var btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(state.category === c.id));
      btn.innerHTML = escapeHtml(c.shortName || c.name) +
        '<span class="chip__count">' + count + "</span>";
      btn.addEventListener("click", function () {
        state.category = c.id;
        renderChips();
        renderGrid();
      });
      chips.appendChild(btn);
    });
  }

  function renderGrid() {
    var grid = el("grid");
    grid.textContent = "";
    var sites = visibleSites();
    sites.forEach(function (site, i) { grid.appendChild(renderCard(site, i)); });
    el("empty").hidden = sites.length > 0;
  }

  function bindSearch() {
    var input = el("search");
    input.addEventListener("input", function () {
      state.query = input.value.trim();
      renderGrid();
    });
    document.addEventListener("keydown", function (ev) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (ev.key === "Escape" && typing) {
        input.value = "";
        state.query = "";
        input.blur();
        renderGrid();
      } else if ((ev.key === "/" || (ev.key === "k" && (ev.ctrlKey || ev.metaKey))) && !typing) {
        ev.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  function bindHeader() {
    var brand = state.data.brand || {};
    var sites = state.data.sites || [];
    if (brand.tagline) el("hero-tagline").textContent = brand.tagline;
    if (brand.fullName) document.title = brand.fullName;
    el("year").textContent = new Date().getFullYear();

    var live = sites.filter(function (s) { return (s.status || "live") === "live"; }).length;
    el("header-stat").textContent = live + " / " + sites.length + " 服务在线";
  }

  loadData().then(function (data) {
    state.data = data;
    bindHeader();
    renderChips();
    renderGrid();
    bindSearch();
  });
})();
