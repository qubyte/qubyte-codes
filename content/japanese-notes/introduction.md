---
{
  "datetime": "2020-05-04T22:10Z",
  "title": "Introduction",
  "description": "It's about time I started keeping notes again!"
}
---
It's about time I started keeping notes again! I've engineered in just enough
to make it fun rather than an hindrance. For example, I can how write furigana
in a way that doesn't look out of place in markdown. For example,
<code>r</code><code>[私,わたし]</code> renders as r[私,わたし]. It also works on
words with multiple ruby components. For example
<code>r</code><code>[振,ふ,り,,仮名,がな]</code> renders as r[振,ふ,り,,仮名,がな].
The comma separated list is paired groups of characters (which is why the
<span lang="ja">り</span> is followed by an empty element). An alternative
format which is friendlier when input is in Japanese is
<code>r</code><code>「振、ふ、り、、仮名、がな」</code>.

I've also added fenced blocks for languages. When a fenced block is labelled as
`lang:ja` for example, it'll render as a paragraph with a `lang="ja"` attribute.
This is good practice, but also makes it easy to apply a different typeface,
which is important for CJK languages. Luckily CSS can select based on language
attribute:

```css
:lang(ja) {
  font-family: 'ヒラギノ角ゴ ProN' , 'Hiragino Kaku Gothic ProN' , '游ゴシック' , '游ゴシック体' , YuGothic , 'Yu Gothic' , 'メイリオ' , Meiryo , 'ＭＳ ゴシック' , 'MS Gothic' , HiraKakuProN-W3 , 'TakaoExゴシック' , TakaoExGothic , 'MotoyaLCedar' , 'Droid Sans Japanese' , sans-serif;
}
```

Most of the long line is fallbacks so that everyone, regardless of operating
system, should get something acceptable to read. The list was borrowed from
[this excellent article on Japanese font stacks][fonts].

[fonts]: https://hayataki-masaharu.jp/web-typography-in-japanese/
