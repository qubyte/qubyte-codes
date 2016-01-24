var form = document.getElementById('character-counter');

form.onsubmit = function (e) {
  e.preventDefault();

  var text = form.getElementsByTagName('textarea')[0].value;
  var char = form.getElementsByTagName('input')[0].value.trim();
  var output = form.getElementsByTagName('output')[0];

  output.value = (text.match(new RegExp(char, 'g')) || []).length;
};
