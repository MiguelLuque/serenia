import { ProfileForm } from '@/components/onboarding/profile-form'

export default function Page() {
  return (
    <div className="mx-auto max-w-xl py-12 px-4">
      <h1 className="text-2xl font-semibold">Tu perfil</h1>
      <p className="mt-2 text-slate-600">
        Necesitamos algunos datos para personalizar tu experiencia. Todo queda protegido y solo se usa dentro de Serenia.
      </p>
      <div className="mt-8">
        <ProfileForm />
      </div>
    </div>
  )
}
