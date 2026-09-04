/* Subscribe form runtime. The form is a real form (method post, action =
   Buttondown's keyless embed-subscribe endpoint) so it works with no
   JavaScript at all: the browser posts, Buttondown redirects to the
   site's /newsletter/subscribed/ page. With JavaScript, this script takes over the
   submit, posts the same FormData with fetch, and writes the outcome
   into the status line so the reader stays put. There is no server of
   ours in the path and no secret involved.

   Buttondown answers a successful post with a 302 to our own origin,
   carrying Access-Control-Allow-Origin: * on the redirect response itself
   but not on ours, so a followed fetch cannot read it: the browser throws
   TypeError: Failed to fetch even though the signup went through. The
   fetch below asks for redirect: "manual" instead, which turns that 302
   into a clean opaqueredirect result rather than an error. Any other real
   response (Buttondown's captcha interstitial for a suspicious client,
   or an error page) falls back to a native form submit so the reader can
   finish it on Buttondown's own page. Only a thrown fetch (the network
   itself failing) writes the couldn't-reach line. Spec:
   docs/superpowers/specs/2026-08-16-mailing-list-wiring-design.md

   On the island contract (step 9): mount(root, options?) returns a
   destroy handle, and claim() makes a second mount over an already-wired
   form a no-op. */

import { claim, release, type Island, type IslandHandle } from "./core/island";

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MSG = {
  invalid: "That doesn't look like an email address.",
  pending: "Sending...",
  sent: "Check your inbox. Nothing arrives until you click the confirmation link.",
  failed: "Couldn't reach the list. Try again in a minute.",
  /* Composes the failure line when the form names a public sign-up page.
     A function member so an overridden register controls the whole
     sentence, joiner included (step 9.5; the generalization review found
     the joiner was the one baked phrase left in this script). */
  failedAt: (failed: string, url: string): string => `${failed.replace(/\.$/, "")}, or sign up at ${url}.`,
};

/* The provider's public sign-up page rides the form's data-public-url
   (config NEWSLETTER via the component's publicUrl prop), so this script names no provider; without the
   attribute the message stays generic. */
export function failedMessage(form: HTMLFormElement, messages: typeof MSG): string {
  const url = form.dataset.publicUrl;
  return url ? messages.failedAt(messages.failed, url) : messages.failed;
}

function setStatus(status: HTMLElement, text: string, isError: boolean): void {
  status.textContent = text;
  status.classList.toggle("subscribe-status-err", isError);
}

async function send(form: HTMLFormElement, input: HTMLInputElement, button: HTMLButtonElement | null, status: HTMLElement, messages: typeof MSG): Promise<void> {
  if (button) button.disabled = true;
  setStatus(status, messages.pending, false);
  try {
    const res = await fetch(form.action, { method: "POST", body: new FormData(form), redirect: "manual" });
    if (res.ok || res.type === "opaqueredirect") {
      setStatus(status, messages.sent, false);
      input.value = "";
      if (button) button.disabled = false;
    } else {
      /* A real, readable non-OK response: Buttondown's captcha
         interstitial for a suspicious client, or an error page. A fetch
         cannot complete the captcha; hand off to a native submit so the
         reader finishes it on Buttondown's own page, which redirects back
         to /newsletter/subscribed/. The page is navigating away, so the status line
         is left alone and the button stays disabled. */
      form.submit();
    }
  } catch {
    setStatus(status, failedMessage(form, messages), true);
    if (button) button.disabled = false;
  }
}

export interface SubscribeOptions {
  selector?: string;
  messages?: Partial<typeof MSG>;
}

export const mountSubscribe: Island<SubscribeOptions> = (root, options = {}): IslandHandle => {
  const { selector = ".subscribe-form", messages: messagesOverride = {} } = options;
  const messages: typeof MSG = { ...MSG, ...messagesOverride };
  const forms = [...root.querySelectorAll<HTMLFormElement>(selector)].filter((form) => claim(form, "subscribe"));

  const handlers: [HTMLFormElement, (e: Event) => void][] = [];
  for (const form of forms) {
    const onSubmit = (e: Event): void => {
      e.preventDefault();
      const input = form.querySelector(".subscribe-email");
      const button = form.querySelector(".subscribe-submit");
      const status = form.parentElement?.querySelector(".subscribe-status");
      if (!(input instanceof HTMLInputElement) || !(status instanceof HTMLElement)) return;
      const value = input.value.trim();
      input.value = value;
      if (!EMAIL.test(value)) {
        setStatus(status, messages.invalid, true);
        return;
      }
      void send(form, input, button instanceof HTMLButtonElement ? button : null, status, messages);
    };
    form.addEventListener("submit", onSubmit);
    handlers.push([form, onSubmit]);
  }

  return {
    destroy(): void {
      for (const [form, onSubmit] of handlers) {
        form.removeEventListener("submit", onSubmit);
        release(form, "subscribe");
      }
    },
  };
};
