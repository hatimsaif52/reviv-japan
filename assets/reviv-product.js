/* REVIV — product page (variant picker, gallery, terms, quantity). No dependencies. */
(function () {
  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    var fmt = format || '¥{{amount_no_decimals}}';
    function withDelims(n, precision, thousands, decimal) {
      thousands = thousands || ',';
      decimal = decimal || '.';
      if (isNaN(n) || n == null) return '0';
      n = (n / 100).toFixed(precision);
      var parts = n.split('.');
      var whole = parts[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' + thousands);
      return whole + (parts[1] ? decimal + parts[1] : '');
    }
    var match = fmt.match(/\{\{\s*(\w+)\s*\}\}/);
    var value = '';
    switch (match ? match[1] : 'amount') {
      case 'amount': value = withDelims(cents, 2); break;
      case 'amount_no_decimals': value = withDelims(cents, 0); break;
      case 'amount_with_comma_separator': value = withDelims(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator': value = withDelims(cents, 0, '.', ','); break;
      case 'amount_with_apostrophe_separator': value = withDelims(cents, 2, "'", '.'); break;
      case 'amount_no_decimals_with_space_separator': value = withDelims(cents, 0, ' ', ''); break;
      default: value = withDelims(cents, 2);
    }
    var out = fmt.replace(/\{\{\s*\w+\s*\}\}/, value);
    // mirror Liquid's money_without_trailing_zeros
    return out.replace(/[.,]00(?=\D*$)/, '');
  }

  function init(root) {
    if (root.__rvReady) return;
    root.__rvReady = true;

    var variants = [];
    try { variants = JSON.parse(root.querySelector('[data-rv-variants]').textContent); } catch (e) {}
    var moneyFormat = root.getAttribute('data-money-format');
    var form = root.querySelector('[data-rv-product-form]');
    var idInput = root.querySelector('[data-rv-variant-id]');
    var priceEl = root.querySelector('[data-rv-price]');
    var compareEl = root.querySelector('[data-rv-compare]');
    var atc = root.querySelector('[data-rv-atc]');
    var atcText = root.querySelector('[data-rv-atc-text]');
    var terms = root.querySelector('[data-rv-terms]');
    var actions = root.querySelector('[data-rv-actions]');
    var hint = root.querySelector('[data-rv-terms-hint]');
    var fieldsets = root.querySelectorAll('[data-rv-option]');
    var current = null;

    /* ---------- gallery ---------- */
    function showMedia(id) {
      if (!id) return;
      var slides = root.querySelectorAll('.rv-gallery__slide[data-media-id]');
      var found = false;
      slides.forEach(function (s) {
        var on = s.getAttribute('data-media-id') === String(id);
        if (on) found = true;
        s.hidden = !on;
        if (!on) {
          var v = s.querySelector('video'); if (v) v.pause();
        }
      });
      if (!found) return;
      root.querySelectorAll('[data-rv-thumb]').forEach(function (t) {
        var on = t.getAttribute('data-rv-thumb') === String(id);
        t.classList.toggle('is-active', on);
        if (on) { t.setAttribute('aria-current', 'true'); t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
        else t.removeAttribute('aria-current');
      });
    }
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-rv-thumb]');
      if (t) showMedia(t.getAttribute('data-rv-thumb'));
    });

    /* ---------- variants ---------- */
    function selected() {
      return Array.prototype.map.call(fieldsets, function (fs) {
        var c = fs.querySelector('input:checked');
        return c ? c.value : null;
      });
    }
    function findVariant(opts) {
      for (var i = 0; i < variants.length; i++) {
        var v = variants[i], ok = true;
        for (var j = 0; j < opts.length; j++) { if (v.options[j] !== opts[j]) { ok = false; break; } }
        if (ok) return v;
      }
      return null;
    }
    function markAvailability(opts) {
      fieldsets.forEach(function (fs, idx) {
        fs.querySelectorAll('input[data-rv-option-input]').forEach(function (input) {
          var test = opts.slice(); test[idx] = input.value;
          var v = findVariant(test);
          input.closest('.rv-opt__value').classList.toggle('is-unavailable', !v || !v.available);
        });
      });
    }
    function updateButton() {
      if (!atc) return;
      var locked = terms && !terms.checked;
      var text = atc.getAttribute('data-label-add');
      var disabled = false; // terms lock is handled by the click guard so we can show a hint
      if (!current) { text = atc.getAttribute('data-label-unavailable'); disabled = true; }
      else if (!current.available) { text = atc.getAttribute('data-label-soldout'); disabled = true; }
      atc.disabled = disabled;
      if (atcText) atcText.textContent = text;
      if (actions) actions.classList.toggle('is-locked', !!locked || !current || !current.available);
    }
    function onChange() {
      var opts = selected();
      current = findVariant(opts);
      markAvailability(opts);
      if (current) {
        idInput.value = current.id;
        if (priceEl) priceEl.textContent = formatMoney(current.price, moneyFormat);
        if (compareEl) {
          var show = current.compare_at_price > current.price;
          compareEl.hidden = !show;
          if (show) compareEl.textContent = formatMoney(current.compare_at_price, moneyFormat);
        }
        if (current.media) showMedia(current.media);
        try {
          var url = new URL(window.location.href);
          url.searchParams.set('variant', current.id);
          window.history.replaceState({}, '', url.toString());
        } catch (e) {}
        root.dispatchEvent(new CustomEvent('reviv:variant-change', { bubbles: true, detail: current }));
      }
      updateButton();
    }
    root.addEventListener('change', function (e) {
      if (e.target.matches('[data-rv-option-input]')) onChange();
      if (e.target.matches('[data-rv-terms]')) {
        updateButton();
        if (hint) hint.classList.toggle('is-visible', false);
      }
    });

    /* ---------- terms: explain why buttons are locked ---------- */
    if (actions) {
      actions.addEventListener('click', function (e) {
        if (!e.target.closest('.rv-buy__atc, .rv-buy__now')) return;
        if (terms && !terms.checked) {
          e.preventDefault(); e.stopPropagation();
          if (hint) hint.classList.add('is-visible');
          terms.closest('.rv-terms').classList.add('is-attention');
          setTimeout(function () { terms.closest('.rv-terms').classList.remove('is-attention'); }, 900);
          terms.focus();
        }
      }, true);
    }
    if (form) {
      form.addEventListener('submit', function (e) {
        if (terms && !terms.checked) { e.preventDefault(); e.stopImmediatePropagation(); }
      }, true);
    }

    /* ---------- quantity ---------- */
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rv-qty]');
      if (!b) return;
      var input = b.parentElement.querySelector('input');
      var n = Math.max(1, (parseInt(input.value, 10) || 1) + parseInt(b.getAttribute('data-rv-qty'), 10));
      input.value = n;
    });

    if (fieldsets.length) {
      var opts = selected();
      current = findVariant(opts);
      markAvailability(opts);
    } else {
      current = variants[0] || null;
    }
    updateButton();
  }

  function boot() { document.querySelectorAll('[data-rv-product]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('shopify:section:load', boot);
})();
