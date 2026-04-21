export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-4xl font-semibold text-slate-800">Serenia</h1>
        <p className="mt-3 text-slate-500">Apoyo conversacional para ansiedad y depresión.</p>
      </div>
      <div className="flex gap-3">
        <a className="rounded-full bg-slate-900 px-5 py-2.5 text-white" href="/registro">
          Crear cuenta
        </a>
        <a className="rounded-full border border-slate-300 px-5 py-2.5" href="/login">
          Entrar
        </a>
      </div>
    </main>
  )
}
