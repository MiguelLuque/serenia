import { Button } from '@/components/ui/button'
import { logoutAction } from '@/app/(auth)/actions'

type Props = { displayName: string; role: 'patient' | 'clinician' }

export function Header({ displayName, role }: Props) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
        <div>
          <p className="text-sm text-slate-500">
            {role === 'clinician' ? 'Panel clínico' : 'Serenia'}
          </p>
          <p className="font-medium">{displayName || 'Sin nombre'}</p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" size="sm">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </header>
  )
}
