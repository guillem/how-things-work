import type { FullConfig } from '@playwright/test';

export default async function verifyWorkspace(config: FullConfig) {
	const baseURL = config.projects[0].use.baseURL;
	if (!baseURL) throw new Error('Development browser tests require a baseURL.');
	const response = await fetch(new URL('__validation_workspace', baseURL));
	if (!response.ok || (await response.text()) !== process.cwd()) {
		throw new Error(
			'The test server belongs to another checkout or is not the test Vite server. ' +
				'Stop it or choose a separate PW_DEV_PORT for this worktree.'
		);
	}
}
