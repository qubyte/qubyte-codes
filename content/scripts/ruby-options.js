const select = document.querySelector('.furigana-position');

select.value = localStorage.getItem('ruby-position') || 'over';

select.addEventListener('change', evt => {
  if (evt.target.value === 'over') {
    localStorage.removeItem('ruby-position');
  } else {
    localStorage.setItem('ruby-position', evt.target.value);
  }
});
