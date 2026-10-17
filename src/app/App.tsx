import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'

import { ErrorBoundary } from '../components/shared/ErrorBoundary'
import { BRAND } from '../config/brand'
import { queryClient } from '../lib/queryClient'
import { router } from '../routes'

function App() {
  return (
    <ErrorBoundary
      fallbackTitle={`${BRAND.name} Admin crashed`}
      fallbackMessage="Something went wrong at the app level. Reload to recover — if this keeps happening, contact the dev team."
    >
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '13px',
            },
          }}
        />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App