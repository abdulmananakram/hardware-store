import { dictionary, requiredTranslationKeys } from "../../lib/i18n";

describe("language dictionary", () => {
  test("every registered label has English and Urdu text", () => {
    for (const key of requiredTranslationKeys) {
      expect(dictionary[key].en).toBeTruthy();
      expect(dictionary[key].ur).toBeTruthy();
    }
  });
});
