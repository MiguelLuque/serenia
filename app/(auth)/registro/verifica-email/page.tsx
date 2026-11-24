import { MailCheck } from 'lucide-react'

export default function Page() {
  return (
    <div className="text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-900/20">
        <MailCheck className="size-6" />
      </span>
      <h1 className="landing-serif mt-6 text-[2.75rem] leading-[1.05] text-stone-900">Revisa tu bandeja</h1>
      <p className="mt-4 leading-relaxed text-stone-600">
        Te hemos enviado un enlace de verificación a tu email. Haz clic en él para activar tu cuenta.
      </p>
    </div>
  )
}
