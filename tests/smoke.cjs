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
assert.equal(content.dataset.appReady, "true", "Initial render did not finish. Runtime errors: "+runtimeErrors.join(" | ")+"; visible content: "+content.textContent.slice(0,700));
assert.ok(content.textContent.trim().length > 100, "Initial page content did not render");
assert.ok(content.textContent.includes("世界持续运转"), "Overview hero did not render. Runtime errors: "+runtimeErrors.join(" | ")+"; visible content: "+content.textContent.slice(0,700));

// Map hierarchy buttons must change the visible node set.
click('.nav button[data-page="world"]');
click('#content [data-layer="世界"]');
assert.equal(doc.querySelectorAll("#content [data-location]").length, 3, "World layer should show 3 example nodes");
click('#content [data-layer="小区域"]');
assert.equal(doc.querySelectorAll("#content [data-location]").length, 6, "Small-area layer should show all 6 example nodes");

// Departure preparation is a design draft, not an implemented game feature.
click('.nav button[data-page="departure"]');
assert.ok(content.textContent.includes("出发准备与装载"), "Departure preparation page did not render");
assert.ok(content.textContent.includes("容量超限必须显式解决"), "Departure validation rules are missing");

// Transport capacity review must separate confirmed direction from unresolved risks.
click('.nav button[data-page="capacity"]');
assert.ok(content.textContent.includes("运输容量设计复盘"), "Capacity review page did not render");
assert.ok(content.textContent.includes("容量守恒还没有闭环"), "Capacity review did not identify the capacity-conservation risk");
assert.ok(content.textContent.includes("配置变更时机已明确暂缓"), "Capacity review did not preserve the deferred decision");
assert.equal(doc.querySelector("#page-status-label").textContent, "方向已确认", "Capacity page status label is wrong");

// Detailed design principles must be expandable, keyboard-semantic, and searchable.
click('.nav button[data-page="principles"]');
assert.equal(doc.querySelectorAll("#principle-list details.principle-detail").length, 13, "Design principles page should contain 13 expandable principles");
assert.ok(content.textContent.includes("为什么需要这条原则"), "Principles page is missing detailed rationale");
assert.ok(content.textContent.includes("未来如何验证"), "Principles page is missing validation guidance");
const firstPrinciple = doc.querySelector("#principle-01");
assert.ok(firstPrinciple && firstPrinciple.querySelector("summary"), "Principle must use a native details/summary disclosure");
assert.equal(firstPrinciple.open, false, "Principles should start collapsed");
firstPrinciple.querySelector("summary").click();
assert.equal(firstPrinciple.open, true, "Clicking a principle summary should expand it");
firstPrinciple.querySelector("summary").click();
assert.equal(firstPrinciple.open, false, "Clicking a principle summary should collapse it");
click('#content [data-principles-toggle="open"]');
assert.equal(Array.from(doc.querySelectorAll("#principle-list details")).every(d => d.open), true, "Expand all should open every principle");
click('#content [data-principles-toggle="close"]');
assert.equal(Array.from(doc.querySelectorAll("#principle-list details")).every(d => !d.open), true, "Collapse all should close every principle");

// Full-text search should navigate to and expand the matching principle.
search.value = "不能静默删掉人员或物资";
search.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
assert.ok(content.textContent.includes("指挥官的自动方案必须可理解、可解释"), "Full-text search did not find the principle detail");
click('#content [data-hit="0"]');
assert.equal(doc.querySelector("#crumb").textContent, "设计原则", "Principle search result did not open the design manual");
assert.equal(doc.querySelector("#principle-09").open, true, "Search result did not expand the matching principle");

// Capacity review must link back to the principles manual.
click('.nav button[data-page="capacity"]');
click('#content button[data-page="principles"]');
assert.equal(doc.querySelector("#crumb").textContent, "设计原则", "Capacity review cross-navigation did not open the design manual");

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

// Global search must route to the capacity review.
search.value = "运输容量";
search.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
assert.ok(content.textContent.includes("运输容量设计复盘"), "Search did not find transport capacity review");
click('#content [data-hit="0"]');
assert.equal(doc.querySelector("#crumb").textContent, "运输容量", "Capacity search result did not open the review page");

// Global search must also route to the new departure draft.
search.value = "出发准备";
search.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
assert.ok(content.textContent.includes("出发准备与装载"), "Search did not find departure preparation");
click('#content [data-hit="0"]');
assert.equal(doc.querySelector("#crumb").textContent, "出发准备", "Departure search result did not open the new page");

// Scenario selection must update the displayed scenario.
click('.nav button[data-page="scenarios"]');
click('#content [data-case="命令延迟"]');
assert.ok(content.textContent.includes("玩家已经提交了新命令"), "Scenario details did not update");

assert.deepEqual(runtimeErrors, [], `Runtime errors detected: ${runtimeErrors.join(" | ")}`);
dom.window.close();
process.stdout.write("PASS: initial render, map layers, global search, timeline filter, scenario selection, departure draft, transport capacity review, expandable principles, full-text principle search and cross-navigation.\n");
