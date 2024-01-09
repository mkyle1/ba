import { test, expect, Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://193.197.230.125/egroupware/login.php?cd=10&phpgw_forward=%252Findex.php');
  /* await page.getByPlaceholder('Username').click();
  await page.getByPlaceholder('Username').fill(SYSOP_USER.name);
  await page.getByPlaceholder('Password').click();
  await page.getByPlaceholder('Password').fill(SYSOP_USER.password);
  await page.getByRole('button', { name: 'Login' }).click(); */
});

async function login(page: Page, user) {
  await page.getByPlaceholder('Username').click();
  await page.getByPlaceholder('Username').fill(user.login);
  await page.getByPlaceholder('Password').click();
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: 'Login' }).click();
}

const TEST_USERS = [
  'TestUser1',
  'TestUser2',
  'TestUser3',
];

const SYSOP_USER = {
  login: 'sysop',
  password: 'K8!Dv>p[2TEXGuXg',
}

const TEST_CREATE_USER = {
  login: 'testuser',
  firstname: 'Test',
  lastname: 'User',
  password: 'password',
}

test.describe('Mail', () => {
  test('should login, open mail and open the latest mail', async ({ page }) => {
    await page.locator('#mail_sidebox_header').getByRole('heading', { name: 'Mail' }).click();
    await page.locator('[id="mail-index_nm_0\\[bodypreview\\]"]').click();
  });
});

test.describe('User', () => {
  test('should create a testuser', async ({ page }) => {
    login(page, SYSOP_USER);
    await page.locator('#admin_sidebox_header').getByRole('heading', { name: 'Admin' }).click();
    await page.getByText('User accounts').click();
    const page1Promise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Add' }).click();
    const page1 = await page1Promise;
    await page1.getByRole('row', { name: 'Organisation', exact: true }).getByPlaceholder('Name').click();
    await page1.getByRole('row', { name: 'First name' }).getByLabel('').click();
    await page1.getByRole('row', { name: 'First name' }).getByLabel('').fill(TEST_CREATE_USER.firstname);
    await page1.getByRole('row', { name: 'Last name' }).getByLabel('').click();
    await page1.getByRole('row', { name: 'Last name' }).getByLabel('').fill(TEST_CREATE_USER.lastname);
    await page1.getByRole('button', { name: 'OK' }).click();
    await page1.locator('#addressbook-edit_account_lid').getByLabel('').click();
    await page1.locator('#addressbook-edit_account_lid').getByLabel('').fill(TEST_CREATE_USER.login);
    await page1.getByRole('cell', { name: 'Suggest password' }).getByLabel('', { exact: true }).click();
    await page1.getByRole('cell', { name: 'Suggest password' }).getByLabel('', { exact: true }).fill(TEST_CREATE_USER.password);
    await page1.locator('input[name="account_passwd_2"]').click();
    await page1.locator('input[name="account_passwd_2"]').fill(TEST_CREATE_USER.password);
    await page1.getByRole('button', { name: 'save' }).click();
  });

  test('should login with the testuser', async ({ page }) => {
    login(page, TEST_CREATE_USER);
  });

  test('should delete the testuser', async ({ page }) => {
    login(page, SYSOP_USER);
    await page.locator('#admin_sidebox_header').getByRole('heading', { name: 'Admin' }).click();
    await page.getByText('User accounts').click();
    /*  */
    await page.locator(`tr:has(td.gridCont_7_td_col_0:has-text("${TEST_CREATE_USER.login}"))`).click({
      button: 'right'
    });
    await page.click('.sub_item_text:text("Delete")');
    const page1Promise = page.waitForEvent('popup');
    await page.getByRole('cell', { name: 'testuser', exact: true }).click();
    const page1 = await page1Promise;
    await page1.getByRole('button', { name: 'Delete' }).click();
  });
});

const TEST_APPOINTMENT = {
  title: 'Test Appointment',
  description: 'Test Appointment Description',
  location: 'Test Appointment Location',
  start: '2024-01-15 12:00',
  duration: '1:00',
  repeat_type: 'weekly',
  end_date: '2024-02-15',
}

test.describe('Calendar', () => {
  test('should create a simple appointment', async ({ page }) => {
    await page.locator('#calendar_sidebox_header').getByRole('heading', { name: 'Calendar' }).click();
    await page.locator('#calendar-toolbar_add').getByRole('button').click();
    await page.locator('.dialogHeader > td:nth-child(2)').click();
    await page.getByPlaceholder('Title').fill(TEST_APPOINTMENT.title);
    await page.waitForTimeout(1000);
    await page.locator('input[type="text"].input__control').last().focus();
    await page.locator('input[type="text"].input__control').last().click();
    await page.locator('input[type="text"].input__control').last().fill(TEST_APPOINTMENT.start);
    
    /* await page.getByRole('cell', { name: '↑ ↓' }).getByRole('textbox').click();
    await page.locator('div:nth-child(12) > .flatpickr-months > .flatpickr-month').click(); */
    /* await page.getByRole('cell', { name: '↑ ↓' }).getByRole('textbox').click();
    await page.getByRole('cell', { name: '↑ ↓' }).getByRole('textbox').fill(TEST_APPOINTMENT.start); */
    /* await page.locator('.input__control:not(.flatpickr-input)').first();
    await page.locator('.input__control').last().fill(TEST_APPOINTMENT.start); */
    // await page.type('.input__control:not(.flatpickr-input)', TEST_APPOINTMENT.start);
    await page.getByRole('row', { name: 'Start Duration' }).getByRole('combobox').click();
    await page.getByRole('option', { name: TEST_APPOINTMENT.duration }).locator('slot').nth(1).click();
    await page.getByRole('button', { name: 'Save' }).click();
  });
});


