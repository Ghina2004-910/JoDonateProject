jest.mock("expo-image-picker", () => ({}));
jest.mock("react-native", () => ({ Alert: { alert: jest.fn() } }));

import { MAX_IMAGE_BYTES, validatePickerAsset } from "../lib/image-upload";

describe("validatePickerAsset", () => {
  it("accepts valid assets", () => {
    expect(
      validatePickerAsset({
        uri: "file://photo.jpg",
        width: 800,
        height: 600,
        fileSize: 1024,
      } as never),
    ).toBeNull();
  });

  it("rejects oversized files", () => {
    expect(
      validatePickerAsset({
        uri: "file://large.jpg",
        width: 800,
        height: 600,
        fileSize: MAX_IMAGE_BYTES + 1,
      } as never),
    ).toMatch(/under/i);
  });

  it("rejects oversized dimensions", () => {
    expect(
      validatePickerAsset({
        uri: "file://wide.jpg",
        width: 12000,
        height: 600,
      } as never),
    ).toMatch(/dimensions/i);
  });
});
