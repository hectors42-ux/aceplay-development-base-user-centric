// TODO: cablear fase 2
export type BookingsProvider = "internal" | "external";

export const useBookingsProvider = () => {
  // TODO: cablear fase 2
  return {
    provider: "internal" as BookingsProvider,
    externalUrl: null as string | null,
    isExternal: false,
    isLoading: false,
  };
};

export const openExternalBooking = (url: string | null) => {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};
