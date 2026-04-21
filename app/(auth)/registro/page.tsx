import { RegisterForm } from '@/components/auth/register-form'

export default function Page() {
  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="text-2xl font-semibold mb-6">Crear cuenta</h1>
      <RegisterForm />
      <p className="mt-4 text-sm text-slate-600">
        ¿Ya tienes cuenta?{' '}
        <a href="/login" className="underline">
          Entra
        </a>
        .
      </p>
    </div>
  )
}
