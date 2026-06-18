import type { Page } from "@playwright/test";

export const goMisTorneos = (p: Page) => p.goto("/mis-torneos");
export const goTorneos = (p: Page) => p.goto("/torneos");
export const goTorneoAdmin = (p: Page, id: string) =>
  p.goto(`/torneos/${id}/admin`);
export const goTabla = (p: Page, id: string) => p.goto(`/torneos/${id}/tabla`);
export const goRivales = (p: Page) => p.goto("/rivales");