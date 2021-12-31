let position = localStorage.getItem('ruby-position') || 'over';

const options = [
  { text: '↑', value: 'over' },
  ...CSS.supports('ruby-position', 'under') ? [{ text: '↓', value: 'under' }] : [],
  { text: 'X', value: 'off' }
];

document.body.classList.add(`ruby-position-${position}`);

const span = document.createElement('span');
const button = document.createElement('button');
span.append('ふりがな: ', button);

button.setAttribute('lang', 'ja');
button.className = 'furigana-button';
button.textContent = options.find(option => option.value === position).text;
button.onclick = () => {
  const index = options.findIndex(option => option.value === position);
  const { text, value } = options[(index + 1) % options.length];

  button.textContent = text;
  position = value;

  localStorage.setItem('ruby-position', position);

  for (const className of document.body.classList) {
    if (className.startsWith('ruby-position-')) {
      document.body.classList.remove(className);
      break;
    }
  }

  document.body.classList.add(`ruby-position-${position}`);
};

document.querySelector('main time').after(' ', span);
