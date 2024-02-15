import { test, expect, Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://193.197.230.125/egroupware/login.php');
});

async function login(page: Page, user) {
  await page.getByPlaceholder('Username').click();
  await page.getByPlaceholder('Username').fill(user.login);
  await page.getByPlaceholder('Password').click();
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: 'Login' }).click();
}

const SYSOP_USER = {
  login: 'sysop',
  firstname: 'Admin',
  lastname: 'User',
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
    await login(page, SYSOP_USER);
    await page.locator('#mail_sidebox_header').getByRole('heading', { name: 'Mail' }).click();
    await page.locator('[id="mail-index_nm_0\\[bodypreview\\]"]').click();
    await page.context().close();
  });
});

test.describe('User', () => {
  test('should create a testuser', async ({ page }) => {
    await login(page, SYSOP_USER);
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
    await page.context().close();
  });

  test('should login with the testuser', async ({ page }) => {
    await login(page, TEST_CREATE_USER);
    await page.locator('#calendar_sidebox_header').getByRole('heading', { name: 'Calendar' }).click();
    await page.context().close();
  });

  test('should delete the testuser', async ({ page }) => {
    await login(page, SYSOP_USER);
    await page.locator('#admin_sidebox_header').getByRole('heading', { name: 'Admin' }).click();
    await page.getByText('User accounts').click();
    const page1Promise = page.waitForEvent('popup');
    await page.getByRole('cell', { name: 'testuser', exact: true }).click();
    await page.press('body', 'Delete');
    const page1 = await page1Promise;
    await page1.getByRole('button', { name: 'Delete' }).click();
    //logout(page, SYSOP_USER);
    await page.context().close();
  });
});

function formatDateTime(date) {
  let d = new Date(date),
      month = '' + (d.getMonth() + 1), // Months are zero-based
      day = '' + d.getDate(),
      year = d.getFullYear(),
      hours = '' + d.getHours(),
      minutes = '' + d.getMinutes();

  if (month.length < 2) 
      month = '0' + month;
  if (day.length < 2) 
      day = '0' + day;
  if (hours.length < 2)
      hours = '0' + hours;
  if (minutes.length < 2)
      minutes = '0' + minutes;

  return [year, month, day].join('/') + ' ' + [hours, minutes].join(':');
}

test.describe('Calendar', () => {
  test('should create a simple appointment', async ({ page }) => {
    const TEST_APPOINTMENT = {
      title: 'Test Appointment',
      description: 'Test Appointment Description',
      location: 'Test Appointment Location',
      start: formatDateTime(Date.now() + 1800000), // 30 minutes from now
      duration: '1:00',
      repeat_type: 'weekly',
    }
    await login(page, SYSOP_USER);
    await page.locator('#calendar_sidebox_header').getByRole('heading', { name: 'Calendar' }).click();
    await page.locator('#calendar-toolbar_add').getByRole('button').click();
    await page.locator('.dialogHeader > td:nth-child(2)').click();
    await page.getByPlaceholder('Title').fill(TEST_APPOINTMENT.title);
    await page.click('.form-control.hasValue'); // Focus on the element
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type(TEST_APPOINTMENT.start); // Type the date
    /* await page.getByRole('row', { name: 'Start Duration' }).getByRole('cell').nth(4).click(); */
    await page.getByRole('button', { name: 'Save' }).click();
    await page.context().close();
  });
});


export {login, SYSOP_USER, TEST_CREATE_USER}