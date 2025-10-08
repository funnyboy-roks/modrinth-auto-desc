import coreActions from '@actions/core';
import githubActions from '@actions/github';
import fetch from 'node-fetch';
import fm from 'yaml-front-matter';

// See: https://docs.modrinth.com/#tag/projects/operation/modifyProject

const getGithubRawUrl = async (token) => {
    const context = githubActions.context;
    let { owner, repo } = context.repo;

    let branch;

    // 1. Handle Pull Requests
    if (context.ref && context.ref.startsWith('refs/pull/')) {
        const pr = context.payload.pull_request;
        if (!pr) {
            throw new Error('Pull request data not available in context');
        }

        // Assuming `pr.head.ref` contains just the branch name (e.g., "feature-branch")
        branch = pr.head.ref;

        coreActions.info(`PR detected: branch = ${branch}, repo = ${owner}/${repo}`);
    }
    // 2. Handle branch pushes
    else if (context.ref && context.ref.startsWith('refs/heads/')) {
        branch = context.ref.replace('refs/heads/', '');
        coreActions.info(`Branch push: ${branch}`);
    }
    // 3. Handle tags
    else if (context.ref && context.ref.startsWith('refs/tags/')) {
        branch = context.ref.replace('refs/tags/', '');
        coreActions.info(`Tag: ${branch}`);
    }
    // 4. Fallback to default branch
    else {
        if (!token) {
            branch = 'main';
            coreActions.warning(
                `Cannot determine branch from ref "${context.ref}" and no repo-token provided. ` +
                `Defaulting to "main". This may cause file resolution issues.`
            );
        } else {
            const octokit = githubActions.getOctokit(token);
            try {
                const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
                branch = repoData.default_branch;
                coreActions.info(`Using default branch: ${branch}`);
            } catch (error) {
                throw new Error(`Failed to get repository info: ${error.message}`);
            }
        }
    }

    // URL-encode branch for special characters
    const encodedBranch = encodeURIComponent(branch);
    const rawUrlBase = `https://raw.githubusercontent.com/${owner}/${repo}/${encodedBranch}/`;

    coreActions.info(`Raw URL base: ${rawUrlBase}`);
    return rawUrlBase;
};

const cleanFilePath = (filePath) => {
    // Remove leading ./ from paths like ./README.md or ./dist/README.md
    return filePath.replace(/^\.\//, '');
};

const readReadmeFile = async (readmePath, token) => {
    let url;

    // Determine the URL to fetch from
    if (readmePath.startsWith('http://') || readmePath.startsWith('https://')) {
        url = readmePath;
        coreActions.info(`Loading readme from URL: ${readmePath}`);
    } else {
        // For relative paths, construct GitHub raw URL
        coreActions.info(`Loading readme from relative path: ${readmePath}`);
        const rawUrlBase = await getGithubRawUrl(token);
        const cleanedPath = cleanFilePath(readmePath);
        url = rawUrlBase + cleanedPath;
    }

    // Add token as query parameter if provided
    if (token) {
        const urlObj = new URL(url);
        urlObj.searchParams.set('token', token);
        url = urlObj.toString();
    }

    // Fetch content from URL
    coreActions.info(`Fetching from: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch readme from URL: ${response.status} ${response.statusText}`);
    }
    return await response.text();
};

const removeExcludedSections = (text) => {
    // Remove sections that are excluded from modrinth description
    // Placeholder: <!-- MODRINTH_EXCLUDE_START --> ... <!-- MODRINTH_EXCLUDE_END -->
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

        const repoToken = coreActions.getInput('repo-token');

        // Read the readme file (handle both local paths and HTTPS URLs)
        readme = await readReadmeFile(readmePath, repoToken);

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
            coreActions.warning('Ignoring `modrinth.body` in the front matter.  This field should not be set.  Use `modrinth.description` to set the short description instead.');
        }

        modrinth.body = cleanedContent;

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
