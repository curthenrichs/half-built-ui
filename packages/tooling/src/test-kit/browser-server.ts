/* One preview server and one headless Chrome for a consumer's browser
   suites. Adapted from a single-repo test helper (step 11.3 task 5):
   that helper imported its Chrome finder from a sibling script, which
   existed because that repo keeps a repo-wide scripts/ directory shared
   by more than one tool. The tooling package has no such directory of
   its own to point at, so findChrome is inlined below instead of adding
   a sixth file outside the brief's five; its CHROME_CANDIDATES search
   order carried over from that helper, with the macOS paths added
   afterward for consumers off Windows and Linux CI. Everything else
   here is the original: one definition of spawn, wait, launch, and
   kill, so a consumer's suites do not each carry their own drifted
   copy. */
import { existsSync } from "node:fs";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import type { Browser, Page } from "puppeteer-core";

const CHROME_CANDIDATES = [
  /* CHROME_PATH wins when set, for environments this list cannot know. */
  process.env.CHROME_PATH ?? "",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA ?? ""}/Google/Chrome/Application/chrome.exe`,
  /* ubuntu-latest CI runners ship Chrome here. */
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  /* macOS */
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

/** Absolute path to a local Chrome; throws naming every path checked. */
export function findChrome(): string {
  const chrome = CHROME_CANDIDATES.find((p) => p && existsSync(p));

  if (chrome == null || chrome === "") {
    throw new Error(
      `Chrome not found; checked: ${CHROME_CANDIDATES.filter(Boolean).join(", ")}`,
    );
  }

  return chrome;
}

async function answers(url: string): Promise<boolean> {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(
  url: string,
  proc: ChildProcess,
  tries = 60,
): Promise<void> {
  for (let i = 0; i < tries; i++) {
    if (proc.exitCode != null) {
      throw new Error(
        `preview server exited with code ${proc.exitCode} (see stderr above)`,
      );
    }

    let res: Response | undefined;

    try {
      res = await fetch(url);
    } catch {
      /* not up yet */
    }

    if (res?.status === 404) {
      /* The server is up but the page is not where the suite thinks:
         fail now and name the likely cause instead of timing out. */
      throw new Error(
        `server is up but ${url} is 404; did the route or slug change?`,
      );
    }

    if (res?.ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`preview server never answered at ${url}`);
}

/* Serves dist on `port` and resolves once `readyPath` answers 200.
   The port must be OURS: a stale preview (a suite's own leak, or some
   other tooling session) would answer the wait and the tests would
   validate a server this run does not control. Chrome is located
   before the spawn so a machine without one fails before it has a
   server to clean up. */
export async function startPreview(
  port: number,
  readyPath: string,
): Promise<ChildProcess> {
  findChrome();
  const origin = `http://localhost:${port}`;

  if (await answers(`${origin}/`)) {
    throw new Error(
      `something already serves ${origin}; kill it before running the browser suites`,
    );
  }

  /* stderr inherited so a failed spawn (missing dist, bad flag) is
     loud instead of a silent 30 s timeout. detached on POSIX so the
     shell wrapper gets its own process group we can kill whole. */
  const server = spawn("npx", ["astro", "preview", "--port", String(port)], {
    shell: true,
    stdio: ["ignore", "ignore", "inherit"],
    detached: process.platform !== "win32",
  });

  try {
    await waitForServer(`${origin}${readyPath}`, server);
  } catch (err) {
    /* A server that is up but wrong (404) or slow past the wait is
       still running; the caller never receives it to stop, so stop it
       here or it holds the port for the next run. */
    stopPreview(server);
    throw err;
  }

  return server;
}

/* shell: true wraps the server in a shell; kill the whole tree. Safe
   to call when the spawn itself failed, so no orphan keeps the port. */
export function stopPreview(server: ChildProcess | undefined): void {
  if (server?.pid == null) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    try {
      process.kill(-server.pid, "SIGTERM"); // negative pid: the detached group
    } catch {
      /* already gone */
    }
  }
}

/* CI runners restrict the user namespaces Chrome's sandbox needs; the
   runner is already a throwaway VM. It also has no GPU, so WebGL there
   is SwiftShader on a couple of vCPUs; a canvas- or WebGL-driven
   consumer should account for that fallback path the way a canvas- or
   WebGL-heavy feature must, or a timeout there usually means the
   lighter path stopped engaging, not that the assertion is slow. */
export async function launchChrome(): Promise<Browser> {
  /* puppeteer-core is a peer, not a dependency of this package: a
     consumer who runs the browser suites without installing it hits a
     bare "Cannot find module" from Node, several frames below their
     own test. Naming the fix here only for the module-missing case;
     anything else (a puppeteer-core that fails to load for its own
     reasons) rethrows untouched. */
  let puppeteer: typeof import("puppeteer-core");

  try {
    puppeteer = await import("puppeteer-core");
  } catch (err) {
    if ((err as { code?: string } | null)?.code !== "ERR_MODULE_NOT_FOUND") {
      throw err;
    }

    throw new Error(
      "the test kit's browser helpers need puppeteer-core installed by the consumer (tested with 25.x)",
      { cause: err },
    );
  }

  return puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: [
      /* A desktop pointer, stated at launch. Headless Chrome on a CI
         runner with no input devices reports (hover: none) and
         (pointer: none); anything gated on a hover/pointer media query
         (a hover-triggered tooltip component is one example) then correctly declines
         to mount, which can pass locally and fail on the runner. CDP's
         Emulation.setEmulatedMedia hover/pointer features are ignored
         by Chrome (probed both directions), so the only lever is
         Blink's own settings: hover type 2 = hover, pointer type 4 =
         fine. Launching with the "none" values (1) reproduces the
         runner failure exactly on a laptop. Touch emulation from
         setViewport({ hasTouch }) still flips these per page, so
         phonePage below keeps proving the no-hover path. */
      "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
      ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
    ],
  });
}

/* A desktop-class page. The pointer itself is a launch setting (see
   launchChrome); this is the viewport, and the one place desktop pages
   are opened so a consumer's suites cannot drift. */
export async function desktopPage(
  browser: Browser,
  width = 1280,
  height = 900,
): Promise<Page> {
  const p = await browser.newPage();
  await p.setViewport({ width, height });
  return p;
}

/* A phone-class page: iPhone width and touch. hasTouch is what flips
   (hover: none) and (pointer: coarse) on, per page, over the launch
   setting; it is the reason a touch test proves the no-hover path. */
export async function phonePage(
  browser: Browser,
  width = 390,
  height = 664,
): Promise<Page> {
  const p = await browser.newPage();

  await p.setViewport({
    width,
    height,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  return p;
}
