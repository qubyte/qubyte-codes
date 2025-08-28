---
{
  "datetime": "2024-02-18T15:00:00Z",
  "updatedAt": null,
  "draft": false,
  "title": "Colophon",
  "description": "Technical details about this site.",
  "tags": [
    "AboutThisBlog"
  ],
  "webmentions": [
    {
      "source": "https://pesce.cc/colophon",
      "author": {
        "name": "João Pesce",
        "url": "https://pesce.cc"
      },
      "published": "2024-03-14",
      "kind": "mention"
    }
  ]
}
---
## Philosophy

I have tried to build this website in a way which aligns with my priorities:

- Respect the reader. This means a lot of things, from delivering less over the
  wire (respect their data plan) to leaning into HTML and CSS over JS (respect
  their battery).
- Respect the planet. Similar to the above, the less delivered over the wire,
  and the less computationally expensive to serve, parse, and render, the less
  carbon I'm responsible for putting into the atmosphere.
  [This site is cleaner than 100% of other sites on the web][website-carbon-calculator].[^][I guess this is rounded up to the nearest percent.]

In practice this means:

- No tracking.
- Semantic markup. This is easier for a human reader peaking at the markup to
  reason about, and also easier for screen readers.
- Less markup. No unnecessary `<div>`s and `<span>`s. This means less over the
  wire and less for the browser to chew on.
- Classless CSS. In line with the above, I've tried to avoid peppering my HTML
  with too many classes, leaning instead into tag selectors. Relationships
  between elements determine how they're laid out.
- [Rule of least power][rule-of-least-power]. For me this tends to mean using
  HTML and CSS when possible, opting for JS only as a last resort. This also
  applies to hosting (serving static file rather than maintaining a dedicated
  application server). Most pages on this site use no JS at all.
- Progressive enhancement. For example, pages with ruby annotations use a little
  JS to store the ruby position preference in local storage, but browsers with
  JS disabled will still render everything.
- Deliver optimized images using content negotiation.

## Hosting

### DNS

I buy my domain names through [Namecheap]. Domain name providers are often a
source of pain, but I've been with Namecheap since 2015 and so far I've had no
issue with them. That said, I've not tried to move domain name providers, so
your mileage may vary.

### Version control and source code hosting

Source code is versioned using [git] and hosted in a public repository on
[GitHub].[^][This site also hosts its own source code as an HTTPS git server.
Originally I did this as an easter egg.]

This site is hosted on [Netlify]. The basic product is solid, and it's reliable
enough for personal site stuff. A few times a year I'll have issues with more
advanced features like Functions or Build Plugins. Netlify is a good fit for the
push-to-publish way I author longer articles. When a new post is pushed or
merged to the main branch it triggers a site build in Netlify. Originally this
site was hosted on a server rented from [DigitalOcean], with [Nginx] as the
server software. This site is mostly static files, so maintaining a server and
the Nginx configuration was overkill.

## Static site generator

This site is built with a static site generator of my own design. Regular posts
and Japanese notes are authored in my [own markdown variant][marqdown], compiled
with [marked]. Page rendering is done with [Handlebars]. The generator runs on
[Node.js].

## Dynamic IndieWeb functionality

### Webmention receiver

I wrote a Netlify function to [receive][webmention-receiver] [Webmentions]. The
function performs basic validation (does the source URL really mention the
target? Etc.), and then creates a GitHub issue with a digest of the mention
information. I hand moderate these, and mentions I'm happy with are added to
page they point to.

### Webmention dispatcher

Each time the site is published, a [Netlify Build Plugin][webmention-dispatch] I
wrote compares [the atom feed](/atom.xml) of this site before and after. Any
new, changed, or removed pages are scanned for outbound links, and mentions are
dispatched as appropriate.

### [POSSE] (publish on your own site and syndicate elsewhere)

A [GitHub Actions] workflow [watches the repository][syndication-workflow] for
new notes and links and sends these to [my Mastodon account][mastodon-qubyte].

### Micropub receiver

I wrote a pair of Netlify functions to act as a [Micropub]
[endpoint][micropub-endpoint] and a Micropub
[media endpoint][micropub-media-endpoint]. These add content to the repository
hosted on GitHub, triggering image resizing and builds.

### Micropub clients

I use a custom [Omnibear] build as a Safari [WebExtension] using
[these instructions][safari-build-web-extension] for when I'm on my laptop. I
have a suite of my own [MacOS/iOS shortcuts][Shortcuts] to send notes,
bookmarks, photos, likes, and to log study sessions, which provides a natural
integration across iOS for when I'm on my phone.

[website-carbon-calculator]: https://www.websitecarbon.com/website/qubyte-codes/
[rule-of-least-power]: https://adactio.com/journal/14327
[Namecheap]: https://www.namecheap.com
[git]: https://git-scm.com/
[GitHub]: https://github.com
[Netlify]: https://www.netlify.com
[DigitalOcean]: https://www.digitalocean.com
[Nginx]: https://nginx.org/
[Webmentions]: https://www.w3.org/TR/webmention/
[Node.js]: https://nodejs.org/en
[marqdown]: /blog/marqdown
[marked]: https://marked.js.org
[Handlebars]: https://handlebarsjs.com
[webmention-receiver]: https://github.com/qubyte/qubyte-codes/blob/main/functions/receive-webmention.js
[webmention-dispatch]: https://github.com/qubyte/qubyte-codes/blob/main/plugins/dispatch-webmentions/index.js
[POSSE]: https://indieweb.org/POSSE
[GitHub Actions]: https://docs.github.com/en/actions
[syndication-workflow]: https://github.com/qubyte/qubyte-codes/blob/main/.github/workflows/syndicate-to-mastodon.yml
[mastodon-qubyte]: https://sunny.garden/@aura
[Micropub]: https://www.w3.org/TR/micropub/
[micropub-endpoint]: https://github.com/qubyte/qubyte-codes/blob/main/functions/micropub.js
[micropub-media-endpoint]: https://github.com/qubyte/qubyte-codes/blob/main/functions/micropub.js
[Omnibear]: https://omnibear.com
[WebExtension]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
[safari-build-web-extension]: https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari
[Shortcuts]: https://support.apple.com/en-gb/guide/shortcuts/welcome/ios
