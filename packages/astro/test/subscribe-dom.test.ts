// @vitest-environment jsdom
/* DOM tests for the subscribe form script: the local email gate, the
   fetch to Buttondown's embed endpoint, and the status line for each
   outcome. fetch is mocked; nothing here touches the network. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mountSubscribe, MSG, formMessages } from "../src/scripts/subscribe";
import type { SubscribeOptions } from "../src/scripts/subscribe";

const ACTION =
  "https://buttondown.com/api/emails/embed-subscribe/half-built-robots";

function mount(
  options?: SubscribeOptions,
  dataMessages?: string,
): {
  form: HTMLFormElement;
  input: HTMLInputElement;
  button: HTMLButtonElement;
  status: HTMLElement;
} {
  const attr =
    dataMessages === undefined
      ? ""
      : ` data-messages='${dataMessages.replace(/'/g, "&#39;")}'`;

  document.body.innerHTML = `
    <section class="subscribe subscribe-post">
      <form class="subscribe-form field-join" method="post" action="${ACTION}" novalidate${attr}>
        <input type="hidden" name="embed" value="1" />
        <input class="subscribe-email field-join-input" type="email" name="email" required />
        <button class="subscribe-submit field-join-button" type="submit">Subscribe</button>
      </form>
      <p class="subscribe-status" role="status"></p>
    </section>`;

  mountSubscribe(document, options);
  return {
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    form: document.querySelector(".subscribe-form") as HTMLFormElement,
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    input: document.querySelector(".subscribe-email") as HTMLInputElement,
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    button: document.querySelector(".subscribe-submit") as HTMLButtonElement,
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    status: document.querySelector(".subscribe-status") as HTMLElement,
  };
}

function submit(form: HTMLFormElement): void {
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

describe("subscribe form (DOM runtime)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("a malformed address writes the error line and never posts", () => {
    const { form, input, status } = mount();
    input.value = "not-an-email";
    submit(form);
    expect(status.textContent).toBe(MSG.invalid);
    expect(status.classList.contains("subscribe-status-err")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a good address posts FormData to the form action and reports sent on 200", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      redirected: false,
      status: 200,
      type: "cors",
    });

    const { form, input, status, button } = mount();
    input.value = "  reader@example.com ";
    submit(form);
    /* button is held while the request is in flight, and the pending
       line is written synchronously before the fetch resolves */
    expect(button.disabled).toBe(true);
    expect(status.textContent).toBe(MSG.pending);
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    await vi.waitFor(() => expect(status.textContent).toBe(MSG.sent));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ACTION);
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("email")).toBe("reader@example.com");
    expect((init.body as FormData).get("embed")).toBe("1");
    expect(status.classList.contains("subscribe-status-err")).toBe(false);
    expect(input.value).toBe("");
    expect(button.disabled).toBe(false);
  });

  it("an opaque redirect counts as sent", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      redirected: false,
      status: 0,
      type: "opaqueredirect",
    });

    const { form, input, status, button } = mount();
    input.value = "reader@example.com";
    submit(form);
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    await vi.waitFor(() => expect(status.textContent).toBe(MSG.sent));
    expect(input.value).toBe("");
    expect(button.disabled).toBe(false);
  });

  it("a rejected fetch writes the failure line, keeps the address, and re-enables the button", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { form, input, status, button } = mount();
    input.value = "reader@example.com";
    submit(form);
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    await vi.waitFor(() => expect(status.textContent).toBe(MSG.failed));
    expect(status.classList.contains("subscribe-status-err")).toBe(true);
    expect(input.value).toBe("reader@example.com");
    expect(button.disabled).toBe(false);
  });

  it("a non-OK response falls back to a native submit", async () => {
    const submitSpy = vi
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => undefined);

    fetchMock.mockResolvedValue({
      ok: false,
      redirected: false,
      status: 400,
      type: "cors",
    });

    const { form, input, status } = mount();
    input.value = "reader@example.com";
    submit(form);
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    await vi.waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));
    expect(status.textContent).not.toBe(MSG.failed);
    expect(input.value).toBe("reader@example.com");
  });

  it("the submit event's default is prevented so the page never navigates", () => {
    fetchMock.mockResolvedValue({ ok: true, redirected: false, status: 200 });
    const { form, input } = mount();
    input.value = "reader@example.com";
    const ev = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("mounting twice binds one submit handler, so one submit sends once", async () => {
    const { form, input } = mount();
    mountSubscribe(document);

    fetchMock.mockResolvedValue({
      ok: true,
      redirected: false,
      status: 200,
      type: "cors",
    });

    input.value = "reader@example.com";
    submit(form);
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a messages option overrides the default invalid-address line", () => {
    const { form, input, status } = mount({
      messages: { invalid: "Try a real address, please." },
    });

    input.value = "not-an-email";
    submit(form);
    expect(status.textContent).toBe("Try a real address, please.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("failedAt composes the with-url failure line and rides options.messages", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const { form, input, status } = mount({
      messages: {
        failed: "The line is closed.",
        failedAt: (failed, url) => `${failed} The public window is ${url}.`,
      },
    });

    form.dataset.publicUrl = "example.com/signup";
    input.value = "reader@example.com";
    submit(form);

    await vi.waitFor(() => {
      expect(status.textContent).toBe(
        "The line is closed. The public window is example.com/signup.",
      );
    });
  });

  it("the default failedAt keeps the current joiner", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { form, input, status } = mount();
    form.dataset.publicUrl = "buttondown.com/half-built-robots";
    input.value = "reader@example.com";
    submit(form);

    await vi.waitFor(() => {
      expect(status.textContent).toBe(
        "Couldn't reach the list. Try again in a minute, or sign up at buttondown.com/half-built-robots.",
      );
    });
  });
});

