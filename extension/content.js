(function () {
  var HOST = 'liveai-email.onrender.com';
  var W = 236;
  var H = 236;
  var NAME = 'axon_plate';

  function popupFeatures() {
    var l = Math.round((screen.width - W) / 2);
    var t = Math.round((screen.height - H) / 2);
    return 'popup=yes,width=' + W + ',height=' + H + ',left=' + l + ',top=' + t +
      ',toolbar=no,menubar=no,location=no,status=no,resizable=no,scrollbars=no';
  }

  function plateUrl() {
    return 'https://' + HOST + '/email-plate.html?src=email&popup=1';
  }

  function openOrbPopup(url) {
    var target = url || plateUrl();
    var win = window.open(target, NAME, popupFeatures());
    if (!win) {
      window.open(target, '_blank');
    }
    return win;
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href*="' + HOST + '"]') : null;
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    openOrbPopup(a.href);
  }, true);

  if (!document.getElementById('a1-orb-float')) {
    var orb = document.createElement('div');
    orb.id = 'a1-orb-float';
    orb.title = 'Talk with A1 AI';
    orb.style.cssText =
      'position:fixed;bottom:24px;right:24px;width:72px;height:72px;border-radius:50%;' +
      'background:#F5C518 url(https://' + HOST + '/email/a1-logo.jpg) center/68% no-repeat;' +
      'box-shadow:0 0 30px rgba(245,197,24,0.6);cursor:pointer;z-index:2147483646;' +
      'border:2px solid #F5C518;animation:a1pulse 2s ease-in-out infinite;';
    var style = document.createElement('style');
    style.textContent =
      '@keyframes a1pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}';
    document.head.appendChild(style);
    orb.addEventListener('click', function () { openOrbPopup(); });
    document.body.appendChild(orb);
  }
})();
