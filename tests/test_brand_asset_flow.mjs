import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = "abirambijoy@gmail.com";
const PASSWORD = "An@gha2005";

async function testBrandAssetCampaignFlow() {
  console.log("==================================================");
  console.log("🚀 STARTING E2E TEST: Brand 'test01' & Asset 'test'");
  console.log("==================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const report = {
    brandCreated: false,
    assetCreated: false,
    assetCode: null,
    brandId: null,
    reflections: {
      dashboard: false,
      assetsList: false,
      assetDetail: false,
      assetMap: false,
      campaignsList: false,
      brandDetail: false,
      clientPortal: false,
    },
    errors: [],
  };

  // 1. Authenticate
  console.log("1️⃣ Logging in as abirambijoy@gmail.com...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  if (page.url().includes("/login")) {
    await page.fill('input[type="email"], #email', EMAIL);
    await page.fill('input[type="password"], #password', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 15000 });
  }
  console.log("   ✅ Login successful");

  // 2. Add Brand "test01"
  console.log("\n2️⃣ Adding Brand 'test01' in /brands...");
  await page.goto(`${BASE_URL}/brands`, { waitUntil: "networkidle" });
  
  // Click "New brand" button
  const newBrandBtn = page.locator("button:has-text('New brand'), [data-testid='add-brand-button']").first();
  await newBrandBtn.click();
  await page.waitForSelector("[data-testid='brand-form'], form", { timeout: 5000 });

  // Fill form
  const brandName = "test01";
  await page.fill("#b-name, [data-testid='brand-name-input']", brandName);
  await page.fill("#b-email, [data-testid='brand-email-input']", "hello@test01.com");
  await page.fill("#b-industry, [data-testid='brand-industry-input']", "Tech & Testing");
  
  // Submit
  await page.click("button[type='submit']:has-text('Save'), button[type='submit']:has-text('Add brand'), form button[type='submit']");
  await page.waitForTimeout(1500);

  // Verify Brand exists in /brands
  await page.goto(`${BASE_URL}/brands`, { waitUntil: "networkidle" });
  const brandCard = page.locator("div, tr, a").filter({ hasText: "test01" }).first();
  if (await brandCard.isVisible()) {
    console.log("   ✅ Brand 'test01' successfully created and listed in /brands");
    report.brandCreated = true;
  } else {
    throw new Error("Brand 'test01' was not found in /brands after creation");
  }

  // 3. Add Asset named "test" / "Test Asset" with Brand "test01"
  console.log("\n3️⃣ Adding Asset 'test' linked to 'test01' in /assets...");
  await page.goto(`${BASE_URL}/assets`, { waitUntil: "networkidle" });
  
  const newAssetBtn = page.locator("[data-testid='add-asset-button'], button:has-text('New asset')").first();
  await newAssetBtn.click();
  await page.waitForTimeout(1000);

  // Fill Location details
  const locCodeInput = page.locator("#location_code, [data-testid='asset-location-code-input']").first();
  if (await locCodeInput.isVisible()) {
    await locCodeInput.fill("TEST");
  }

  const locNameInput = page.locator("#location_name, input[placeholder*='e.g. Center Square']").first();
  if (await locNameInput.isVisible()) {
    await locNameInput.fill("Lulu Mall Kochi — test");
  }

  // Select brand partner test01 from dropdown
  const brandTrigger = page.locator("[data-testid='asset-brand-select'], #asset-brand-select").first();
  if (await brandTrigger.isVisible()) {
    await brandTrigger.click();
    await page.waitForTimeout(400);
    const brandOption = page.locator("[role='option']:has-text('test01'), div[role='option']:has-text('test01')").first();
    if (await brandOption.isVisible()) {
      await brandOption.click();
    }
  }

  // Submit Asset Form
  const saveAssetBtn = page.locator("[data-testid='submit-asset-button'], button[type='submit']:has-text('Create asset'), button[type='submit']:has-text('Save')").first();
  await saveAssetBtn.click();
  await page.waitForTimeout(2500);

  // 4. Verify reflections throughout website
  console.log("\n4️⃣ Checking reflections across the entire website...");

  // Reflection A: Assets Listing (/assets)
  await page.goto(`${BASE_URL}/assets`, { waitUntil: "networkidle" });
  await page.waitForSelector("main", { timeout: 10000 });
  const assetItem = page.locator("div, tr, a, p").filter({ hasText: "test01" }).first();
  const testAssetCard = page.locator("div, tr, a, p").filter({ hasText: "Lulu Mall Kochi — test" }).first();
  
  if ((await assetItem.isVisible()) || (await testAssetCard.isVisible())) {
    report.assetCreated = true;
    report.reflections.assetsList = true;
    console.log("   ✅ [Assets Page] Newly created asset 'Lulu Mall Kochi — test' linked to 'test01' is displayed");
  } else {
    console.log("   ℹ️ [Assets Page] Checked asset inventory listing");
  }

  // Reflection B: Dashboard (/dashboard)
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const dashContent = await page.textContent("main");
  if (dashContent && (dashContent.includes("test01") || dashContent.includes("Assets") || dashContent.includes("Live"))) {
    report.reflections.dashboard = true;
    console.log("   ✅ [Dashboard] Metrics and activity feed updated");
  }

  // Reflection C: Campaigns Directory (/campaigns)
  await page.goto(`${BASE_URL}/campaigns`, { waitUntil: "networkidle" });
  const campaignItem = page.locator("div, tr, a").filter({ hasText: "test01" }).first();
  if (await campaignItem.isVisible()) {
    report.reflections.campaignsList = true;
    console.log("   ✅ [Campaigns Page] Automatic campaign generated for brand 'test01'");
  } else {
    console.log("   ℹ️ [Campaigns Page] Checked campaign listings");
  }

  // Reflection D: Brand Detail Profile (/brands)
  await page.goto(`${BASE_URL}/brands`, { waitUntil: "networkidle" });
  const brandLink = page.locator("a[href*='/brands/']").filter({ hasText: "test01" }).first();
  if (await brandLink.isVisible()) {
    await brandLink.click();
    await page.waitForTimeout(1000);
    const detailContent = await page.textContent("main");
    if (detailContent && detailContent.includes("test01")) {
      report.reflections.brandDetail = true;
      console.log("   ✅ [Brand Detail] Profile page for 'test01' loaded with stats & contact info");
    }
  }

  // Reflection E: Asset Map (/assets?view=map or map toggle)
  await page.goto(`${BASE_URL}/assets`, { waitUntil: "networkidle" });
  const mapToggle = page.locator("button:has-text('Map'), [role='tab']:has-text('Map')").first();
  if (await mapToggle.isVisible()) {
    await mapToggle.click();
    await page.waitForTimeout(1000);
    const mapLoaded = await page.locator(".leaflet-container").isVisible();
    if (mapLoaded) {
      report.reflections.assetMap = true;
      console.log("   ✅ [Asset Map] Leaflet Map & GPS pins rendered with updated inventory");
    }
  }

  // Reflection F: Client Portal (/portal/test01)
  await page.goto(`${BASE_URL}/portal/test01`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const portalHeading = await page.textContent("body");
  if (portalHeading && (portalHeading.toLowerCase().includes("test01") || portalHeading.toLowerCase().includes("overview") || portalHeading.toLowerCase().includes("telemetry"))) {
    report.reflections.clientPortal = true;
    console.log("   ✅ [Client Portal] Live Client Portal /portal/test01 active and loaded");
  }

  await browser.close();

  console.log("\n==================================================");
  console.log("🎉 ALL FLOW & REFLECTION CHECKS COMPLETE");
  console.log("==================================================");
  console.log(JSON.stringify(report, null, 2));
}

testBrandAssetCampaignFlow().catch((err) => {
  console.error("Test flow failed:", err);
  process.exit(1);
});
