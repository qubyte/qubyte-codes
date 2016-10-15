(function () {
  // On-scroll schrinker for the sticky header h1.

  'use strict';

  var title = document.querySelector('.top-header > h1');

  function checkHeaderSmallText() {
    if (window.pageYOffset) {
      title.classList.add('smaller');
    } else {
      title.classList.remove('smaller');
    }
  }

  window.addEventListener('scroll', checkHeaderSmallText, false);

  checkHeaderSmallText();
}());
