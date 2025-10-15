# Modrinth Auto-Description

Automatically update the description and configuration for a Modrinth
project from a markdown file in the repo.

## Images

If any images are specified specified using relative paths, this action
will attempt to resolve them using the GitHub URL on the branch set by
the `branch` input.  If your images aren't showing up on Modrinth, check
the action logs for the URLs that are being generated.

## Front Matter

If your readme contains front matter (either yaml or json), you can send
additional data to the Modrinth API.

All additional data can be found in the [Modrinth Docs](https://docs.modrinth.com/api/operations/modifyproject/#request-body).  
*Note: The `body` key should not be specified and will be ignored if it is.*

### Front Matter Format:

JSON:

```markdown
---
{
    "modrinth": {
        "source_url": "https://github.com/funnyboy-roks/mapify",
        "categories": ["utility", "decoration"]
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
    categories: 
        - 'utility'
        - 'decoration'
---
# Your content here...
```

## Excluded Sections

Regions of the README may be excluded from the Modrinth description by
wrapping them in special comments:

```markdown
<!-- MODRINTH_EXCLUDE_START -->
This content will be excluded from the Modrinth description.
<!-- MODRINTH_EXCLUDE_END -->
```

This can be useful for hiding content that is not relevant for Modrinth,
such as development instructions.

## Inputs

### `auth-token`

**Required**

The authentication token to use for the Modrinth API

To get this, you need to:  
1. Go to https://modrinth.com/settings/pats and sign in if you aren't already
1. Click "Create a PAT" in the top-left corner
1. Give it a name
1. Under scopes, check "Write Projects"
1. Give it an expiration date -- Once this expiration date is reached, you'll need to generate a new token.
1. Click "Create PAT"
1. Copy the PAT you created and put it in a [GitHub Secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
1. Use the secret in your workflow: `${{ secrets.<YOUR_SECRET_NAME> }}`

### `slug`

**Required**

This is the URL, slug, or ID of the Modrinth project.

### `readme`

**Optional**, default = `README.md`

The path to the README to fetch, relative to the root of the repository.

### `branch`

**Optional**, default = `main`

The branch to use when generating absolute URLs for images relative
links. This ensures that the correct version of your content is
referenced. Note that content from private repositories will not be
accessible on Modrinth, regardless of the branch specified.

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
    - uses: actions/checkout@v5
    - uses: funnyboy-roks/modrinth-auto-desc@v1.7
      with:
        auth-token: ${{ secrets.MODRINTH_AUTH_TOKEN }}
        slug: 'mapify'
```
