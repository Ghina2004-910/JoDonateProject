import { safeGoBack } from "../lib/navigation";

describe("safeGoBack", () => {
  it("calls back when history exists", () => {
    const back = jest.fn();
    const replace = jest.fn();
    const router = {
      canGoBack: () => true,
      back,
      replace,
    };

    safeGoBack(router as never);

    expect(back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("replaces with fallback when stack is empty", () => {
    const back = jest.fn();
    const replace = jest.fn();
    const router = {
      canGoBack: () => false,
      back,
      replace,
    };

    safeGoBack(router as never, "/profile");

    expect(back).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/profile");
  });
});
