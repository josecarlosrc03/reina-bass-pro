/* REINA BASS PRO — comportamiento común (carrito, filtros, pestañas, formulario) */
(function () {
  "use strict";

  /* ---------- Utilidades ---------- */
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Año del pie ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Aviso (toast) ---------- */
  var toast = $("[data-toast]");
  var toastTimer;
  function showToast(msg) {
    if (!toast) return;
    $("span", toast).textContent = msg;
    toast.classList.add("toast--on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("toast--on"); }, 2400);
  }

  /* ---------- Carrito (contador simple) ---------- */
  var cartCount = Math.max(0, parseInt(store.get("rbp-cart"), 10) || 0);
  function renderCart() {
    $$("[data-cart-count]").forEach(function (el) {
      el.textContent = cartCount;
      el.hidden = cartCount === 0;
    });
  }
  renderCart();

  $$("[data-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var qty = 1;
      var src = btn.getAttribute("data-qty-source");
      if (src) { qty = parseInt(($(src) || {}).textContent, 10) || 1; }
      cartCount += qty;
      store.set("rbp-cart", String(cartCount));
      renderCart();
      showToast(qty + " × " + btn.getAttribute("data-name") + " añadido al carrito");
    });
  });

  /* ---------- Selector de cantidad (ficha de producto) ---------- */
  var qtyOut = $("#qty");
  if (qtyOut) {
    $$("[data-qty]").forEach(function (b) {
      b.addEventListener("click", function () {
        var n = (parseInt(qtyOut.textContent, 10) || 1) + parseInt(b.getAttribute("data-qty"), 10);
        qtyOut.textContent = Math.min(20, Math.max(1, n));
      });
    });
  }

  /* ---------- Pestañas (ficha de producto) ---------- */
  var tabs = $$('[role="tab"]');
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        $("#" + t.getAttribute("aria-controls")).hidden = !on;
      });
    });
  });

  /* ---------- Listado: filtros, orden y búsqueda ---------- */
  var list = $("#products");
  if (list) {
    var cards = $$(".card", list);
    var priceMax = $("#price-max");
    var priceOut = $("#price-out");
    var onlyOffers = $("#only-offers");
    var sort = $("#sort");
    var count = $("#count");
    var empty = $("#empty");
    var params = new URLSearchParams(window.location.search);
    var query = (params.get("q") || "").trim().toLowerCase();
    if (params.get("oferta") === "1" && onlyOffers) onlyOffers.checked = true;

    var norm = function (s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
    var checked = function (name) { return $$('input[name="' + name + '"]:checked').map(function (i) { return i.value; }); };

    function apply() {
      var types = checked("type");
      var brands = checked("brand");
      var max = parseFloat(priceMax.value);
      var shown = 0;
      priceOut.textContent = max + " €";

      cards.forEach(function (c) {
        var ok =
          (!types.length || types.indexOf(c.dataset.type) > -1) &&
          (!brands.length || brands.indexOf(c.dataset.brand) > -1) &&
          parseFloat(c.dataset.price) <= max &&
          (!onlyOffers.checked || c.dataset.offer === "1") &&
          (!query || norm(c.dataset.name + " " + c.dataset.brand).indexOf(norm(query)) > -1);
        c.hidden = !ok;
        if (ok) shown++;
      });

      var by = sort.value;
      var sorted = cards.slice().sort(function (a, b) {
        if (by === "price-asc") return a.dataset.price - b.dataset.price;
        if (by === "price-desc") return b.dataset.price - a.dataset.price;
        if (by === "name") return a.dataset.name.localeCompare(b.dataset.name, "es");
        return a.dataset.order - b.dataset.order;
      });
      sorted.forEach(function (c) { list.appendChild(c); });

      count.textContent = shown;
      empty.classList.toggle("empty--visible", shown === 0);
    }

    $$(".filters input, #sort").forEach(function (el) { el.addEventListener("input", apply); });
    var reset = $("[data-reset]");
    if (reset) {
      reset.addEventListener("click", function () {
        $$(".filters input[type=checkbox]").forEach(function (i) { i.checked = false; });
        priceMax.value = priceMax.max;
        sort.value = "default";
        query = "";
        apply();
      });
    }
    apply();
  }

  /* ---------- Formularios (Netlify Forms) ---------- */
  // Envía cualquier <form data-netlify-form> sin recargar la página y muestra el resultado
  $$("[data-netlify-form]").forEach(function (form) {
    var status = $('[data-status-for="' + form.name + '"]');
    function say(text, ok) {
      if (!status) return;
      status.textContent = text;
      status.classList.toggle("form__status--ok", ok);
      status.classList.toggle("form__status--error", !ok);
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var body = new URLSearchParams(new FormData(form)).toString();
      fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body })
        .then(function (r) {
          if (!r.ok) throw new Error("fallo");
          form.reset();
          updateCounters();
          say(form.name === "contacto"
            ? "¡Mensaje enviado! Te responderemos lo antes posible."
            : "¡Gracias! Te has suscrito correctamente.", true);
        })
        .catch(function () {
          say("No se pudo enviar ahora mismo. Inténtalo de nuevo más tarde.", false);
        });
    });
    form.addEventListener("reset", function () {
      if (status) status.textContent = "";
      setTimeout(updateCounters, 0);
    });
  });

  /* ---------- Contador de caracteres del textarea ---------- */
  function updateCounters() {
    $$("[data-count-target]").forEach(function (area) {
      var out = document.getElementById(area.getAttribute("data-count-target"));
      if (out) out.textContent = area.value.length + " / " + area.maxLength;
    });
  }
  $$("[data-count-target]").forEach(function (area) { area.addEventListener("input", updateCounters); });
  updateCounters();
})();
