import type KeepSidianPlugin from "main";
import { Setting } from "obsidian";

export async function addAutoSyncSettings(plugin: KeepSidianPlugin, containerEl: HTMLElement): Promise<void> {
	const setSettingDisabledState = (setting: Setting, disabled: boolean): void => {
		setting.setDisabled(disabled);
		const actionableElements = setting.controlEl.querySelectorAll("input, button, select, textarea");
		for (const element of actionableElements) {
			(
				element as HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement
			).disabled = disabled;
		}
	};

	new Setting(containerEl).setName("Background sync").setHeading();

	new Setting(containerEl)
		.setName("Enable background sync")
		.setDesc("Quietly download your Google Keep mirror at regular intervals.")
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.autoSyncEnabled).onChange(async (value) => {
				plugin.settings.autoSyncEnabled = value;
				plugin.refreshAutoSyncSafeguards();
				await plugin.saveSettings();
				if (value) {
					plugin.startAutoSync();
				} else {
					plugin.stopAutoSync();
				}
			})
		);

	const isSubscribed = await plugin.subscriptionService.isSubscriptionActive();

	const intervalSetting = new Setting(containerEl)
		.setName("Sync interval (hours)")
		.setDesc(
			"Change the default import interval." +
				(isSubscribed ? "" : " (Available to project supporters)")
		)
		.addText((text) =>
			text
				.setPlaceholder("24")
				.setValue(plugin.settings.autoSyncIntervalHours.toString())
				.onChange(async (value) => {
					const num = Number(value);
					if (!Number.isNaN(num) && num > 0) {
						plugin.settings.autoSyncIntervalHours = num;
						await plugin.saveSettings();
						if (plugin.settings.autoSyncEnabled) {
							plugin.startAutoSync();
						}
					}
				})
		);

	if (!isSubscribed) {
		setSettingDisabledState(intervalSetting, true);
		intervalSetting.setClass("requires-subscription");
	}

	new Setting(containerEl)
		.setName("Mirror behavior")
		.setDesc(
			"This fork is download-only. Google Keep is the source of truth; local mirrored notes may be overwritten on the next sync. Edit in Google Keep, read in Obsidian."
		);
}
