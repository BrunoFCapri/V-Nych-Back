import { test, expect, type Page, type Route } from '@playwright/test';

// Test del flujo de login del front. El backend se simula con page.route,
// así el test sólo depende de la UI.

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

const USER = { id: '11111111-1111-4111-8111-111111111111', username: 'bruno', email: 'bruno@example.com', is_admin: false };
const ADMIN = { id: '00000000-0000-0000-0000-000000000000', username: 'admin', email: 'admin@local', is_admin: true };

async function fulfill(route: Route, status: number, body: unknown) {
  if (route.request().method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: CORS });
  }
  return route.fulfill({
    status,
    headers: CORS,
    contentType: typeof body === 'string' ? 'text/plain' : 'application/json',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

// Respuesta vacía para todo lo que cargan las pantallas después del login.
async function mockRestOfApi(page: Page) {
  await page.route('**/api/**', (route) => fulfill(route, 200, []));
  await page.route('**/api/status', (route) =>
    fulfill(route, 200, { status: 'Running', database: 'Connected', redis: 'Connected' }));
  await page.route('**/api/admin/overview', (route) =>
    fulfill(route, 200, {
      summary: { users: 0, notes: 0, tasks: 0, events: 0, task_lists: 0, completed_tasks: 0, starred_tasks: 0 },
      task_status_breakdown: [],
      recent_users: [],
      recent_tasks: [],
      recent_notes: [],
      recent_events: [],
    }));
}

async function fillLogin(page: Page, identifier: string, password: string) {
  await page.getByPlaceholder('Usuario o email').fill(identifier);
  await page.getByPlaceholder('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

const storedToken = (page: Page) => page.evaluate(() => localStorage.getItem('token'));

test.beforeEach(async ({ page }) => {
  await mockRestOfApi(page);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Iniciar Sesión' })).toBeVisible();
});

test('login exitoso envía las credenciales, guarda el token y va al inicio', async ({ page }) => {
  let sentBody: unknown;
  await page.route('**/api/auth/login', (route) => {
    if (route.request().method() === 'POST') sentBody = route.request().postDataJSON();
    return fulfill(route, 200, { token: 'jwt-de-prueba', user: USER });
  });

  await fillLogin(page, 'bruno@example.com', 'Secreta123!');

  await expect(page).toHaveURL(/\/$/);
  expect(sentBody).toEqual({ identifier: 'bruno@example.com', password: 'Secreta123!' });
  expect(await storedToken(page)).toBe('jwt-de-prueba');
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('user')))!)).toEqual(USER);
});

test('login de admin redirige al panel de administración', async ({ page }) => {
  await page.route('**/api/auth/login', (route) =>
    fulfill(route, 200, { token: 'jwt-admin', user: ADMIN }));

  await fillLogin(page, 'admin', 'clave-admin');

  await expect(page).toHaveURL(/\/admin$/);
  expect(await storedToken(page)).toBe('jwt-admin');
});

test('credenciales inválidas no inician sesión', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/auth/login', (route) => {
    if (route.request().method() === 'POST') calls++;
    return fulfill(route, 401, 'Invalid email or password');
  });

  await fillLogin(page, 'bruno', 'incorrecta');

  await expect.poll(() => calls).toBe(1);
  await expect(page).toHaveURL(/\/login$/);
  expect(await storedToken(page)).toBeNull();
});

test('no envía la request si faltan campos obligatorios', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/auth/login', (route) => {
    calls++;
    return fulfill(route, 200, { token: 'x', user: USER });
  });

  await page.getByPlaceholder('Usuario o email').fill('bruno');
  await page.getByRole('button', { name: 'Entrar' }).click();

  const passwordMissing = await page.getByPlaceholder('Contraseña')
    .evaluate((input: HTMLInputElement) => input.validity.valueMissing);
  expect(passwordMissing).toBe(true);
  await expect(page).toHaveURL(/\/login$/);
  expect(calls).toBe(0);
});
