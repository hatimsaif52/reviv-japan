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

    /* ---------- add-on packages (mirrors the original Reviv add-on logic) ---------- */
    var addonBox = root.querySelector('[data-rv-addons]');
    var linked = root.querySelector('[data-rv-linked]');
    var countFs = root.querySelector('[data-rv-count]');
    var currency = root.getAttribute('data-currency') || 'JPY';
    var locale = root.getAttribute('data-locale') || 'ja-JP';

    // Same conversion + rounding rules as the original theme's Shopify.formatMoney
    function addonMoney(cents) {
      var rate = Number((window.Shopify && Shopify.currency && Shopify.currency.rate) || 1.0);
      var amount = (Number(cents) / 100) * rate;
      if (currency === 'JPY') amount = Math.ceil(amount / 100) * 100;
      else if (currency === 'EUR') amount = Math.floor(amount) + 0.95;
      else if (['CAD', 'AUD', 'GBP'].indexOf(currency) > -1 || rate != 1) amount = Math.floor(amount) + 1;
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(Number(amount.toFixed(2)));
      } catch (e) {
        return formatMoney(Math.round(amount * 100), moneyFormat);
      }
    }
    function purchaseCount() {
      if (!countFs) return '0';
      var c = countFs.querySelector('input:checked');
      return c ? c.value.trim() : '0';
    }
    function updateAddonPrices() {
      if (!addonBox) return;
      var n = purchaseCount();
      addonBox.querySelectorAll('[data-rv-addon]').forEach(function (a) {
        var price = a.getAttribute('data-price-' + n);
        var el = a.closest('.rv-opt__value').querySelector('[data-rv-addon-price]');
        if (!el) return;
        el.textContent = price ? addonMoney(price) : '';
      });
    }
    function addonTitle(v) { return v.replace(/\(\+.*\)/, '').trim(); }
    function syncVariantToAddon() {
      if (!addonBox || !linked) return;
      var a = addonBox.querySelector('[data-rv-addon]:checked');
      if (!a) return;
      var title = addonTitle(a.value), hit = false;
      linked.querySelectorAll('[data-rv-option-input]').forEach(function (input) {
        if (input.value.trim() === title) { input.checked = true; hit = true; }
      });
      if (!hit && window.console) console.warn('Reviv: no variant option value matches add-on "' + title + '"');
      onChange();
    }
    function syncAddonToVariant() {
      if (!addonBox || !linked) return;
      var v = linked.querySelector('[data-rv-option-input]:checked');
      if (!v) return;
      addonBox.querySelectorAll('[data-rv-addon]').forEach(function (a) {
        if (addonTitle(a.value) === v.value.trim()) a.checked = true;
      });
    }
    root.addEventListener('change', function (e) {
      if (e.target.matches('[data-rv-addon]')) { syncVariantToAddon(); updateAddonPrices(); }
      else if (e.target.matches('[data-rv-option-input]')) {
        if (linked && linked.contains(e.target)) syncAddonToVariant();
        if (countFs && countFs.contains(e.target)) updateAddonPrices();
      }
    });

    /* ---------- popup opened from an option label ---------- */
    root.addEventListener('click', function (e) {
      var open = e.target.closest('[data-rv-dialog-open]');
      if (open) {
        e.preventDefault();
        var d = document.getElementById(open.getAttribute('data-rv-dialog-open'));
        if (d && d.showModal) d.showModal(); else if (d) d.setAttribute('open', '');
      }
    });
    root.querySelectorAll('dialog.rv-dialog').forEach(function (d) {
      d.addEventListener('click', function (e) {
        if (e.target === d || e.target.closest('[data-rv-dialog-close]')) d.close ? d.close() : d.removeAttribute('open');
      });
    });

    /* ---------- quantity ---------- */
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rv-qty]');
      if (!b) return;
      var input = b.parentElement.querySelector('input');
      var n = Math.max(1, (parseInt(input.value, 10) || 1) + parseInt(b.getAttribute('data-rv-qty'), 10));
      input.value = n;
    });

    if (addonBox && linked) {
      var pre = addonBox.querySelector('[data-rv-addon]:checked');
      if (pre) {
        var tt = addonTitle(pre.value);
        linked.querySelectorAll('[data-rv-option-input]').forEach(function (input) {
          if (input.value.trim() === tt) input.checked = true;
        });
      }
    }
    updateAddonPrices();
    if (fieldsets.length) {
      var opts = selected();
      current = findVariant(opts);
      markAvailability(opts);
      if (current && String(current.id) !== idInput.value) onChange();
    } else {
      current = variants[0] || null;
    }
    updateButton();
  }

  function boot() { document.querySelectorAll('[data-rv-product]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('shopify:section:load', boot);
})();
