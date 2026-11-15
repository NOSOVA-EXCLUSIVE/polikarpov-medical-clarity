const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(relativePath, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    URL,
    exports,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected import: ${name}`);
      return dependencies[name];
    },
    ...globals
  });
  return exports;
}

const siteOrigin = "https://www.polikarpovclarity.com";
const services = load("src/features/products/services-v21.ts", {});
const routes = load("src/lib/public-site-routes.ts", {
  "@/features/products/services-v21": services
});
const attribution = load("src/features/questionnaire/intake-source.ts", {
  "@/lib/public-site-routes": routes
});

function browser(url, referrer, storage = new Map(), navigationType = "navigate") {
  const window = {
    location: { href: url },
    performance: { getEntriesByType: () => [{ type: navigationType }] },
    sessionStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value)
    }
  };
  const document = { referrer };
  const capture = load("src/components/public/intake-source-capture.tsx", {
    "next/navigation": { usePathname: () => new URL(window.location.href).pathname },
    react: { useEffect: (run) => run() },
    "@/features/questionnaire/intake-source": attribution
  }, { window, document });
  return { capture, window, document, storage };
}

test("tagged attribution accepts only approved values, with QR reserved for historical records", () => {
  const tagged = new URL(`${siteOrigin}/doctor?utm_source=Telegram&utm_campaign=website-launch&utm_content=Link-26&token=example`);
  assert.deepEqual(structuredClone(attribution.readTaggedIntakeSource(tagged)), {
    channel: "telegram", campaign: "website-launch", linkTag: "link-26"
  });
  tagged.searchParams.set("utm_content", "case-1234");
  tagged.searchParams.set("utm_campaign", "qr-card");
  assert.deepEqual(structuredClone(attribution.readTaggedIntakeSource(tagged)), {
    channel: "telegram", campaign: null
  });
  tagged.searchParams.set("utm_source", "qr");
  assert.equal(attribution.readTaggedIntakeSource(tagged), null);
  assert.equal(attribution.parseIntakeChannel("qr"), "qr");
  assert.equal(attribution.parseIntakeCampaign("qr-card"), "qr-card");
});

test("source display retains only a public origin or an approved path", () => {
  const { parseIntakeReferrerUrl } = attribution;
  const cases = [
    ["https://www.google.es/search?q=private#hidden", "https://www.google.es/search"],
    ["https://private.google.es/view/token", "https://google.es"],
    ["https://t.me/EvgeniyPolikarpov?start=private", "https://t.me/EvgeniyPolikarpov"],
    ["https://t.me/+private", "https://t.me"],
    ["https://www.example.com/private/record?contact=secret", "https://www.example.com"],
    ["https://www.example.co.uk/private", "https://www.example.co.uk"],
    ["https://secret-token.example.com/private", null],
    ["https://username.github.io/private", null],
    ["https://user:password@example.com/", null],
    ["https://localhost/private", null],
    ["https://10.0.0.1/private", null],
    [`${siteOrigin}/questionnaire?case=private`, null],
    ["https://polikarpov-medical-clarity-test.vercel.app/portal", null]
  ];
  for (const [raw, display] of cases) {
    assert.equal(parseIntakeReferrerUrl(raw), display);
    if (display) assert.equal(parseIntakeReferrerUrl(display), display);
  }
  const external = attribution.readIntakeReferrer("https://secret-token.example.com/private", new URL(siteOrigin));
  assert.equal(external.channel, "referral");
  assert.equal(external.referrerUrl, undefined);
});

test("first page and safe campaign link survive SPA navigation and reload in the same tab", () => {
  const initial = browser(
    `${siteOrigin}/services/second-opinion?utm_source=telegram&utm_content=telegram-post&unwanted=value#secret`,
    "https://t.me/private?key=secret"
  );
  initial.capture.IntakeSourceCapture();
  initial.window.location.href = `${siteOrigin}/questionnaire?service=second-opinion`;
  const headers = {
    "x-pmc-intake-channel": "telegram",
    "x-pmc-intake-landing-page": "/services/second-opinion",
    "x-pmc-intake-referrer-url": "https://t.me",
    "x-pmc-intake-link-tag": "telegram-post"
  };
  assert.deepEqual(structuredClone(initial.capture.getIntakeSourceHeaders()), headers);
  const serialized = [...initial.storage.values()].join("");
  assert.doesNotMatch(serialized, /unwanted|secret|private/);

  const reload = browser(initial.window.location.href, "https://t.me/", initial.storage, "reload");
  assert.deepEqual(structuredClone(reload.capture.getIntakeSourceHeaders()), headers);

  const freshVisit = browser(`${siteOrigin}/doctor`, "", initial.storage);
  assert.deepEqual(structuredClone(freshVisit.capture.getIntakeSourceHeaders()), {
    "x-pmc-intake-landing-page": "/doctor"
  });
});

test("sensitive routes and unsafe stored values are not sent", () => {
  for (const candidate of ["//", "/questionnaire?query=secret", "/admin", "/portal/secret", "/booking/secret", "/payment/success"]) {
    assert.equal(attribution.parseIntakeLandingPage(candidate), null);
  }
  const privateRoute = browser(`${siteOrigin}/booking/secret`, "https://google.com/");
  assert.deepEqual(structuredClone(privateRoute.capture.getIntakeSourceHeaders()), {});
  assert.equal(privateRoute.storage.size, 0);

  const forged = new Map([["pmc-intake-source-v1", JSON.stringify({
    channel: "qr",
    campaign: "qr-card",
    landingPage: "/doctor",
    referrerUrl: "https://private-token.example.com/private",
    linkTag: "secret"
  })]]);
  const reload = browser(`${siteOrigin}/questionnaire`, "", forged, "reload");
  assert.deepEqual(structuredClone(reload.capture.getIntakeSourceHeaders()), {
    "x-pmc-intake-landing-page": "/doctor"
  });
});
