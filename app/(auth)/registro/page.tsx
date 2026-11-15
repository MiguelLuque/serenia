import { RegisterForm } from '@/components/auth/register-form'
import { isPublicRegistrationEnabled } from '@/lib/shared/auth/registration-policy'

export default function Page() {
  if (!isPublicRegistrationEnabled()) {
    return (
      <div className="mx-auto max-w-md py-16">
        <h1 className="mb-4 text-2xl font-semibold">Registro cerrado</h1>
        <p className="text-slate-600">
          El registro de nuevas cuentas no está disponible en este piloto. Si ya tienes acceso,
          puedes iniciar sesión.
        </p>
        <a href="/login" className="mt-6 inline-block underline">
          Ir a iniciar sesión
        </a>
      </div>
    )
  }

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
