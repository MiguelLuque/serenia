import { LoginForm } from '@/components/auth/login-form'

export default function Page() {
  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="text-2xl font-semibold mb-6">Entrar</h1>
      <LoginForm />
      <p className="mt-4 text-sm text-slate-600">
        ¿No tienes cuenta?{' '}
        <a href="/registro" className="underline">
          Crea una
        </a>
        .
      </p>
    </div>
  )
}
