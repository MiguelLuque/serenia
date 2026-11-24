import { LoginForm } from '@/components/auth/login-form'
import { isPublicRegistrationEnabled } from '@/lib/shared/auth/registration-policy'

export default function Page() {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Hola de nuevo</p>
      <h1 className="landing-serif mt-2 text-[2.75rem] leading-[1.05] text-stone-900">Entrar</h1>
      <p className="mt-3 text-stone-600">Accede a tus sesiones y a tu seguimiento.</p>
      <div className="mt-8">
        <LoginForm />
      </div>
      {isPublicRegistrationEnabled() ? (
        <p className="mt-6 text-center text-sm text-stone-600">
          ¿No tienes cuenta?{' '}
          <a href="/registro" className="font-medium text-teal-800 underline underline-offset-2">
            Crea una
          </a>
          .
        </p>
      ) : (
        <p className="mt-6 rounded-xl border border-stone-200 bg-white/70 px-4 py-3 text-center text-sm text-stone-600">
          Serenia está en un piloto privado: el acceso es solo por invitación.
        </p>
      )}
    </div>
  )
}
