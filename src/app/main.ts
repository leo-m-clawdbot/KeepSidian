import { Notice, Plugin } from "obsidian";
import type { ProgressBarComponent } from "obsidian";
import type { KeepSidianPluginSettings, LastSyncSummary, SyncMode } from "../types/keepsidian-plugin-settings";
import { resolveLoadedSettings } from "../types/keepsidian-plugin-settings";
import { SubscriptionService } from "@services/subscription";
import type { NoteImportOptions } from "@ui/modals/NoteImportOptionsModal";
import { SyncProgressModal } from "@ui/modals/SyncProgressModal";
import { initializeStatusBar } from "@app/sync-ui";
import { logSync } from "@app/logging";
import { getLastSuccessfulSyncDate } from "@features/keep/sync";
import { KeepSidianSettingsTab } from "@ui/settings/KeepSidianSettingsTab";
import { SubscriptionSettingsTab } from "@ui/settings/SubscriptionSettingsTab";
import { registerRibbonAndCommands } from "@app/commands";
import {
	buildPersistedSettings,
	hydrateDriveSecretsFromSecretStorage,
	hydrateSyncTokenFromSecretStorage,
	persistSensitiveSettingsToSecretStorage,
} from "@app/main-secret-storage";
import {
	buildManualSyncPlan,
	openLatestSyncLogFlow,
	runImportNotesFlow,
	runPreparedSyncPlan,
} from "@app/main-sync-flows";

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

interface SyncCenterOpenOptions {
	mode?: SyncMode;
	autoStart?: boolean;
}

export default class KeepSidianPlugin extends Plugin {
	settings: KeepSidianPluginSettings;
	subscriptionService: SubscriptionService;
	statusBarItemEl: HTMLElement | null = null;
	statusTextEl: HTMLSpanElement | null = null;
	progressContainerEl: HTMLDivElement | null = null;
	progressBar: ProgressBarComponent | null = null;
	progressModal: SyncProgressModal | null = null;
	progressNotice: Notice | null = null;
	progressNoticeHideTimeout: ReturnType<typeof setTimeout> | null = null;
	progressBarHideTimeout: ReturnType<typeof setTimeout> | null = null;
	processedNotes = 0;
	totalNotes: number | null = null;
	lastSyncSummary: LastSyncSummary | null = null;
	lastSyncLogPath: string | null = null;
	currentSyncMode: SyncMode | null = null;
	currentSyncPhaseLabel: string | null = null;
	private autoSyncInterval?: ReturnType<typeof setInterval>;
	private isSyncing = false;

	async onload() {
		await this.loadSettings();

		this.subscriptionService = new SubscriptionService(
			() => this.settings.email,
			() => this.settings.subscriptionCache,
			async (cache) => {
				this.settings.subscriptionCache = cache;
				await this.saveSettings();
			}
		);

		registerRibbonAndCommands(this);
		initializeStatusBar(this);
		this.initializeSettings();

		if (this.settings.autoSyncEnabled) {
			this.startAutoSync();
		}
	}

	private initializeSettings() {
		this.addSettingTab(new KeepSidianSettingsTab(this.app, this));
	}

	private ensureCredentials(): boolean {
		const email = this.settings.email?.trim();
		if (!email) {
			new Notice("KeepSidian: please enter your Google account email in the settings before syncing.");
			return false;
		}

		const token = this.settings.token?.trim();
		if (!token) {
			new Notice("KeepSidian: please add your Google Keep token in the settings before syncing.");
			return false;
		}

		return true;
	}

	async loadSettings() {
		const saved = (await this.loadData()) as Partial<KeepSidianPluginSettings> | null;
		this.settings = resolveLoadedSettings(saved);
		const sensitiveSettingsChanged =
			hydrateSyncTokenFromSecretStorage(this) || hydrateDriveSecretsFromSecretStorage(this);
		this.lastSyncSummary = this.settings.lastSyncSummary ?? null;
		this.lastSyncLogPath = this.settings.lastSyncLogPath ?? null;
		if (sensitiveSettingsChanged) {
			await this.saveData(buildPersistedSettings(this));
		}
	}

