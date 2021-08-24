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
`^私,わたし^` renders as ^私,わたし^. It also works on
words with multiple ruby components. For example
`^振,ふ,り,,仮名,がな^` renders as ^振,ふ,り,,仮名,がな^.
The comma separated list is paired groups of characters (which is why the
<span lang="ja">り</span> is followed by an empty element).

At this time I use spans with a language attribute to wrap segments of Japanese
text. No special markdown syntax. This allows me to apply a font stack using
CSS:

```css
:lang(ja) {
  font-family: 'ヒラギノ角ゴ ProN' , 'Hiragino Kaku Gothic ProN' , '游ゴシック' , '游ゴシック体' , YuGothic , 'Yu Gothic' , 'メイリオ' , Meiryo , 'ＭＳ ゴシック' , 'MS Gothic' , HiraKakuProN-W3 , 'TakaoExゴシック' , TakaoExGothic , 'MotoyaLCedar' , 'Droid Sans Japanese' , sans-serif;
}
```

Ruby elements generated with the special ruby syntax above will also be given
a language attribute. The renderer I've written does some postprocessing to
remove unnecessary language attributes to keep things nice and tidy.

Most of the long line is fallbacks so that everyone, regardless of operating
system, should get something acceptable to read. The list was borrowed from
[this excellent article on Japanese font stacks][fonts].

[fonts]: https://hayataki-masaharu.jp/web-typography-in-japanese/
