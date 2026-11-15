import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { ClientDetailRow, ProfileRow } from '@/types/database'
import { fetchClientDetail, fetchProfile } from './api'

interface AuthContextValue {
  session: Session | null
  profile: ProfileRow | null
  clientDetail: ClientDetailRow | null
  loading: boolean
  profileError: string | null
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [clientDetail, setClientDetail] = useState<ClientDetailRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const mounted = useRef(true)

  const loadUserData = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      if (!mounted.current) return
      setProfile(null)
      setClientDetail(null)
      setProfileError(null)
      return
    }

    try {
      const [nextProfile, nextDetail] = await Promise.all([
        fetchProfile(nextSession.user.id),
        fetchClientDetail(nextSession.user.id),
      ])
      if (!mounted.current) return
      setProfile(nextProfile)
      setClientDetail(nextDetail)
      setProfileError(nextProfile ? null : 'Your profile could not be found. Contact the gym admin.')
    } catch (error) {
      if (!mounted.current) return
      setProfileError(error instanceof Error ? error.message : 'Failed to load your profile.')
    }
  }, [])

  useEffect(() => {
    mounted.current = true

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted.current) return
      setSession(data.session)
      await loadUserData(data.session)
      if (mounted.current) setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') return
      setSession(nextSession)
      if (event === 'SIGNED_IN') setLoading(true)
      // Defer Supabase calls out of the auth callback to avoid lock contention.
      setTimeout(() => {
        void loadUserData(nextSession).then(() => {
          if (mounted.current && event !== 'TOKEN_REFRESHED') setLoading(false)
        })
      }, 0)
    })

    return () => {
      mounted.current = false
      subscription.subscription.unsubscribe()
    }
  }, [loadUserData])

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    await loadUserData(data.session)
  }, [loadUserData])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setClientDetail(null)
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      clientDetail,
      loading,
      profileError,
      refresh,
      signOut: handleSignOut,
    }),
    [session, profile, clientDetail, loading, profileError, refresh, handleSignOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
