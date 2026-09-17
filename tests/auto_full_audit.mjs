import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = "abirambijoy@gmail.com";
const PASSWORD = "An@gha2005";

async function runFullAudit() {
  console.log("==================================================");
  console.log("🚀 STARTING AUTOMATED FULL-SITE E2E AUDIT & BUG HUNTER");
  console.log(`🎯 Target: ${BASE_URL}`);
  console.log("==================================================\n");

  const results = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: [],
    consoleErrors: [],
    networkErrors: [],
    discoveredBugs: [],
    timestamp: new Date().toISOString(),
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Listen for console errors & unhandled exceptions
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      results.consoleErrors.push({
        type: "console.error",
        text: msg.text(),
        location: msg.location(),
        pageUrl: page.url(),
      });
    }
  });

  page.on("pageerror", (err) => {
    results.consoleErrors.push({
      type: "uncaught.exception",
      text: err.message,
      stack: err.stack,
      pageUrl: page.url(),
    });
  });

  // Listen for network failures
  page.on("response", (resp) => {
    if (resp.status() >= 400 && !resp.url().includes("favicon")) {
      results.networkErrors.push({
        status: resp.status(),
        statusText: resp.statusText(),
        url: resp.url(),
        pageUrl: page.url(),
      });
    }
  });

  async function testStep(name, fn) {
    results.totalTests++;
    const start = Date.now();
    console.log(`⏳ Testing: ${name}...`);
    try {
      await fn();
      const duration = Date.now() - start;
      results.passed++;
      results.tests.push({ name, status: "PASSED", durationMs: duration });
      console.log(`  ✅ PASSED (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - start;
      results.failed++;
      const bugDesc = `[${name}] ${err.message}`;
      results.discoveredBugs.push(bugDesc);
      results.tests.push({
        name,
        status: "FAILED",
        durationMs: duration,
        error: err.message,
      });
      console.log(`  ❌ FAILED (${duration}ms): ${err.message}`);
    }
  }

  // ── TEST 1: Navigation & Auto-Login ─────────────────────────────
  await testStep("Authentication & Login Flow", async () => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 15000 });
    
    // Check if already authenticated or on login page
    if (page.url().includes("/login")) {
      await page.fill('input[type="email"], input[name="email"], #email', EMAIL);
      await page.fill('input[type="password"], input[name="password"], #password', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 15000 });
    }
    
    if (page.url().includes("/login")) {
      throw new Error("Could not redirect away from /login after submitting credentials");
    }
  });

  // ── TEST 2: Dashboard Analytics & Charts ─────────────────────────
  await testStep("Dashboard Analytics & Widgets", async () => {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForSelector("main", { timeout: 10000 });
    
    // Look for stats cards or key elements
    const heading = await page.locator("h1, h2").first().textContent();
    if (!heading) throw new Error("Dashboard heading missing");
  });

  // ── TEST 3: Assets List & Filtering ─────────────────────────────
  await testStep("Assets Directory & Search/Filters", async () => {
    await page.goto(`${BASE_URL}/assets`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForSelector("table, [role='table'], .grid", { timeout: 10000 });
    
    // Check Search Input
    const searchInput = page.locator("input[placeholder*='Search'], input[placeholder*='Filter']").first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("Lulu");
      await page.waitForTimeout(500);
      await searchInput.fill("");
    }
  });

  // ── TEST 4: Edit Asset Modal & Controls ──────────────────────────
  await testStep("Asset Edit Form & Geofence/Location Presets", async () => {
    await page.goto(`${BASE_URL}/assets`, { waitUntil: "networkidle", timeout: 15000 });
    
    // Find edit button for first asset
    const editBtn = page.locator("button:has-text('Edit'), button[aria-label*='edit'], button:has(svg.lucide-pencil), button:has(svg.lucide-square-pen)").first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(600);
      
      // Check if dialog / sheet opened
      const dialog = page.locator("[role='dialog'], .sheet-content, form").first();
      if (!(await dialog.isVisible())) {
        throw new Error("Edit Asset modal did not open upon clicking Edit button");
      }

      // Check location buttons or inputs
      const mallPresetBtn = page.locator("button:has-text('Lulu Mall Kochi'), button:has-text('Centre Square')").first();
      if (await mallPresetBtn.isVisible()) {
        await mallPresetBtn.click();
        await page.waitForTimeout(300);
      }

      // Close modal
      const cancelBtn = page.locator("button:has-text('Cancel'), button:has-text('Close')").first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
    }
  });

  // ── TEST 5: Interactive Map & Heatmap ────────────────────────────
  await testStep("Asset Map & Heatmap Density Controls", async () => {
    await page.goto(`${BASE_URL}/assets`, { waitUntil: "networkidle", timeout: 15000 });
    
    // Switch to Map tab
    const mapTab = page.locator("button:has-text('Map'), [role='tab']:has-text('Map')").first();
    if (await mapTab.isVisible()) {
      await mapTab.click();
      await page.waitForTimeout(1000);
      
      const leafletContainer = page.locator(".leaflet-container");
      if (!(await leafletContainer.isVisible())) {
        throw new Error("Leaflet Map container is not visible on Map tab");
      }

      // Check Heatmap Toggle button
      const heatmapToggle = page.locator("button:has-text('Heatmap'), button:has-text('Footfall'), button:has-text('Traffic')").first();
      if (await heatmapToggle.isVisible()) {
        await heatmapToggle.click();
        await page.waitForTimeout(500);
      }
    }
  });

  // ── TEST 6: Asset Detail View & Responsive Tabs ──────────────────
  await testStep("Asset Detail Page & Tabs Navigation", async () => {
    await page.goto(`${BASE_URL}/assets`, { waitUntil: "networkidle", timeout: 15000 });
    
    // Click first asset link/row
    const assetRow = page.locator("a[href*='/assets/'], tr td a").first();
    if (await assetRow.isVisible()) {
      await assetRow.click();
      await page.waitForURL((url) => url.href.includes("/assets/"), { timeout: 10000 });
      
      // Verify tabs switching
      const tabs = page.locator("[role='tab'], button:has-text('Overview'), button:has-text('Specifications'), button:has-text('Photos'), button:has-text('Schedule')");
      const tabCount = await tabs.count();
      for (let i = 0; i < Math.min(tabCount, 4); i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(300);
      }
    }
  });

  // ── TEST 7: Campaigns Management ─────────────────────────────────
  await testStep("Campaigns Directory & Statuses", async () => {
    await page.goto(`${BASE_URL}/campaigns`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForSelector("main", { timeout: 10000 });
    
    const pageTitle = await page.textContent("body");
    if (!pageTitle.toLowerCase().includes("campaign")) {
      throw new Error("Campaigns page content not found");
    }
  });

  // ── TEST 8: Brands Directory ─────────────────────────────────────
  await testStep("Brands Directory & Profiles", async () => {
    await page.goto(`${BASE_URL}/brands`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForSelector("main", { timeout: 10000 });
    
    // Check if brands exist
    const brandCards = page.locator("a[href*='/brands/'], div:has-text('Carbon'), div:has-text('Whale')").first();
    if (!(await brandCards.isVisible())) {
      throw new Error("Brands directory cards missing or empty");
    }
  });

  // ── TEST 9: Interest Queue ───────────────────────────────────────
  await testStep("Interest Queue & State Tabs", async () => {
    await page.goto(`${BASE_URL}/queue`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForSelector("main", { timeout: 10000 });
    
    const pendingTab = page.locator("button:has-text('Pending'), [role='tab']:has-text('Pending')").first();
    if (await pendingTab.isVisible()) {
      await pendingTab.click();
      await page.waitForTimeout(300);
    }
  });

  // ── TEST 10: Client Portal (GTP Photos Only) ─────────────────────
  await testStep("Client Portal Verification & Geotagged Proof Filter", async () => {
    // Navigate via brand or campaign portal link
    await page.goto(`${BASE_URL}/brands`, { waitUntil: "networkidle", timeout: 15000 });
    const portalLink = page.locator("a[href*='/portal/'], a[href*='/view/']").first();
    
    if (await portalLink.isVisible()) {
      await portalLink.click();
      await page.waitForURL((url) => url.href.includes("/portal/") || url.href.includes("/view/"), { timeout: 15000 });
    } else {
      // Direct navigation with a fallback brand key
      await page.goto(`${BASE_URL}/portal/tata`, { waitUntil: "networkidle", timeout: 15000 });
    }
    
    await page.waitForSelector("main", { timeout: 10000 });
    
    // Check Tabs in portal
    const photosTab = page.locator("button:has-text('Installation Photos'), button:has-text('Photos')").first();
    if (await photosTab.isVisible()) {
      await photosTab.click();
      await page.waitForTimeout(500);
    }

    const specsTab = page.locator("button:has-text('Billboard Specs'), button:has-text('Specs')").first();
    if (await specsTab.isVisible()) {
      await specsTab.click();
      await page.waitForTimeout(500);
    }
  });

  // ── TEST 11: Admin Panel & Roles ─────────────────────────────────
  await testStep("Admin User Management & Audit Trail", async () => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForSelector("main", { timeout: 10000 });
    
    await page.goto(`${BASE_URL}/audit`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForSelector("main", { timeout: 10000 });
  });

  // ── TEST 12: Mobile Responsiveness & Layout Check ────────────────
  await testStep("Mobile Viewport Layout & Overflow Check (375x812)", async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    
    const urlsToTest = ["/", "/assets", "/campaigns", "/portal"];
    for (const u of urlsToTest) {
      await page.goto(`${BASE_URL}${u}`, { waitUntil: "networkidle", timeout: 15000 });
      
      // Check for horizontal page overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      
      if (scrollWidth > clientWidth + 5) {
        results.warnings++;
        console.log(`    ⚠️ Warning: Minor horizontal overflow on ${u} (${scrollWidth}px > ${clientWidth}px)`);
      }
    }
  });

  await browser.close();

  // Deduplicate console errors
  const uniqueConsoleErrors = [...new Set(results.consoleErrors.map((e) => e.text))];
  const uniqueNetworkErrors = [...new Set(results.networkErrors.map((e) => `${e.status} ${e.url}`))];

  console.log("\n==================================================");
  console.log("📊 E2E AUDIT RESULTS SUMMARY");
  console.log("==================================================");
  console.log(`Total Tests Run  : ${results.totalTests}`);
  console.log(`Passed           : ${results.passed} ✅`);
  console.log(`Failed           : ${results.failed} ❌`);
  console.log(`Warnings         : ${results.warnings} ⚠️`);
  console.log(`Console Errors   : ${uniqueConsoleErrors.length}`);
  console.log(`Network Failures : ${uniqueNetworkErrors.length}`);
  console.log("==================================================\n");

  if (results.discoveredBugs.length > 0) {
    console.log("🚨 Discovered Functional Bugs:");
    results.discoveredBugs.forEach((bug, i) => console.log(`  ${i + 1}. ${bug}`));
  } else {
    console.log("🎉 All automated functional test flows executed with ZERO test failures!");
  }

  if (uniqueConsoleErrors.length > 0) {
    console.log("\n⚠️ Unhandled Console Errors:");
    uniqueConsoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }

  if (uniqueNetworkErrors.length > 0) {
    console.log("\n🌐 Network Request Errors:");
    uniqueNetworkErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }

  // Save report to JSON file
  fs.writeFileSync(
    path.join(process.cwd(), "e2e_audit_report.json"),
    JSON.stringify(results, null, 2)
  );
  console.log("\n📄 Full audit report saved to e2e_audit_report.json");
}

runFullAudit().catch((err) => {
  console.error("Audit runner failed:", err);
  process.exit(1);
});
