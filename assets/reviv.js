/* REVIV — homepage section scripts (no dependencies) */
(function () {
  if (window.__revivInit) return;
  window.__revivInit = true;

  var root = window.Shopify && Shopify.routes ? Shopify.routes.root : '/';

  /* ---------- mobile drawer ---------- */
  document.addEventListener('click', function (e) {
    var openBtn = e.target.closest('[data-rv-drawer-open]');
    var closeBtn = e.target.closest('[data-rv-drawer-close]');
    var drawer = document.querySelector('[data-rv-drawer]');
    if (!drawer) return;
    if (openBtn) {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      var first = drawer.querySelector('button, a, input');
      if (first) first.focus();
    }
    if (closeBtn) closeDrawer(drawer);
  });
  function closeDrawer(drawer) {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    var btn = document.querySelector('[data-rv-drawer-open]');
    if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
  }

  /* ---------- desktop dropdown (click / keyboard support) ---------- */
  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('[data-rv-dropdown]');
    document.querySelectorAll('.rv-nav > li.is-open').forEach(function (li) {
      if (!toggle || li !== toggle.parentElement) {
        li.classList.remove('is-open');
        var b = li.querySelector('[data-rv-dropdown]');
        if (b) b.setAttribute('aria-expanded', 'false');
      }
    });
    if (toggle) {
      var li = toggle.parentElement;
      var open = li.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  });

  /* ---------- video modal ---------- */
  function embedUrl(url) {
    if (!url) return null;
    var yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    if (yt) return { src: 'https://www.youtube.com/embed/' + yt[1] + '?autoplay=1&rel=0', vertical: /shorts\//.test(url) };
    var vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return { src: 'https://player.vimeo.com/video/' + vm[1] + '?autoplay=1', vertical: false };
    return { src: url, vertical: false, file: true };
  }
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-rv-video]');
    if (!trigger) return;
    var modal = document.querySelector('[data-rv-modal]');
    var data = embedUrl(trigger.getAttribute('data-rv-video'));
    if (!modal || !data) return;
    e.preventDefault();
    var box = modal.querySelector('[data-rv-modal-box]');
    var slot = modal.querySelector('[data-rv-modal-slot]');
    var vertical = data.vertical || trigger.getAttribute('data-rv-vertical') === 'true';
    box.classList.toggle('is-vertical', vertical);
    slot.innerHTML = data.file
      ? '<video src="' + data.src + '" controls autoplay playsinline></video>'
      : '<iframe src="' + data.src + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="Video"></iframe>';
    modal.classList.add('is-open');
    modal.__trigger = trigger;
    modal.querySelector('[data-rv-modal-close]').focus();
  });
  function closeModal() {
    var modal = document.querySelector('[data-rv-modal].is-open');
    if (!modal) return;
    modal.querySelector('[data-rv-modal-slot]').innerHTML = '';
    modal.classList.remove('is-open');
    if (modal.__trigger) modal.__trigger.focus();
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-rv-modal-close]')) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeModal();
    var drawer = document.querySelector('[data-rv-drawer].is-open');
    if (drawer) closeDrawer(drawer);
  });

  /* ---------- cart helpers ---------- */
  function setCount(n) {
    document.querySelectorAll('[data-rv-cart-count]').forEach(function (el) {
      el.textContent = n;
      el.hidden = n === 0;
    });
  }
  // Horizon 4.x (and any theme using Shopify standard actions) exposes
  // Shopify.actions. Using it keeps the theme's cart drawer and cart bubble in sync.
  function actions() { return window.Shopify && window.Shopify.actions; }

  /* Cart icon in the Reviv header: open the theme's cart drawer if there is one */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-rv-open-cart]');
    if (!link || !actions() || !actions().openCart) return;
    if (!document.querySelector('theme-drawer#cart-drawer, cart-drawer, #cart-drawer')) return;
    e.preventDefault();
    actions().openCart();
  });

  /* Keep the Reviv cart count right when the theme itself changes the cart */
  document.addEventListener('shopify:cart:lines-update', function (e) {
    if (e.promise && e.promise.then) {
      e.promise.then(function (res) {
        var n = res && res.cart ? res.cart.totalQuantity : (res && res.detail ? res.detail.itemCount : null);
        if (typeof n === 'number') setCount(n);
      }).catch(function () {});
    }
  });

  /* ---------- add to cart ---------- */
  function addWithActions(form) {
    var fd = new FormData(form);
    return actions().updateCart(
      { lines: [{ merchandiseId: String(fd.get('id')), quantity: Number(fd.get('quantity') || 1) }] },
      { event: { context: 'product' } }
    ).then(function (res) {
      if (res && res.userErrors && res.userErrors.length) throw new Error(res.userErrors[0].message);
      if (res && res.cart) setCount(res.cart.totalQuantity);
      return res;
    });
  }

  function addWithAjax(form) {
    return fetch(root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(form)
    })
      .then(function (r) { if (!r.ok) throw r; return r.json(); })
      .then(function () { return fetch(root + 'cart.js').then(function (r) { return r.json(); }); })
      .then(function (cart) {
        setCount(cart.item_count);
        // Older Horizon versions (before standard actions) listen for 'cart:update'
        document.dispatchEvent(new CustomEvent('cart:update', {
          bubbles: true,
          detail: { resource: cart, sourceId: 'reviv', data: { source: 'reviv', itemCount: cart.item_count, action: 'add' } }
        }));
        document.dispatchEvent(new CustomEvent('reviv:cart-updated', { detail: cart }));
        return cart;
      });
  }

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-rv-add]');
    if (!form || !window.fetch) return;
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    var label = btn ? btn.innerHTML : '';
    if (btn) btn.classList.add('is-loading');

    var a = actions();
    var job = a && a.updateCart ? addWithActions(form) : addWithAjax(form);

    job
      .then(function () {
        if (btn) {
          btn.textContent = btn.getAttribute('data-added-label') || 'Added';
          setTimeout(function () { btn.innerHTML = label; }, 1800);
        }
        if (form.getAttribute('data-rv-add') === 'redirect') window.location.href = root + 'cart';
      })
      .catch(function () { form.submit(); })
      .finally(function () { if (btn) btn.classList.remove('is-loading'); });
  });
})();
