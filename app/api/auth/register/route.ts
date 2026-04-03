import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const admin = createAdminClient()

  if (!admin) {
    console.error('Register failed: missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL')
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY fehlt auf dem Server.' },
      { status: 500 }
    )
  }

  const body = (await request.json()) as {
    email?: string
    password?: string
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()

  if (!email || !password) {
    return NextResponse.json({ error: 'E-Mail und Passwort sind erforderlich.' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' }, { status: 400 })
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    console.error('Supabase admin.createUser failed', {
      email,
      message: error.message,
      code: error.code,
      status: error.status,
    })

    if (error.message.toLowerCase().includes('already')) {
      const {
        data: { users },
        error: listError,
      } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })

      if (listError) {
        console.error('Supabase listUsers failed after conflict', listError)
        return NextResponse.json(
          { error: 'Diese E-Mail existiert bereits und konnte nicht automatisch repariert werden.' },
          { status: 409 }
        )
      }

      const existingUser = users.find((user) => user.email?.toLowerCase() === email)

      if (!existingUser) {
        return NextResponse.json(
          { error: 'Diese E-Mail ist bereits registriert. Versuche stattdessen den Login.' },
          { status: 409 }
        )
      }

      const { data: updatedUser, error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email: existingUser.email,
        email_confirm: true,
      })

      if (updateError) {
        console.error('Supabase updateUserById failed after conflict', updateError)
        return NextResponse.json(
          { error: 'Bestehender Account gefunden, konnte aber nicht repariert werden.' },
          { status: 409 }
        )
      }

      if (updatedUser.user) {
        await admin.from('user_profiles').upsert({
          id: updatedUser.user.id,
          email: updatedUser.user.email,
        })

        await admin.from('subscriptions').upsert({
          user_id: updatedUser.user.id,
          status: 'inactive',
          tier: 'free',
        })
      }

      return NextResponse.json({ ok: true, repairedExistingUser: true })
    }

    return NextResponse.json({ error: error.message }, { status: error.status ?? 400 })
  }

  if (data.user) {
    const profileResult = await admin.from('user_profiles').upsert({
      id: data.user.id,
      email: data.user.email,
    })

    const subscriptionResult = await admin.from('subscriptions').upsert({
      user_id: data.user.id,
      status: 'inactive',
      tier: 'free',
    })

    if (profileResult.error) {
      console.error('Profile upsert failed after register', profileResult.error)
    }

    if (subscriptionResult.error) {
      console.error('Subscription upsert failed after register', subscriptionResult.error)
    }
  }

  return NextResponse.json({ ok: true })
}
