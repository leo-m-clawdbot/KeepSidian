import type KeepSidianPlugin from "@app/main";

export function registerRibbonIcon(plugin: KeepSidianPlugin) {
		plugin.addRibbonIcon(
			"folder-sync",
			"KeepSidian: sync now",
		async (_evt: MouseEvent) => {
			plugin.openSyncCenter();
		}
	);
}

export function registerCommands(plugin: KeepSidianPlugin) {
	plugin.addCommand({
		id: "sync-now",
		name: "Sync now",
		callback: async () => {
			plugin.openSyncCenter({ mode: "import", autoStart: true });
		},
	});

	plugin.addCommand({
		id: "open-sync-center",
		name: "Open sync center",
		callback: async () => {
			plugin.openSyncCenter();
		},
	});

	plugin.addCommand({
		id: "import-google-keep-notes",
		name: "Download notes from Google Keep",
		callback: async () => {
			plugin.openSyncCenter({ mode: "import", autoStart: true });
		},
	});

	plugin.addCommand({
		id: "open-sync-log-file",
		name: "Open sync log file",
		callback: async () => await plugin.openLatestSyncLog(),
	});
}

export function registerRibbonAndCommands(plugin: KeepSidianPlugin) {
	registerRibbonIcon(plugin);
	registerCommands(plugin);
}
