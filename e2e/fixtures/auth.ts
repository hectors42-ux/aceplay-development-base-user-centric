import { test as base, type Page } from "@playwright/test";
import { loginAs } from "../helpers/login";
import type { Role } from "./users";

type AsFn = (role: Role) => Promise<Page>;

/**
 * Fixture `as(role)`: abre un context nuevo y devuelve una page logueada.
 * Cada test puede abrir varios roles simultáneamente (e.g. playerA y playerB
 * para validar realtime).
 */
export const test = base.extend<{ as: AsFn }>({
  as: async ({ browser }, use) => {
    const opened: Page[] = [];
    const open: AsFn = async (role) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await loginAs(page, role);
      opened.push(page);
      return page;
    };
    await use(open);
    for (const p of opened) {
      await p.context().close().catch(() => {});
    }
  },
});

export const expect = test.expect;