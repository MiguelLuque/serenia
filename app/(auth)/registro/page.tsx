import { RegisterForm } from '@/components/auth/register-form'
import { isPublicRegistrationEnabled } from '@/lib/shared/auth/registration-policy'

export default function Page() {
  if (!isPublicRegistrationEnabled()) {
    return (
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Piloto privado</p>
        <h1 className="landing-serif mt-2 text-[2.75rem] leading-[1.05] text-stone-900">Registro cerrado</h1>
        <p className="mt-4 leading-relaxed text-stone-600">
          El registro de nuevas cuentas no está disponible en este piloto. Si ya tienes acceso,
          puedes iniciar sesión.
        </p>
        <a
          href="/login"
          className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-teal-700 font-medium text-white shadow-lg shadow-teal-900/15 transition-colors hover:bg-teal-800"
        >
          Ir a iniciar sesión
        </a>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Empieza aquí</p>
      <h1 className="landing-serif mt-2 text-[2.75rem] leading-[1.05] text-stone-900">Crear cuenta</h1>
      <p className="mt-3 text-stone-600">Para personas de 18 años o más.</p>
      <div className="mt-8">
        <RegisterForm />
      </div>
      <p className="mt-6 text-center text-sm text-stone-600">
        ¿Ya tienes cuenta?{' '}
        <a href="/login" className="font-medium text-teal-800 underline underline-offset-2">
          Entra
        </a>
        .
      </p>
    </div>
  )
}
