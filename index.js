import fetch from 'node-fetch';
import fs from 'fs/promises';
import actions from '@actions/core';

const main = async () => {
    try {
        const auth = actions.getInput('auth-token');
        const slug = actions.getInput('slug');

        actions.info(`Loading ${actions.getInput('readme')}.`);
        const readme = await fs.readFile(actions.getInput('readme'), 'utf-8');

        actions.info('Sending request to Modrinth...');
        // https://docs.modrinth.com/api-spec/#tag/projects/operation/modifyProject
        const req = await fetch(`https://api.modrinth.com/v2/project/${slug}`, {
            method: 'PATCH',
            body: JSON.stringify({
                body: readme,
            }),
            headers: {
                Authorization: auth,
                'content-type': 'Application/json',
            },
        });
        
        actions.info('Modrinth response');
        const res = await req.text(); // Returns json, but not always, so text instead.

        // If res is not empty, there has been an error.
        if (res) {
            throw JSON.stringify(JSON.parse(res), null, 4);
        }

        actions.info('Updated description successfully!');
    } catch (err) {
        actions.error(err);

        // Try to be mildly helpful
        if (`${err}`.includes('no such file or directory')) {
            actions.error('Did you add `uses: actions/checkout@v3` to your workflow?');
        }

        actions.setFailed(`Action failed with error: ${err}`);
    }
};

main();
