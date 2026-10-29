const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const runtimeErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", error => runtimeErrors.push(error.message));
virtualConsole.on("error", message => runtimeErrors.push(String(message)));

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  url: "https://archive-test.invalid/",
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    window.scrollTo = () => {};
  }
});

const { window } = dom;
const doc = window.document;
const content = doc.querySelector("#content");
const click = selector => {
  const element = doc.querySelector(selector);
  assert.ok(element, `Missing interactive element: ${selector}`);
  element.click();
  return element;
};

// Initial render must produce useful content rather than a blank panel.
assert.ok(content.textContent.trim().length > 100, "Initial page content did not render");
assert.ok(content.textContent.includes("世界持续运转"), "Overview hero did not render");

// Map hierarchy buttons must change the visible node set.
click('.nav button[data-page="world"]');
click('#content [data-layer="世界"]');
assert.equal(doc.querySelectorAll("#content [data-location]").length, 3, "World layer should show 3 example nodes");
click('#content [data-layer="小区域"]');
assert.equal(doc.querySelectorAll("#content [data-location]").length, 6, "Small-area layer should show all 6 example nodes");

// Global search must find a location and navigate to its detail page.
const search = doc.querySelector("#search");
assert.ok(search, "Global search input is missing");
search.value = "仓储片区";
search.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
assert.ok(content.textContent.includes("仓储片区"), "Global search did not return the warehouse location");
click('#content [data-hit="0"]');
assert.equal(doc.querySelector("#crumb").textContent, "世界地图", "Location search result did not open the map page");
assert.ok(content.textContent.includes("仓储片区"), "Selected location detail was not shown");

// Timeline filtering must leave only matching events.
click('.nav button[data-page="timeline"]');
const filter = doc.querySelector("#timeline-filter");
assert.ok(filter, "Timeline filter input is missing");
filter.value = "无线电中断";
filter.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal(doc.querySelectorAll("#event-rows .event").length, 1, "Timeline filter should return one matching event");
assert.ok(content.textContent.includes("无线电中断"), "Filtered event title is missing");

// Scenario selection must update the displayed scenario.
click('.nav button[data-page="scenarios"]');
click('#content [data-case="命令延迟"]');
assert.ok(content.textContent.includes("玩家已经提交了新命令"), "Scenario details did not update");

assert.deepEqual(runtimeErrors, [], `Runtime errors detected: ${runtimeErrors.join(" | ")}`);
dom.window.close();
process.stdout.write("PASS: initial render, map layers, global search, timeline filter, scenario selection.\n");
