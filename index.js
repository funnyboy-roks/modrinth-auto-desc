import actions from '@actions/core';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import fm from 'yaml-front-matter';

// See: https://docs.modrinth.com/#tag/projects/operation/modifyProject

const removeExcludedSections = (text) => {
    // Remove sections that are excluded from modrinth description
    // Placeholder: <!-- MODRINTH_EXCLUDE_START --> ... <!-- MODRINTH_EXCLUDE_END -->
    return text.replace(/<!--\s*MODRINTH_EXCLUDE_START\s*-->[\s\S]*?<!--\s*MODRINTH_EXCLUDE_END\s*-->/g, '');
}

const main = async () => {
    try {
        const auth = actions.getInput('auth-token');
        let slug = actions.getInput('slug');
        // Grab the slug if it's a url
        slug = slug.substring(slug.lastIndexOf('/') + 1);

        //project-name for the user agent
        let user_agent = actions.getInput("project-name")
        user_agent = user_agent == '__unset' ? slug : `${user_agent} (${slug})`

        actions.info(`Loading ${actions.getInput('readme')}.`);
        const readme = await fs.readFile(actions.getInput('readme'), 'utf-8');

        let frontMatter = fm.safeLoadFront(readme);

        // use this since it removes the frontmatter
        const content = frontMatter.__content.trim() ?? '';

        // replace excluded sections
        const cleanedContent = removeExcludedSections(content);

        // Get the `modrinth` section or empty obj if it's not set
        const modrinth = frontMatter.modrinth ?? {};

        // Prevent anybody from attempting change the description body
        //
        // This is a little confusing, because there is a key for modrinth called `discription` and one called `body`.
        // The `body` key is the one which controls the markdown description, while the `description` controls the short description shown under the name.
        if (modrinth.body) {
            // Give a warning, but still continue
            actions.warning('Ignoring `modrinth.body` in the front matter.  This field should not be set.  Use `modrinth.description` to set the short description instead.');
        }

        modrinth.body = cleanedContent;

        actions.info('Sending request to Modrinth...');
        // https://docs.modrinth.com/#tag/projects/operation/modifyProject
        const req = await fetch(`https://api.modrinth.com/v2/project/${slug}`, {
            method: 'PATCH',
            body: JSON.stringify(modrinth),
            headers: {
                Authorization: auth,
                'content-type': 'Application/json',
                'User-Agent': `${user_agent} via funnyboy-roks/modrinth-auto-desc`
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
