import fetch from 'node-fetch';
import fs from 'fs/promises';
import actions from '@actions/core';
import fm from 'yaml-front-matter';

// See: https://docs.modrinth.com/api-spec/#tag/projects/operation/modifyProject

const main = async () => {
    try {
        const auth = actions.getInput('auth-token');
        let slug = actions.getInput('slug');
        // Grab the slug if it's a url
        slug = slug.substring(slug.lastIndexOf('/') + 1);

        actions.info(`Loading ${actions.getInput('readme')}.`);
        const readme = await fs.readFile(actions.getInput('readme'), 'utf-8');

        let frontMatter = fm.safeLoadFront(readme);

        // use this since it removes the frontmatter
        const content = frontMatter.__content.trim();

        // Get the `modrinth` section or empty obj if it's not set
        const modrinth = frontMatter.modrinth ?? {};

        // Prevent anybody from attempting change the description body
        //
        // This is a little confusing, because there is a key for modrinth called `discription` and one called `body`.
        // The `body` key is the one which controls the markdown description, while the `description` controls the short description shown under the name.
        if (modrinth.body) {
            // Give a warning, but still continue
            actions.warning('Ignoring `modrinth.body` in the front matter.  This field should not be set.');
        }

        modrinth.body = content;

        actions.info('Sending request to Modrinth...');
        // https://docs.modrinth.com/api-spec/#tag/projects/operation/modifyProject
        const req = await fetch(`https://api.modrinth.com/v2/project/${slug}`, {
            method: 'PATCH',
            body: JSON.stringify(modrinth),
            headers: {
                Authorization: auth,
                'content-type': 'Application/json',
            },
        });

        if (req.status == 401) { // Unauthorised -- probably not a PAT or invalid PAT
            actions.setFailed('Unauthorised access to API.  Did you set the access token properly?');
            // Should always be JSON if we get a 401
            actions.error(JSON.stringify(await req.json(), null, 4));
            return;
        }
        
        actions.info('Modrinth response');
        const res = await req.text(); // Returns json, but not always, so text instead.

        // If res is not empty, there has been an error.
        if (res) {
            // Throw a pretty printed version of the JSON
            throw 'API Error: ' + JSON.stringify(JSON.parse(res), null, 4);
        }

        actions.info('Updated description successfully!');
    } catch (err) {
        let help = [];

        // Try to be mildly helpful
        if (`${err}`.includes('no such file or directory')) {
            help.push('Did you add `uses: actions/checkout@v3` to your workflow?');
            help.push(`Did you use the correct path in the config? Path specified: ${readme}`);
        }

        help.push('If you are unable to find a solution, or you believe that this is a bug, you may file an issue at https://github.com/funnyboy-roks/modrinth-auto-desc/issues');

        help = help.map(l => '\t' + l).join('\n');
        actions.setFailed(`Action failed with error: ${err}.\n${help}`.trim());
    }
};

main();
