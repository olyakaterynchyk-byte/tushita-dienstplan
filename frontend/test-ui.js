const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  // Wait for login form
  await page.waitForSelector('#email');
  await page.fill('#email', 'office@tushita.eu');
  await page.fill('#password', 'LiebeMark0107!');
  await page.click('#login-btn');
  // Wait for app
  await page.waitForSelector('#nav-tabs');
  // Click employees
  await page.click('[data-view="employees"]');
  // Click add employee
  await page.click('#add-employee-btn-2');
  await page.waitForSelector('#emp-email');
  await page.fill('#emp-firstname', 'Delete');
  await page.fill('#emp-lastname', 'Test');
  await page.fill('#emp-email', 'deltest@tushita.eu');
  await page.click('.btn-primary:has-text("Speichern")');
  
  // Wait for toast and close modal
  await page.waitForTimeout(1500);
  
  // Try to click the employee card
  const emps = await page.$$('.employee-card');
  for (const e of emps) {
    const text = await e.innerText();
    if (text.includes('Delete Test')) {
      await e.click();
      break;
    }
  }
  
  // Wait for profile
  await page.waitForSelector('.profile-view');
  
  // Click delete
  page.on('dialog', async dialog => {
    console.log('DIALOG APPEARED:', dialog.message());
    await dialog.accept();
  });
  
  console.log('Clicking delete button...');
  await page.click('.action-circle.red[title="Löschen"]');
  
  await page.waitForTimeout(2000);
  
  // Check for toasts
  const toast = await page.evaluate(() => document.getElementById('toast').innerText);
  console.log('Toast after delete:', toast);
  
  await browser.close();
})();
