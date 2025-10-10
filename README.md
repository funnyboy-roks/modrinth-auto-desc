# Modrinth Auto-Description

Automatically update the description for a Modrinth project from a markdown
file in the repo.

## Links

In order to have images and links, you must use absolute urls, meaning
don't use `img.png`, use `https://example.com/img.png`.

For GitHub paths, you can use `https://raw.githubusercontent.com/<username>/<repo>/<branch>/<path>`.

> If the `branch` input is set, this action will attempt to resolve relative paths to point to your GitHub contents. If some images are not working on Modrinth, check the logs of the action to see exactly how paths are being resolved.

## Front Matter

If your readme contains front matter (either yaml or json), you can send
additional data to the Modrinth API.

All additional data can be found in the [Modrinth Docs](https://docs.modrinth.com/#tag/projects/operation/modifyProject).  
*Note: The `body` key should not be specified and will be ignored if it is.*

### Front Matter Format:

JSON:

```markdown
---
{
    "modrinth": {
        "source_url": "https://github.com/funnyboy-roks/mapify"
    }
}
---
# Your content here...
```

YAML:

```markdown
---
modrinth:
    source_url: 'https://github.com/funnyboy-roks/mapify'
---
# Your content here...
```

## Excluded Sections

You can exclude certain parts of your markdown from being included in the Modrinth description by wrapping them with special comments:

```markdown
<!-- MODRINTH_EXCLUDE_START -->
This content will be excluded from the Modrinth description.
<!-- MODRINTH_EXCLUDE_END -->
```

This is useful for hiding content that is only relevant for GitHub, such as development instructions.

## Inputs

### `auth-token`

**Required**

The auth token to use for the Modrinth API

To get this, you need to:  
1. Go to https://modrinth.com/settings/pats and sign in if you aren't already
1. Click "Create a PAT" in the top-left corner
1. Name it something that describes its purpose, i.e. "GitHub actions" or "Auto Description"
1. Under scopes, find "Write Projects" and make sure it's checked
1. Give it an expiration date -- Once this expiration date is reached, you'll need to generate a new token.
    1. This is to ensure security.  Anybody with this token could do harm to your project(s).
1. Press "Create PAT"
1. The PAT you just created should appear with some random numbers and letters, copy that
1. Put it in a [GitHub Secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
1. You're done!

### `slug`

**Required**

This is the URL, slug, or id of the Modrinth project.

### `readme`

**Optional**, default = `README.md`

The path to the readme to fetch from the root of the GitHub repo.

### `branch`

**Optional**, default = `main`

The branch to use when generating absolute URLs for images and other relative links. This ensures that the correct version of your content is referenced. Note that content from private repositories will not be accessible on Modrinth regardless of the branch specified.

## Example Usage

```yaml
on:
  push:
    branches: [ main ]
    paths: [ README.md ]
jobs:
  modrinth-desc:
    runs-on: 'ubuntu-latest'
    steps:
    - uses: actions/checkout@v3
    - uses: funnyboy-roks/modrinth-auto-desc@v1.5
      with:
        auth-token: ${{ secrets.MODRINTH_AUTH_TOKEN }}
        slug: 'mapify'
```
