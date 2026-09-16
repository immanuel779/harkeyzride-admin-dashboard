export const queryKeys = {
  drivers: {
    all: ['drivers'] as const,
    list: () => [...queryKeys.drivers.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.drivers.all, 'detail', id] as const,
  },
  riders: {
    all: ['riders'] as const,
    list: () => [...queryKeys.riders.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.riders.all, 'detail', id] as const,
  },
  rides: {
    all: ['rides'] as const,
    list: () => [...queryKeys.rides.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.rides.all, 'detail', id] as const,
  },
  financials: {
    all: ['financials'] as const,
    ledger: () => [...queryKeys.financials.all, 'ledger'] as const,
  },
  sos: {
    all: ['sos'] as const,
    alerts: () => [...queryKeys.sos.all, 'alerts'] as const,
  },
  chat: {
    all: ['chat'] as const,
    messages: (channelId: string) =>
      [...queryKeys.chat.all, 'messages', channelId] as const,
    channels: () => [...queryKeys.chat.all, 'channels'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    overview: () => [...queryKeys.dashboard.all, 'overview'] as const,
  },
}