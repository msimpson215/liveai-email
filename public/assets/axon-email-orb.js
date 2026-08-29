/**
 * Live AI Dash Email — tiny A1 orb window, upper-right.
 * Customer stays on Gmail. Clicking back to mail dismisses this.
 * Just the orb — no fake inbox, no full page.
 */
(function (g) {
  var PLATE = '/email-plate.html';
  var LAUNCH = '/launch.html';
  var NAME = 'axon_a1_orb';
  /* Super-small: orb only */
  var W = 260;
  var H = 280;
  var MARGIN = 12;

  function plateUrl(params, origin) {
    var q = new URLSearchParams();
    q.set('src', (params && params.src) || 'email');
    q.set('popup', '1');
    q.set('autostart', '1');
    if (params && params.name) q.set('name', params.name);
    if (params && params.tier) q.set('tier', params.tier);
    return (origin || g.location.origin) + PLATE + '?' + q;
  }

  function launchUrl(params, origin) {
    var q = new URLSearchParams();
    q.set('src', (params && params.src) || 'email');
    if (params && params.name) q.set('name', params.name);
    if (params && params.tier) q.set('tier', params.tier);
    return (origin || g.location.origin) + LAUNCH + '?' + q;
  }

  function leftTop() {
    var sw = g.screen.availWidth || g.screen.width || 1200;
    return {
      left: Math.max(0, sw - W - MARGIN),
      top: MARGIN
    };
  }

  function features() {
    var p = leftTop();
    return 'popup=yes,width=' + W + ',height=' + H + ',left=' + p.left + ',top=' + p.top +
      ',toolbar=no,menubar=no,location=no,status=no,resizable=no,scrollbars=no,directories=no';
  }

  function jsFeatures() {
    return 'popup=yes,width=' + W + ',height=' + H +
      ",left='+Math.max(0,(screen.availWidth||screen.width)-" + W + '-' + MARGIN + ")+',top=" + MARGIN +
      "',toolbar=no,menubar=no,location=no,status=no,resizable=no,scrollbars=no,directories=no";
  }

  function openEmailOrb(params, origin) {
    return g.open(plateUrl(params, origin), NAME, features());
  }

  g.AxonEmailOrb = {
    WIDTH: W,
    HEIGHT: H,
    openEmailOrb: openEmailOrb,
    buildTalkUrl: plateUrl,
    buildPlateUrl: plateUrl,
    buildLaunchUrl: launchUrl,
    httpsHyperlink: launchUrl,
    javascriptHyperlink: function (params, origin) {
      var u = plateUrl(params, origin).replace(/'/g, '%27');
      return "javascript:void(window.open('" + u + "','" + NAME + "'," + jsFeatures() + '))';
    }
  };
})(typeof window !== 'undefined' ? window : this);
