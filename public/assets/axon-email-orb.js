/**
 * Tiny A1 orb — same gif as the email — upper-right over Gmail.
 */
(function (g) {
  var PLATE = '/email-plate.html';
  var LAUNCH = '/launch.html';
  var NAME = 'axon_a1_orb';
  var W = 220;
  var H = 240;
  var MARGIN = 12;

  function plateUrl(params, origin) {
    var q = new URLSearchParams();
    q.set('src', (params && params.src) || 'email');
    q.set('popup', '1');
    q.set('autostart', '1');
    return (origin || g.location.origin) + PLATE + '?' + q;
  }

  function launchUrl(params, origin) {
    var q = new URLSearchParams();
    q.set('src', (params && params.src) || 'email');
    return (origin || g.location.origin) + LAUNCH + '?' + q;
  }

  function features() {
    var sw = g.screen.availWidth || g.screen.width || 1200;
    var left = Math.max(0, sw - W - MARGIN);
    return 'popup=yes,width=' + W + ',height=' + H + ',left=' + left + ',top=' + MARGIN +
      ',toolbar=no,menubar=no,location=no,status=no,resizable=no,scrollbars=no';
  }

  function jsFeatures() {
    return 'popup=yes,width=' + W + ',height=' + H +
      ",left='+Math.max(0,(screen.availWidth||screen.width)-" + W + '-' + MARGIN + ")+',top=" + MARGIN +
      "',toolbar=no,menubar=no,location=no,status=no,resizable=no,scrollbars=no";
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
