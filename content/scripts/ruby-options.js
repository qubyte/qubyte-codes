function setupRubyDialog() {
  const dialog = window['ruby-options'];
  const form = dialog.querySelector('form');
  const initialPosition = localStorage.getItem('ruby-position') || 'over';

  if (!CSS.supports('ruby-position', 'under')) {
    const radio = form.querySelector('[value="under"]');

    // The parent is the label containing the radio button.
    radio.parentElement.remove();
  }

  form['ruby-position'].value = initialPosition;
  document.body.classList.add(`ruby-position-${initialPosition}`);

  form.onchange = () => {
    const position = dialog.querySelector('form')['ruby-position'].value;

    localStorage.setItem('ruby-position', position);

    for (const className of document.body.classList) {
      if (className.startsWith('ruby-position-')) {
        document.body.classList.remove(className);
      }
    }

    document.body.classList.add(`ruby-position-${position}`);
  };

  const button = document.createElement('button');
  button.textContent = 'ふりがな';
  button.setAttribute('lang', 'ja');
  button.onclick = () => {
    (dialog.showModal || dialog.show).call(dialog);
  };

  document.querySelector('main time').after(' ', button);

  dialog.hidden = false;
}

if (typeof HTMLDialogElement === 'function') {
  setupRubyDialog();
}
