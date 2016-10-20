(function () {
  // On-scroll schrinker for the sticky header h1.

  'use strict';

  var $header = document.querySelector('.top-header');

  function checkHeaderSmallText() {
    if (window.pageYOffset) {
      $header.classList.add('smaller');
    } else {
      $header.classList.remove('smaller');
    }
  }

  window.addEventListener('scroll', checkHeaderSmallText, false);

  checkHeaderSmallText();
}());
