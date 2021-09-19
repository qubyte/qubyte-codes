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
`{ja:^私,わたし^}` renders as {ja:^私,わたし^}. It also works on words with
multiple ruby components. For example `{ja:^振,ふ,り,,仮名,がな^}` renders as
{ja:^振,ふ,り,,仮名,がな^}. The comma separated list is paired groups of
characters (which is why the {ja:り} is followed by an empty element).

The `{ja:...}` container ensures that a language attribute set to `"ja"` affects
the text contained in it. In general this mean it'll wrap the text within in a
span with the language attribute, but when possible the attribute is placed
instead on the parent element (when the text inside has no sibling HTML
nodes) or the child element (when the text inside is itself contained in another
element, which is most commonly a ruby element for furigana).

For example, a paragraph containing only `{en:abc}` will render to:

```html
<p lang="en">abc</p>
```

A paragraph containing `abc {en:**def**} ghi` will render to:

```html
<p>abc <strong lang="en">def</strong> ghi</p>
```

But when there is no other option, a span will be used, for example for
`abc {en:def} ghi`:

```html
<p>abc <span lang="en">def</span> ghi</p>
```

The language attribute is important for the rendering of furigana in paricular.
I use the following CSS to choose a font family based on language attribute:

```css
:lang(ja) {
  font-family: 'ヒラギノ角ゴ ProN' , 'Hiragino Kaku Gothic ProN' , '游ゴシック' , '游ゴシック体' , YuGothic , 'Yu Gothic' , 'メイリオ' , Meiryo , 'ＭＳ ゴシック' , 'MS Gothic' , HiraKakuProN-W3 , 'TakaoExゴシック' , TakaoExGothic , 'MotoyaLCedar' , 'Droid Sans Japanese' , sans-serif;
}
```

Most of the long line is fallbacks so that everyone, regardless of operating
system, should get something acceptable to read. The list was borrowed from
[this excellent article on Japanese font stacks][fonts].

[fonts]: https://hayataki-masaharu.jp/web-typography-in-japanese/
