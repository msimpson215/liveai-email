/**
 * Live AI Dash Email — A1 talk window in the upper-right corner.
 * Gmail (or whatever mail client) stays open underneath. Clicking back
 * to mail dismisses this popup. No Gmail masquerade / illusion.
 */
(function (g) {
  var TALK = '/talk.html';
  var LAUNCH = '/launch.html';
  var NAME = 'axon_a1_talk';
  /* Compact panel — does not take over the screen */
  var W = 420;
  var H = 560;
  var MARGIN = 16;

  function talkUrl(params, origin) {
    var q = new URLSearchParams();
    q.set('src', (params && params.src) || 'email');
    q.set('popup', '1');
    q.set('autostart', '1');
    if (params && params.name) q.set('name', params.name);
    if (params && params.tier) q.set('tier', params.tier);
    return (origin || g.location.origin) + TALK + '?' + q;
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
    var l = Math.max(0, sw - W - MARGIN);
    var t = MARGIN;
    return { left: l, top: t };
  }

  function features() {
    var p = leftTop();
    return 'popup=yes,width=' + W + ',height=' + H + ',left=' + p.left + ',top=' + p.top +
      ',toolbar=no,menubar=no,location=no,status=no,resizable=yes,scrollbars=yes,directories=no';
  }

  /* String form for javascript: email hyperlinks (evaluates screen at click time) */
  function jsFeatures() {
    return 'popup=yes,width=' + W + ',height=' + H +
      ",left='+Math.max(0,(screen.availWidth||screen.width)-" + W + '-' + MARGIN + ")+',top=" + MARGIN +
      "',toolbar=no,menubar=no,location=no,status=no,resizable=yes,scrollbars=yes,directories=no";
  }

  function openEmailOrb(params, origin) {
    return g.open(talkUrl(params, origin), NAME, features());
  }

  g.AxonEmailOrb = {
    WIDTH: W,
    HEIGHT: H,
    openEmailOrb: openEmailOrb,
    buildTalkUrl: talkUrl,
    buildPlateUrl: talkUrl, /* legacy alias */
    buildLaunchUrl: launchUrl,
    httpsHyperlink: launchUrl,
    javascriptHyperlink: function (params, origin) {
      var u = talkUrl(params, origin).replace(/'/g, '%27');
      return "javascript:void(window.open('" + u + "','" + NAME + "'," + jsFeatures() + '))';
    }
  };
})(typeof window !== 'undefined' ? window : this);