	async saveSettings() {
		this.settings.lastSyncSummary = this.lastSyncSummary;
		this.settings.lastSyncLogPath = this.lastSyncLogPath ?? null;
		persistSensitiveSettingsToSecretStorage(this);
		await this.saveData(buildPersistedSettings(this));
	}

	isSyncInProgress(): boolean {
		return this.isSyncing;
	}

	openSyncProgressModal() {
		this.openSyncCenter();
	}

	private ensureSyncCenterModal(): SyncProgressModal {
		if (!this.progressModal) {
			this.progressModal = new SyncProgressModal(this.app, {
				buildSyncPlan: async (mode, callbacks, downloadScope) => {
					if (!this.ensureCredentials()) {
						return null;
					}
					return await buildManualSyncPlan(this, mode, callbacks, downloadScope);
				},
				runSyncPlan: async (preparedPlan, callbacks) => {
					if (this.isSyncing) {
						return {};
					}
					if (!this.ensureCredentials()) {
						return {};
					}
					this.isSyncing = true;
					try {
						return await runPreparedSyncPlan(this, preparedPlan, getErrorMessage, () => undefined, callbacks);
					} finally {
						this.isSyncing = false;
					}
				},
				onOpenSyncLog: () => this.openLatestSyncLog(),
				getTwoWayGate: () => ({ allowed: false, reasons: ["This fork is download-only."] }),
				getLastSuccessfulDownloadDate: () => getLastSuccessfulSyncDate(this),
				openTwoWaySettings: () => undefined,
				getCurrentMode: () => this.currentSyncMode,
				getCurrentPhaseLabel: () => this.currentSyncPhaseLabel,
				isSupporterActive: async () =>
					await this.subscriptionService.isSubscriptionActive(),
				renderImportOptions: async (containerEl, isActive) => {
					SubscriptionSettingsTab.displayPremiumFeatures(
						containerEl,
						this,
						isActive
					);
				},
				onClose: () => {
					this.progressModal = null;
				},
			});
		}

		return this.progressModal;
	}

	openSyncCenter(options?: SyncCenterOpenOptions) {
		const mode = options?.mode ?? "import";
		const autoStart = options?.autoStart ?? false;
		const modal = this.ensureSyncCenterModal();
		modal.setSelectedMode(mode);
		if (this.isSyncInProgress()) {
			const total = this.totalNotes ?? undefined;
			modal.setProgress(this.processedNotes, total);
		} else {
			modal.setIdleSummary(this.lastSyncSummary);
		}
		modal.open();
		if (autoStart) {
			void modal.beginReview(mode);
		}
	}

	async openLatestSyncLog() {
		await openLatestSyncLogFlow(this);
	}

	async importNotes(auto = false, options?: NoteImportOptions) {
		if (this.isSyncing) {
			return;
		}

		if (!this.ensureCredentials()) {
			await logSync(this, `${auto ? "Auto" : "Manual"} sync aborted - missing credentials.`);
			return;
		}

		this.isSyncing = true;
		try {
			await runImportNotesFlow(this, auto, getErrorMessage, options);
		} finally {
			this.isSyncing = false;
		}
	}

	async runAutoSyncTick() {
		if (this.isSyncing) {
			return;
		}
		await this.importNotes(true);
	}

	refreshAutoSyncSafeguards() {
		return;
	}

	startAutoSync() {
		this.stopAutoSync();
		const intervalMs = this.settings.autoSyncIntervalHours * 60 * 60 * 1000;
		const runner = async () => {
			await this.runAutoSyncTick();
		};
		const intervalId = setInterval(() => {
			void runner();
		}, intervalMs);
		this.autoSyncInterval = intervalId;
		if (typeof this.registerInterval === "function" && typeof intervalId === "number") {
			this.registerInterval(intervalId);
		}
	}

	stopAutoSync() {
		if (this.autoSyncInterval) {
			clearInterval(this.autoSyncInterval);
			this.autoSyncInterval = undefined;
		}
	}

	private async logSync(message: string) {
		/* moved to app/logging.ts */
	}
}
