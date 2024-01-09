import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://193.197.230.125/egroupware/login.php?cd=10&phpgw_forward=%252Findex.php');
});