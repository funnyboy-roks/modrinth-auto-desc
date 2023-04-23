# Modrinth Auto-Description

Automatically update the description for a Modrinth project from a markdown
file in the repo.

## Links

In order to have images and links, you must use absolute urls, meaning
don't use `img.png`, use `https://example.com/img.png`.

For GitHub paths, you can use `https://raw.githubusercontent.com/<username>/<repo>/<branch>/<path>`.
Ex: `img/screenshot.png` in my `worldedit-selection-viewer` repo on the
`main` branch becomes `https://raw.githubusercontent.com/funnyboy-roks/worldedit-selection-viewer/main/img/screenshot.png`

## Front Matter

If your readme contains front matter (either yaml or json), you can send
additional data to the Modrinth API.

All additional data can be found in the [Modrinth Docs](https://docs.modrinth.com/api-spec/#tag/projects/operation/modifyProject).  
*Note: The `body` key should not be specified and will be ignored if it is.*

### Front Matter Format:

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


## Inputs

### `auth-token`

**Required**

The auth token to use for the Modrinth API  

To get this, you need to:

1. Sign into Modrinth
2. Access your cookies (<kbd>Shift + F9</kbd> in FireFox, maybe something similar on
   Chrome)
3. Copy the `auth-token` cookie
4. Put it in a [GitHub Secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
5. You're done!

### `slug`

**Required**

This is the URL, slug, or id of the Modrinth project.

### `readme`

**Optional**, default = `README.md`

The path to the readme to fetch from the root of the GitHub repo.

## Example Usage

```yaml
on:
  push:
    branches: [ main ]
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
