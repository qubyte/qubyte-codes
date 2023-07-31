[![Netlify Status](https://api.netlify.com/api/v1/badges/e38f5c44-2365-4afc-b698-5b10c4a87c3c/deploy-status)](https://app.netlify.com/sites/angry-noyce-0912e2/deploys)

# Qubyte Codes

This repository contains both the static site generator and content for
https://qubyte.codes.

## The generator

The generator is mostly contained in [index.js](./index.js). Most of the heavy
lifting is done by a custom graph build system and
[marked](https://github.com/markedjs/marked), which takes markdown files and
processes them into HTML content. It's not perfect though, and some monkey
patching was necessary. The [lib/render.js](./lib/render.js) module does this
patching, and adds syntax highlighting and formatting of mathematical formulae.

[serve.js](./scripts/serve.js) is a development server. When files change parts
of the build graph are re-run to get updated output.

Source files are contained in the [src](./src) and [content](./content)
directories. Upon build, a public directory is created, and some of these source
files copied over (ones which need no compilation, such as the service worker).
Other files must be generated and are placed in the public directory as they are
created.

[netlify.toml](./netlify.toml) is a configuration for
[Netlify](https://www.netlify.com/), which hosts my blog (I highly recommend
it). At the time of writing this file contains only configuration for headers.
These are optimised for security and for browser caching of CSS. Originally I
hosted this blog on a DigitalOcean droplet using NGINX. A config for that is
still a part of this repo, [nginx.conf](./nginx.conf).

## CSS

I use [postcss](https://postcss.org/) to compile CSS. In principle, the CSS can
be used without it. For the most part postcss is used to concatenate and minify
the CSS. The output CSS is hashed, and the hash becomes part of the CSS
filename. This is to cache-bust, since CSS is given a long or indefinite cache
time to avoid it blocking page loads after it has been loaded once.

With the exception of syntax highlighting, this site largely avoids using
classes in HTML as hooks for CSS, instead asserting that semantic markup
provides sufficient context for CSS to stick to.

## Icons

The blog is a Progressive Web App (PWA), and has icons at various sizes
accordingly. One of these is also the favicon.

## Posts (content)

This directory contains the markdown sources of published posts. Each post has
a JSON preamble containing various metadata:

| name | description |
| ---- | ----------- |
| datetime | The publication timestamp of the post. If this is in the future then the post will not be rendered. |
| title | The title of the post. |
| description | The description of the post. This is added to the HTML head as a meta description and a meta twitter description. The latter is used by twitter to populate twitter cards. |
| draft | If true, the post will not be rendered. |
| tags | A list of tags. These are displayed at the top of each entry, and are also used when sharing to twitter and mastodon via the links at the bottom of each post. |
| webmentions | A list of [webmentions](https://indieweb.org/Webmention) from other blogs. |
| scripts | A list of objects with an `href` field. These will be added as module type scripts to the head of the post. |

## Templates

I use [handlebars](https://handlebarsjs.com/) templates to render content into
pages. Some of these are containing pages, and others are common components of
pages. They're pretty old school, but do a good job.

## The service worker and manifest

The [service worker](./src/sw.js) and [manifest](./src/manifest) are files which
enable this blog to behave as a PWA. For the most part, this provides custom
caching. It also allows this blog to be "installed" on android (though I'm not
really interested in this functionality).
