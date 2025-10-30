import coreActions from '@actions/core';
import githubActions from '@actions/github';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';
import fm from 'yaml-front-matter';

// See: https://docs.modrinth.com/#tag/projects/operation/modifyProject

const getGithubRawUrl = async (branchName) => {
    const { owner, repo } = githubActions.context.repo;

    // URL-encode branch for special characters
    const encodedBranch = encodeURIComponent(branchName);
    const rawUrlBase = `https://raw.githubusercontent.com/${owner}/${repo}/${encodedBranch}/`;

    coreActions.info(`Raw URL base: ${rawUrlBase}`);
    return rawUrlBase;
};

const cleanFilePath = (filePath) => {
    // Remove leading ./ from paths like ./README.md or ./dist/README.md
    return filePath.replace(/^\.\//, '');
};


const removeExcludedSections = (text) => {
    // Remove sections that are excluded from modrinth description
    // Placeholder: <!-- MODRINTH_EXCLUDE_START --> ... <!-- MODRINTH_EXCLUDE_END -->

    // Check for unmatched tags and proper ordering
    const tagRegex = /<!--\s*MODRINTH_EXCLUDE_(START|END)\s*-->/g;
    const tags = [];
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
        tags.push({
            type: match[1],
            index: match.index
        });
    }
    
    let depth = 0;
    for (let i = 0; i < tags.length; i++) {
        if (tags[i].type === 'START') {
            depth++;
        } else {
            depth--;
            if (depth < 0) {
                throw new Error(`Invalid MODRINTH_EXCLUDE tag order: found MODRINTH_EXCLUDE_END at position ${tags[i].index} without a corresponding MODRINTH_EXCLUDE_START tag.`);
            }
        }
    }

    if (depth !== 0) {
        throw new Error(`Unmatched MODRINTH_EXCLUDE tags found. Please ensure all MODRINTH_EXCLUDE_START tags have a corresponding MODRINTH_EXCLUDE_END tag.`);
    }

    return text.replace(/<!--\s*MODRINTH_EXCLUDE_START\s*-->[\s\S]*?<!--\s*MODRINTH_EXCLUDE_END\s*-->/g, '');
}

const main = async () => {
    let readme;
    try {
        const auth = coreActions.getInput('auth-token');
        let slug = coreActions.getInput('slug');
        // Grab the slug if it's a url
        slug = slug.substring(slug.lastIndexOf('/') + 1);

        //project-name for the user agent
        let user_agent = coreActions.getInput("project-name")
        user_agent = user_agent == '__unset' ? slug : `${user_agent} (${slug})`

        const readmePath = coreActions.getInput('readme');
        const branch = coreActions.getInput('branch');

        // Read the readme file
        coreActions.info(`Loading ${coreActions.getInput('readme')}.`);
        readme = await fs.readFile(readmePath, 'utf-8');

        let frontMatter = fm.safeLoadFront(readme);

        // use this since it removes the frontmatter
        const content = frontMatter.__content.trim() ?? '';

        // replace excluded sections
        const cleanedContent = removeExcludedSections(content);

        // Replace relative image links with absolute raw github links
        let finalContent = cleanedContent;
        if (branch && branch.length > 0) {
            const rawUrlBase = await getGithubRawUrl(branch);
            const cleanedPath = cleanFilePath(readmePath);

            // Get the directory of the readme file
            const readmeDir = path.dirname(cleanedPath);

            // This regex matches markdown image syntax ![alt text](image_url)
            // Excludes absolute URLs (http/https)
            finalContent = cleanedContent.replace(/!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g, (match, altText, imgPath) => {
                const normalizedPath = path.posix.normalize(path.posix.join(readmeDir, imgPath));
                const absoluteUrl = new URL(normalizedPath, rawUrlBase).href;

                coreActions.info(`Converted image path: ${imgPath} -> ${absoluteUrl}`);
                return `![${altText}](${absoluteUrl})`;
            });

            coreActions.info('Converted relative image links to absolute links.');
        } else {
            coreActions.info('No branch specified, skipping conversion of relative image links.');
        }

        // Get the `modrinth` section or empty obj if it's not set
        const modrinth = frontMatter.modrinth ?? {};

        // Prevent anybody from attempting change the description body
        //
        // This is a little confusing, because there is a key for modrinth called `discription` and one called `body`.
        // The `body` key is the one which controls the markdown description, while the `description` controls the short description shown under the name.
        if (modrinth.body) {
            // Give a warning, but still continue
            coreActions.warning('Ignoring `modrinth.body` in the front matter.  This field should not be set.  Use `modrinth.description` to set the short description instead.');
        }

        modrinth.body = finalContent;

        coreActions.info('Sending request to Modrinth...');
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
            coreActions.setFailed('Unauthorised access to API.  Did you set the access token properly?');
            // Should always be JSON if we get a 401
            coreActions.error(JSON.stringify(await req.json(), null, 4));
            return;
        }

        coreActions.info('Modrinth response');
        const res = await req.text(); // Returns json, but not always, so text instead.

        // If res is not empty, there has been an error.
        if (res) {
            // Throw a pretty printed version of the JSON
            throw 'API Error: ' + JSON.stringify(JSON.parse(res), null, 4);
        }

        coreActions.info('Updated description successfully!');
    } catch (err) {
        let help = [];

        // Try to be mildly helpful
        if (`${err}`.includes('no such file or directory')) {
            help.push('Did you add `uses: actions/checkout@v3` to your workflow?');
            help.push(`Did you use the correct path in the config? Path specified: ${readme}`);
        }

        help.push('If you are unable to find a solution, or you believe that this is a bug, you may file an issue at https://github.com/funnyboy-roks/modrinth-auto-desc/issues');

        help = help.map(l => '\t' + l).join('\n');
        coreActions.setFailed(`Action failed with error: ${err}.\n${help}`.trim());
    }
};

main();

