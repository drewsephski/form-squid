import { describe, expect, test } from "@jest/globals";
import { addressAfterDraftSave, addressAfterPublish } from "../slug-address";

describe("published slug", () => {
  test("a draft slug change does not move the live form until publish", () => {
    const published = { slug: "old-name", draftSlug: "old-name" };
    const drafted = addressAfterDraftSave(published, "new-name");

    expect(drafted).toEqual({ slug: "old-name", draftSlug: "new-name" });

    const live = addressAfterPublish(drafted.draftSlug);
    expect(live).toEqual({ slug: "new-name", draftSlug: "new-name" });
  });
});
