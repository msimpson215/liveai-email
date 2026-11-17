(function () {
  var header = document.getElementById('tsHeader');
  function setSolid() {
    header.classList.toggle('ts-solid', header.dataset.solid === '1' || window.scrollY > 50);
  }
  window.addEventListener('scroll', setSolid, { passive: true });
  setSolid();

  var menuBtn = document.getElementById('tsMenuBtn');
  var menu = document.getElementById('tsMenu');
  function setMenu(open) {
    document.body.classList.toggle('ts-menu-open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  menuBtn.addEventListener('click', function () {
    setMenu(!document.body.classList.contains('ts-menu-open'));
  });
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="#"]');
    if (!a) return;
    var url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    var target = document.querySelector(url.hash);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(null, '', url.hash);
  });

  var items = Array.prototype.slice.call(document.querySelectorAll('[data-r]'));
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      var shown = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.style.transitionDelay = Math.min(shown, 6) * 90 + 'ms';
        entry.target.classList.add('in');
        io.unobserve(entry.target);
        shown++;
      });
    }, { rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  var form = document.getElementById('tsConsult');
  if (form) {
    var note = document.getElementById('tsConsultNote');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        var ok = el.checkValidity();
        el.classList.toggle('ts-invalid', !ok && el.type !== 'checkbox');
        if (!ok && !bad) bad = el;
      });
      if (bad) {
        note.textContent = bad.type === 'checkbox'
          ? 'Please agree to be contacted so we can reach you.'
          : 'Please fill in every field marked with *.';
        note.classList.add('is-error');
        bad.focus();
        return;
      }
      var f = form.elements;
      var lines = [
        'Full Name: ' + f.fullName.value,
        'Business Name: ' + f.businessName.value,
        'Email: ' + f.email.value,
        'Phone: ' + f.phone.value,
        'Industry: ' + f.industry.value,
        'Company Size: ' + f.companySize.value,
        'Primary Challenge: ' + f.challenge.options[f.challenge.selectedIndex].text,
        '',
        f.description.value
      ];
      note.classList.remove('is-error');
      note.textContent = 'Opening your email to send this to info@thinkshift-technologies.com…';
      location.href = 'mailto:info@thinkshift-technologies.com?subject=' +
        encodeURIComponent('Free Consultation Request — ' + f.businessName.value) +
        '&body=' + encodeURIComponent(lines.join('\n'));
    });
  }
})();
