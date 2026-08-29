/**
 * A1 email link → tiny blue-orb window, upper-right over Gmail.
 */
(function (g) {
  var PLATE = '/email-plate.html';
  var LAUNCH = '/launch.html';
  var NAME = 'axon_a1_orb';
  var W = 200;
  var H = 220;
  var MARGIN = 12;

  function plateUrl(params, origin) {
    var q = new URLSearchParams();
    q.set('src', (params && params.src) || 'email');
    q.set('popup', '1');
    q.set('autostart', '1');
    return (origin || g.location.origin) + PLATE + '?' + q;
  }

  function launchUrl(params, origin) {
    return (origin || g.location.origin) + LAUNCH + '?src=' + encodeURIComponent((params && params.src) || 'email');
  }

  function features() {
    var sw = g.screen.availWidth || g.screen.width || 1200;
    var left = Math.max(0, sw - W - MARGIN);
    return 'popup=yes,width=' + W + ',height=' + H + ',left=' + left + ',top=' + MARGIN +
      ',toolbar=no,menubar=no,location=no,status=no,resizable=no,scrollbars=no';
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
    httpsHyperlink: launchUrl
  };
})(typeof window !== 'undefined' ? window : this);
