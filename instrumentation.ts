// Start the configured World through its public lifecycle on each real server.
// Local World recovery preserves persisted run IDs; it remains development-only.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getWorld } = await import('workflow/runtime')
    await getWorld().start?.()
  }
}
