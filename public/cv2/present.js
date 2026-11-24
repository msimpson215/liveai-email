(function () {
  var STORE = 'cvPresentation';
  var DATA_URL = '/cv2/presentations.json';
  var MAX_FEATURED = 4;
  var SLOT_LABELS = ['Project one', 'Project two', 'Project three', 'Project four'];

  function slug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  }

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function byId(projects) {
    var map = {};
    for (var i = 0; i < projects.length; i++) map[projects[i].id] = projects[i];
    return map;
  }

  function readStored() {
    try {
      return JSON.parse(sessionStorage.getItem(STORE) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function queryFrom(search, stored) {
    stored = stored || {};
    var q = new URLSearchParams(search || location.search);
    return {
      view: slug(q.get('view') || stored.view),
      f1: slug(q.get('f1') || stored.f1),
      f2: slug(q.get('f2') || stored.f2)
    };
  }

  function resolve(data, query) {
    var map = byId(data.projects || []);
    var presets = data.presets || {};
    var view = query.view;
    var f1 = query.f1;
    var f2 = query.f2;
    var ids = [];
    var key = 'general';
    var custom = false;

    if (f1 && f2 && map[f1] && map[f2] && f1 !== f2) {
      ids = [f1, f2];
      key = presets[view] ? view : (view || 'custom');
      custom = true;
    } else if (view && presets[view] && presets[view].featured) {
      ids = presets[view].featured.slice();
      key = view;
    } else {
      ids = ((presets.general && presets.general.featured) || ['axon-ai', 'dna']).slice();
      key = 'general';
    }

    var featured = [];
    for (var i = 0; i < ids.length && featured.length < MAX_FEATURED; i++) {
      if (map[ids[i]]) featured.push(map[ids[i]]);
    }
    if (featured.length > 2 && featured.length < 4) featured = featured.slice(0, 2);
    var preset = presets[key] || {};
    return {
      view: key,
      name: preset.name || '',
      build: data.build || '',
      custom: custom,
      sections: (!custom && preset.sections) || null,
      f1: custom ? f1 : null,
      f2: custom ? f2 : null,
      featured: featured
    };
  }

  function shareQuery(presentation) {
    if (!presentation.custom) {
      if (!presentation.view || presentation.view === 'general') return '';
      return '?view=' + encodeURIComponent(presentation.view);
    }
    var parts = [];
    if (presentation.view && presentation.view !== 'custom' && presentation.view !== 'general') {
      parts.push('view=' + encodeURIComponent(presentation.view));
    }
    if (presentation.f1) parts.push('f1=' + encodeURIComponent(presentation.f1));
    if (presentation.f2) parts.push('f2=' + encodeURIComponent(presentation.f2));
    return parts.length ? '?' + parts.join('&') : '';
  }

  function sessionQuery(presentation) {
    presentation = presentation || window.CV_PRESENTATION || queryFrom(location.search, readStored());
    var parts = [];
    if (presentation.view) parts.push('view=' + encodeURIComponent(presentation.view));
    if (presentation.f1) parts.push('f1=' + encodeURIComponent(presentation.f1));
    if (presentation.f2) parts.push('f2=' + encodeURIComponent(presentation.f2));
    return parts.length ? '&' + parts.join('&') : '';
  }

  function keepParams(href, presentation) {
    var q = shareQuery(presentation);
    if (!q) return href;
    try {
      var url = new URL(href, location.origin);
      if (url.origin !== location.origin) return href;
      if (!/^\/cv2(\/|$)/.test(url.pathname)) return href;
      if (url.search) return href;
      return url.pathname + q + url.hash;
    } catch (e) {
      return href;
    }
  }

  function mediaHtml(project) {
    if (project.video) {
      return (
        '<video class="feat-video" controls playsinline preload="metadata" title="' + esc(project.title) + '"' +
          (project.poster ? ' poster="' + esc(project.poster) + '"' : '') + '>' +
          '<source src="' + esc(project.video) + '" type="video/mp4"/>' +
        '</video>'
      );
    }
    if (project.embed) {
      return '<iframe class="feat-embed" src="' + esc(project.embed) + '" title="' + esc(project.title) + ' television profile" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>';
    }
    if (project.image) {
      return '<img src="' + esc(project.image) + '" alt="' + esc(project.alt || '') + '" loading="eager"/>';
    }
    return '';
  }

  function cardHtml(project, slot) {
    var label = (SLOT_LABELS[slot] || 'Project') + ' · ' + (project.tag || 'Project');
    if (project.embed) {
      return (
        '<div class="ov-card" data-project-id="' + esc(project.id) + '">' +
          mediaHtml(project) +
          '<span class="ov-body">' +
            '<span class="work-tag">' + esc(label) + '</span>' +
            '<strong>' + esc(project.title) + '</strong>' +
            '<span>' + esc(project.summary || '') + '</span>' +
          '</span>' +
          '<a class="featured-detail-link" href="' + esc(project.href) + '">' + esc(project.more || 'View project →') + '</a>' +
        '</div>'
      );
    }
    return (
      '<a class="ov-card" data-project-id="' + esc(project.id) + '" href="' + esc(project.href) + '">' +
        mediaHtml(project) +
        '<span class="ov-body">' +
          '<span class="work-tag">' + esc(label) + '</span>' +
          '<strong>' + esc(project.title) + '</strong>' +
          '<span>' + esc(project.summary || '') + '</span>' +
          '<span class="work-more">' + esc(project.more || 'View project →') + '</span>' +
        '</span>' +
      '</a>'
    );
  }

  function renderFeatured(presentation) {
    var root = document.getElementById('featured-projects');
    if (!root) return;
    if (!presentation.featured || presentation.featured.length < 2) {
      root.innerHTML = '';
      root.setAttribute('aria-busy', 'false');
      document.documentElement.classList.remove('cv-view-pending');
      return;
    }
    root.innerHTML = presentation.featured.map(cardHtml).join('');
    root.setAttribute('data-count', String(presentation.featured.length));
    root.setAttribute('data-cv-view', presentation.view || '');
    root.setAttribute('data-cv-build', presentation.build || '');
    root.setAttribute('aria-busy', 'false');
    document.documentElement.classList.remove('cv-view-pending');
  }

  function orderSections(presentation) {
    var order = presentation.sections;
    var anchor = document.getElementById('featured');
    if (!order || !order.length || !anchor || !anchor.parentNode) return;
    var after = anchor;
    order.forEach(function (id) {
      var section = document.getElementById(id);
      if (!section || section === anchor) return;
      after.parentNode.insertBefore(section, after.nextSibling);
      after = section;
    });
    var nav = anchor.querySelector('.ov-jump');
    if (!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    links.sort(function (a, b) {
      var ia = order.indexOf(a.getAttribute('href').slice(1));
      var ib = order.indexOf(b.getAttribute('href').slice(1));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    links.forEach(function (a) { nav.appendChild(a); });
  }

  function stampLinks(presentation) {
    var q = shareQuery(presentation);
    var home = '/cv2/' + q;
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (a) {
      var href = a.getAttribute('href');
      if (!href) return;
      if (href === '/cv2/' || href === '/cv2' || href === '/cv2/index.html') {
        a.setAttribute('href', home);
        return;
      }
      if (href.indexOf('/cv2/talk.html') === 0 && href.indexOf('?') === -1) {
        a.setAttribute('href', '/cv2/talk.html' + (q || ''));
        return;
      }
      a.setAttribute('href', keepParams(href, presentation));
    });
  }

  function persist(presentation) {
    window.CV_PRESENTATION = presentation;
    try {
      sessionStorage.setItem(STORE, JSON.stringify({
        view: presentation.view,
        f1: presentation.f1,
        f2: presentation.f2
      }));
    } catch (e) {}
  }

  function apply(data) {
    window.CV_PRESENTATIONS = data;
    var onHome = !!document.getElementById('featured-projects');
    var isTalk = document.body && document.body.classList.contains('talk');
    var params = new URLSearchParams(location.search);
    var hasQuery = !!(params.get('view') || params.get('f1'));
    var query = queryFrom(location.search, (onHome || hasQuery) ? {} : readStored());
    var presentation = resolve(data, query);
    if (document.body) document.body.setAttribute('data-cv-view', presentation.view || 'general');
    if (onHome || hasQuery) persist(presentation);
    else window.CV_PRESENTATION = presentation;
    renderFeatured(presentation);
    if (onHome) orderSections(presentation);
    if (onHome || isTalk || document.querySelector('.site-header')) stampLinks(presentation);
    document.documentElement.classList.remove('cv-view-pending');
    if (onHome && location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }

  function load() {
    if (window.CV_PRESENTATIONS) {
      apply(window.CV_PRESENTATIONS);
      return;
    }
    fetch(DATA_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('presentations');
        return res.json();
      })
      .then(apply)
      .catch(function () {
        document.documentElement.classList.remove('cv-view-pending');
      });
  }

  window.CVPresent = {
    queryFrom: queryFrom,
    resolve: resolve,
    shareQuery: shareQuery,
    sessionQuery: sessionQuery,
    load: load
  };

  load();
})();
