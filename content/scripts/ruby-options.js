const select = document.createElement('select');
select.className = 'furigana-position';
select.name = 'furigana mode';
select.onchange = e => localStorage.setItem('ruby-position', e.target.value);

const over = document.createElement('option');
over.textContent = 'over';
over.value = 'over';
select.append(over);

if (CSS.supports('ruby-position', 'under')) {
  const under = document.createElement('option');
  under.textContent = 'under';
  under.value = 'under';
  select.append(under);
}

const off = document.createElement('option');
off.textContent = 'off';
off.value = 'off';
select.append(off);

select.value = localStorage.getItem('ruby-position') || 'over';

const label = document.createElement('span');
label.lang = 'ja';
label.textContent = 'ふりがな';

document.querySelector('main time').after(' ', label, ': ', select);