describe("subscribe form messages from data-messages", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("the form's invalid line replaces the default", () => {
    const { form, input, status } = mount(
      undefined,
      JSON.stringify({ invalid: "Form says no." }),
    );

    input.value = "nope";
    submit(form);
    expect(status.textContent).toBe("Form says no.");
  });

  it("the form's sent line replaces the default after a 200", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      redirected: false,
      status: 200,
      type: "cors",
    });

    const { form, input, status } = mount(
      undefined,
      JSON.stringify({ sent: "Form says sent." }),
    );

    input.value = "reader@example.com";
    submit(form);

    await vi.waitFor(() => {
      expect(status.textContent).toBe("Form says sent.");
    });
  });

  it("malformed JSON falls back to the defaults without throwing", () => {
    const { form, input, status } = mount(undefined, "{not json");
    input.value = "nope";
    submit(form);
    expect(status.textContent).toBe(MSG.invalid);
  });

  it("an array, unknown keys, empty and non-string values are ignored", () => {
    const { form, input, status } = mount(
      undefined,
      JSON.stringify({ invalid: 42, bogus: "x", pending: "" }),
    );

    input.value = "nope";
    submit(form);
    expect(status.textContent).toBe(MSG.invalid);

    document.body.innerHTML = "";
    const second = mount(undefined, JSON.stringify(["invalid"]));
    second.input.value = "nope";
    submit(second.form);
    expect(second.status.textContent).toBe(MSG.invalid);
  });

  it("the form's line wins over the mount option, key by key", () => {
    const { form, input, status } = mount(
      { messages: { invalid: "Option line." } },
      JSON.stringify({ invalid: "Form line." }),
    );

    input.value = "nope";
    submit(form);
    expect(status.textContent).toBe("Form line.");
  });
});

describe("formMessages", () => {
  it("returns only the four known keys with non-empty strings", () => {
    const form = document.createElement("form");

    form.dataset.messages = JSON.stringify({
      invalid: "a",
      pending: "b",
      sent: "",
      failed: 3,
      failedAt: "x",
    });

    expect(formMessages(form)).toEqual({ invalid: "a", pending: "b" });
  });

  it("returns {} with no attribute", () => {
    expect(formMessages(document.createElement("form"))).toEqual({});
  });
});
