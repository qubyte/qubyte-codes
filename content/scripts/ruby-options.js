const select = document.querySelector('.furigana-position');

select.value = localStorage.getItem('ruby-position') || 'over';
select.onchange = e => localStorage.setItem('ruby-position', e.target.value);
