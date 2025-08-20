declare module 'cypress-image-snapshot/plugin' {
	import {
		PluginEvents,
		PluginConfigOptions,
	} from 'cypress/types/net-stubbing';

	export function addMatchImageSnapshotPlugin(
		on: PluginEvents,
		config: PluginConfigOptions
	): void;
}

declare module 'cypress-image-snapshot/command' {
	export function addMatchImageSnapshotCommand(): void;
}
