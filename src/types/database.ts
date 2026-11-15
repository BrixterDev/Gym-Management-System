// Typed database models mirroring supabase/migrations.
// Regenerate with: supabase gen types typescript --project-id <ref> > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'client'
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type MembershipStatus = 'non-member' | 'member'
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'paused'
export type PaymentMethod = 'cash' | 'gcash' | 'card' | 'bank_transfer'
export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded'

export type GymSettingsRow = {
  id: string
  timezone: string
  client_qr_url: string | null
  admin_qr_url: string | null
  created_at: string
  updated_at: string
}

export type ProfileRow = {
  id: string
  email: string
  phone: string | null
  role: UserRole
  account_status: AccountStatus
  membership_status: MembershipStatus
  created_at: string
  updated_at: string
}

export type ClientDetailRow = {
  id: string
  client_id: string
  display_name: string | null
  member_code: string | null
  height_cm: number | null
  date_of_birth: string | null
  emergency_contact: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type MembershipPlanRow = {
  id: string
  name: string
  description: string | null
  duration_days: number
  price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MembershipRow = {
  id: string
  client_id: string
  plan_id: string
  start_date: string
  end_date: string
  subscription_status: SubscriptionStatus
  paused_at: string | null
  paused_remaining_days: number | null
  price_at_assignment: number
  created_at: string
  updated_at: string
}

export type AttendanceRow = {
  id: string
  client_id: string
  time_in: string
  time_out: string | null
  expired_during_session: boolean
  created_at: string
}

export type BodyMetricRow = {
  id: string
  client_id: string
  measured_at: string
  weight_kg: number | null
  height_cm: number | null
  waist_cm: number | null
  notes: string | null
  recorded_by: string
  created_at: string
  updated_at: string
}

export type PaymentRow = {
  id: string
  membership_id: string
  amount: number
  payment_date: string
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  reference_number: string | null
  recorded_by: string | null
  created_at: string
}

export type AuditLogRow = {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  before_data: Json | null
  after_data: Json | null
  created_at: string
}

export type ClientDirectoryRow = {
  id: string
  email: string
  phone: string | null
  role: UserRole
  account_status: AccountStatus
  membership_status: MembershipStatus
  created_at: string
  updated_at: string
  client_detail_id: string | null
  display_name: string | null
  member_code: string | null
  height_cm: number | null
  date_of_birth: string | null
  emergency_contact: string | null
  notes: string | null
  detail_updated_at: string | null
}

type Relationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne?: boolean
  referencedRelation: string
  referencedColumns: string[]
}

type TableDef<Row, Insert, Update, Rels extends Relationship[] = []> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: Rels
}

type MembershipRelationships = [
  {
    foreignKeyName: 'memberships_plan_id_fkey'
    columns: ['plan_id']
    isOneToOne: false
    referencedRelation: 'membership_plans'
    referencedColumns: ['id']
  },
]

export interface Database {
  public: {
    Tables: {
      gym_settings: TableDef<
        GymSettingsRow,
        {
          id?: string
          timezone?: string
          client_qr_url?: string | null
          admin_qr_url?: string | null
          created_at?: string
          updated_at?: string
        },
        Partial<GymSettingsRow>
      >
      profiles: TableDef<
        ProfileRow,
        {
          id: string
          email: string
          phone?: string | null
          role?: UserRole
          account_status?: AccountStatus
          membership_status?: MembershipStatus
          created_at?: string
          updated_at?: string
        },
        Partial<ProfileRow>
      >
      client_details: TableDef<
        ClientDetailRow,
        {
          id?: string
          client_id: string
          display_name?: string | null
          member_code?: string | null
          height_cm?: number | null
          date_of_birth?: string | null
          emergency_contact?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        },
        Partial<ClientDetailRow>
      >
      membership_plans: TableDef<
        MembershipPlanRow,
        {
          id?: string
          name: string
          description?: string | null
          duration_days: number
          price: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        },
        Partial<MembershipPlanRow>
      >
      memberships: TableDef<
        MembershipRow,
        {
          id?: string
          client_id: string
          plan_id: string
          start_date: string
          end_date: string
          subscription_status?: SubscriptionStatus
          paused_at?: string | null
          paused_remaining_days?: number | null
          price_at_assignment?: number
          created_at?: string
          updated_at?: string
        },
        Partial<MembershipRow>,
        MembershipRelationships
      >
      attendance: TableDef<
        AttendanceRow,
        {
          id?: string
          client_id: string
          time_in?: string
          time_out?: string | null
          expired_during_session?: boolean
          created_at?: string
        },
        Partial<AttendanceRow>
      >
      body_metrics: TableDef<
        BodyMetricRow,
        {
          id?: string
          client_id: string
          measured_at?: string
          weight_kg?: number | null
          height_cm?: number | null
          waist_cm?: number | null
          notes?: string | null
          recorded_by?: string
          created_at?: string
          updated_at?: string
        },
        Partial<BodyMetricRow>
      >
      payments: TableDef<
        PaymentRow,
        {
          id?: string
          membership_id: string
          amount: number
          payment_date?: string
          payment_method: PaymentMethod
          payment_status?: PaymentStatus
          reference_number?: string | null
          recorded_by?: string | null
          created_at?: string
        },
        Partial<PaymentRow>
      >
      audit_logs: TableDef<
        AuditLogRow,
        {
          id?: string
          actor_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          before_data?: Json | null
          after_data?: Json | null
          created_at?: string
        },
        Partial<AuditLogRow>
      >
    }
    Views: {
      admin_client_directory: {
        Row: ClientDirectoryRow
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      recompute_membership_status: { Args: { p_client_id: string }; Returns: string }
      admin_set_account_status: {
        Args: { p_client_id: string; p_status: AccountStatus }
        Returns: ProfileRow
      }
      pending_approval_count: { Args: Record<string, never>; Returns: number }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
