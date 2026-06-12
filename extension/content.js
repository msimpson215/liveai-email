/**
 * A1 Email Orb — Gmail overlay.
 *
 * Email HTML cannot draw over Gmail (Gmail strips JS/overlays/positioning).
 * This extension runs INSIDE the Gmail tab, so it can do the real illusion:
 * dim Gmail, float the orb in the dead center, click-outside to dismiss.
 */
(function () {
  var HOST = 'liveai-email.onrender.com';
  var PLATE_URL = 'https://' + HOST + '/email-plate.html?src=email&overlay=1';
  var OVERLAY_ID = 'a1-orb-overlay';
  var FLOAT_ID = 'a1-orb-float';

  function injectStyles() {
    if (document.getElementById('a1-orb-style')) return;
    var style = document.createElement('style');
    style.id = 'a1-orb-style';
    style.textContent =
      '#' + OVERLAY_ID + '{position:fixed;inset:0;z-index:2147483647;display:flex;' +
      'align-items:center;justify-content:center;' +
      'background:rgba(15,15,15,0.55);backdrop-filter:blur(2px);' +
      '-webkit-backdrop-filter:blur(2px);opacity:0;transition:opacity .18s ease;}' +
      '#' + OVERLAY_ID + '.show{opacity:1;}' +
      '#' + OVERLAY_ID + ' .a1-orb-frame{width:300px;height:300px;border:0;' +
      'background:transparent;border-radius:50%;transform:scale(.92);' +
      'transition:transform .18s ease;}' +
      '#' + OVERLAY_ID + '.show .a1-orb-frame{transform:scale(1);}' +
      '#' + OVERLAY_ID + ' .a1-orb-hint{position:fixed;bottom:32px;left:0;right:0;' +
      'text-align:center;color:#fff;font-family:Arial,sans-serif;font-size:13px;' +
      'letter-spacing:.5px;opacity:.85;pointer-events:none;}' +
      '#' + FLOAT_ID + '{position:fixed;bottom:24px;right:24px;width:64px;height:64px;' +
      'border-radius:50%;background:#F5C518 url(https://' + HOST + '/email/a1-logo.jpg) center/68% no-repeat;' +
      'box-shadow:0 0 26px rgba(245,197,24,0.6);cursor:pointer;z-index:2147483646;' +
      'border:2px solid #F5C518;animation:a1pulse 2.4s ease-in-out infinite;}' +
      '@keyframes a1pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}' +
      '@media (max-width:480px){#' + OVERLAY_ID + ' .a1-orb-frame{width:240px;height:240px;}}';
    document.head.appendChild(style);
  }

  function closeOverlay() {
    var ov = document.getElementById(OVERLAY_ID);
    if (!ov) return;
    ov.classList.remove('show');
    setTimeout(function () {
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    }, 200);
    document.removeEventListener('keydown', onKey, true);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeOverlay();
    }
  }

  function openOverlay() {
    injectStyles();
    if (document.getElementById(OVERLAY_ID)) return;

    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

    var frame = document.createElement('iframe');
    frame.className = 'a1-orb-frame';
    frame.setAttribute('allow', 'microphone; autoplay');
    frame.setAttribute('allowtransparency', 'true');
    frame.src = PLATE_URL;

    var hint = document.createElement('div');
    hint.className = 'a1-orb-hint';
    hint.textContent = 'Click the orb to talk \u00b7 click outside to return to Gmail';

    overlay.appendChild(frame);
    overlay.appendChild(hint);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay();
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('show'); });
    document.addEventListener('keydown', onKey, true);
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href*="' + HOST + '"]') : null;
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    openOverlay();
  }, true);

  function addFloatingOrb() {
    if (document.getElementById(FLOAT_ID)) return;
    injectStyles();
    var orb = document.createElement('div');
    orb.id = FLOAT_ID;
    orb.title = 'Talk with A1 AI';
    orb.addEventListener('click', openOverlay);
    document.body.appendChild(orb);
  }

  if (document.body) addFloatingOrb();
  else window.addEventListener('DOMContentLoaded', addFloatingOrb);
})();
