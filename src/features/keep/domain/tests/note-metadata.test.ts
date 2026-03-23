import { normalizeNote } from "../note";

describe("normalizeNote metadata export", () => {
	it("injects Keep metadata including pinned, archived, color, and labels into frontmatter", () => {
		const normalized = normalizeNote({
			title: "Test",
			text: "Body",
			created: "2024-01-01T00:00:00.000Z",
			updated: "2024-01-02T00:00:00.000Z",
			color: "YELLOW",
			pinned: true,
			archived: false,
			labels: ["tagebuch", "ideas"],
			frontmatterDict: {
				GoogleKeepUrl: "https://keep.google.com/#NOTE/abc",
			},
		});

		expect(normalized.frontmatter).toContain("GoogleKeepCreatedDate: 2024-01-01T00:00:00.000Z");
		expect(normalized.frontmatter).toContain("GoogleKeepUpdatedDate: 2024-01-02T00:00:00.000Z");
		expect(normalized.frontmatter).toContain("GoogleKeepColor: YELLOW");
		expect(normalized.frontmatter).toContain("GoogleKeepPinned: true");
		expect(normalized.frontmatter).toContain("GoogleKeepArchived: false");
		expect(normalized.frontmatter).toContain('GoogleKeepLabels: ["tagebuch", "ideas"]');
	});
});
