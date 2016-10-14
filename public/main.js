(function () {
  'use strict';

  var title = document.querySelector('h1');

  function checkHeaderSmallText() {
    var distanceY = window.pageYOffset || document.documentElement.scrollTop;
    var shrinkOn = 25;

    if (distanceY > shrinkOn) {
        title.classList.add('smaller');
    } else {
        title.classList.remove('smaller');
    }
  }

  window.addEventListener('scroll', checkHeaderSmallText, false);

  checkHeaderSmallText();
}());
