export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assessments: {
        Row: {
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          clinical_notes: string | null
          created_at: string
          generated_by: Database["public"]["Enums"]["generated_by_source"]
          id: string
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["review_status"] | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["assessment_status"]
          summary_json: Json
          supersedes_assessment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          clinical_notes?: string | null
          created_at?: string
          generated_by?: Database["public"]["Enums"]["generated_by_source"]
          id?: string
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["assessment_status"]
          summary_json: Json
          supersedes_assessment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          clinical_notes?: string | null
          created_at?: string
          generated_by?: Database["public"]["Enums"]["generated_by_source"]
          id?: string
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["assessment_status"]
          summary_json?: Json
          supersedes_assessment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "clinical_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_supersedes_assessment_id_fkey"
            columns: ["supersedes_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          created_at: string
          diff_json: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          diff_json?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          diff_json?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      care_plans: {
        Row: {
          created_at: string
          created_by: string | null
          goals_json: Json
          id: string
          next_check_in_at: string | null
          recommendations_json: Json
          source_type: Database["public"]["Enums"]["generated_by_source"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          goals_json?: Json
          id?: string
          next_check_in_at?: string | null
          recommendations_json?: Json
          source_type?: Database["public"]["Enums"]["generated_by_source"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          goals_json?: Json
          id?: string
          next_check_in_at?: string | null
          recommendations_json?: Json
          source_type?: Database["public"]["Enums"]["generated_by_source"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clinical_sessions: {
        Row: {
          closed_at: string | null
          closure_reason: string | null
          conversation_id: string
          created_at: string
          id: string
          last_activity_at: string
          opened_at: string
          status: Database["public"]["Enums"]["session_status"]
          summary_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          closure_reason?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          last_activity_at?: string
          opened_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          summary_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          closure_reason?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          last_activity_at?: string
          opened_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          summary_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sessions_summary"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "session_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      clinician_reviews: {
        Row: {
          assessment_id: string
          clinician_id: string
          created_at: string
          id: string
          notes: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          assessment_id: string
          clinician_id: string
          created_at?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          assessment_id?: string
          clinician_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "clinician_reviews_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinician_reviews_clinician_id_fkey"
            columns: ["clinician_id"]
            isOneToOne: false
            referencedRelation: "clinicians"
            referencedColumns: ["id"]
          },
        ]
      }
      clinicians: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      consents: {
        Row: {
          accepted_at: string
          consent_version: string
          id: string
          payload_json: Json
          user_id: string
        }
        Insert: {
          accepted_at?: string
          consent_version: string
          id?: string
          payload_json?: Json
          user_id: string
        }
        Update: {
          accepted_at?: string
          consent_version?: string
          id?: string
          payload_json?: Json
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          latest_session_summary_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["conversation_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          latest_session_summary_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          latest_session_summary_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_conversations_latest_summary"
            columns: ["latest_session_summary_id"]
            isOneToOne: false
            referencedRelation: "session_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          parts: Json
          role: Database["public"]["Enums"]["message_role"]
          session_id: string | null
          visible_to_user: boolean
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          parts?: Json
          role: Database["public"]["Enums"]["message_role"]
          session_id?: string | null
          visible_to_user?: boolean
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json
          role?: Database["public"]["Enums"]["message_role"]
          session_id?: string | null
          visible_to_user?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "clinical_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_context_injections: {
        Row: {
          block_char_count: number
          created_at: string
          id: string
          last_validated_assessment_id: string | null
          pending_tasks_count: number
          risk_state: string
          risk_triggered: boolean
          session_id: string
          tier: string
          truncated_sections: string[]
          user_id: string
        }
        Insert: {
          block_char_count: number
          created_at?: string
          id?: string
          last_validated_assessment_id?: string | null
          pending_tasks_count: number
          risk_state: string
          risk_triggered: boolean
          session_id: string
          tier: string
          truncated_sections?: string[]
          user_id: string
        }
        Update: {
          block_char_count?: number
          created_at?: string
          id?: string
          last_validated_assessment_id?: string | null
          pending_tasks_count?: number
          risk_state?: string
          risk_triggered?: boolean
          session_id?: string
          tier?: string
          truncated_sections?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_context_injections_last_validated_assessment_id_fkey"
            columns: ["last_validated_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_context_injections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "clinical_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_tasks: {
        Row: {
          acordada_en_assessment_id: string
          acordada_en_session_id: string
          closed_at: string | null
          closed_by_assessment_id: string | null
          created_at: string
          descripcion: string
          estado: Database["public"]["Enums"]["patient_task_status"]
          id: string
          nota: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acordada_en_assessment_id: string
          acordada_en_session_id: string
          closed_at?: string | null
          closed_by_assessment_id?: string | null
          created_at?: string
          descripcion: string
          estado?: Database["public"]["Enums"]["patient_task_status"]
          id?: string
          nota?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acordada_en_assessment_id?: string
          acordada_en_session_id?: string
          closed_at?: string | null
          closed_by_assessment_id?: string | null
          created_at?: string
          descripcion?: string
          estado?: Database["public"]["Enums"]["patient_task_status"]
          id?: string
          nota?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_tasks_acordada_en_assessment_id_fkey"
            columns: ["acordada_en_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_tasks_acordada_en_session_id_fkey"
            columns: ["acordada_en_session_id"]
            isOneToOne: false
            referencedRelation: "clinical_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_tasks_closed_by_assessment_id_fkey"
            columns: ["closed_by_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_answers: {
        Row: {
          answer_numeric: number | null
          answer_raw: string
          answered_at: string
          id: string
          instance_id: string
          item_id: string
        }
        Insert: {
          answer_numeric?: number | null
          answer_raw: string
          answered_at?: string
          id?: string
          instance_id: string
          item_id: string
        }
        Update: {
          answer_numeric?: number | null
          answer_raw?: string
          answered_at?: string
          id?: string
          instance_id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_answers_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_answers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_items"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_definitions: {
        Row: {
          code: string
          created_at: string
          domain: string
          id: string
          instructions_json: Json
          is_active: boolean
          language: string
          name: string
          scoring_strategy: string
          source_reference: string | null
          version: string
        }
        Insert: {
          code: string
          created_at?: string
          domain: string
          id?: string
          instructions_json?: Json
          is_active?: boolean
          language?: string
          name: string
          scoring_strategy: string
          source_reference?: string | null
          version?: string
        }
        Update: {
          code?: string
          created_at?: string
          domain?: string
          id?: string
          instructions_json?: Json
          is_active?: boolean
          language?: string
          name?: string
          scoring_strategy?: string
          source_reference?: string | null
          version?: string
        }
        Relationships: []
      }
      questionnaire_instances: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          questionnaire_id: string
          scored_at: string | null
          session_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["questionnaire_instance_status"]
          submitted_at: string | null
          trigger_reason: string | null
          triggered_by: Database["public"]["Enums"]["trigger_source"]
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          questionnaire_id: string
          scored_at?: string | null
          session_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["questionnaire_instance_status"]
          submitted_at?: string | null
          trigger_reason?: string | null
          triggered_by?: Database["public"]["Enums"]["trigger_source"]
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          questionnaire_id?: string
          scored_at?: string | null
          session_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["questionnaire_instance_status"]
          submitted_at?: string | null
          trigger_reason?: string | null
          triggered_by?: Database["public"]["Enums"]["trigger_source"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_instances_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_instances_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_instances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "clinical_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_items: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          numeric_value_map_json: Json
          options_json: Json
          order_index: number
          prompt: string
          questionnaire_id: string
          response_type: string
          risk_flag_rule: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          numeric_value_map_json?: Json
          options_json?: Json
          order_index: number
          prompt: string
          questionnaire_id: string
          response_type?: string
          risk_flag_rule?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          numeric_value_map_json?: Json
          options_json?: Json
          order_index?: number
          prompt?: string
          questionnaire_id?: string
          response_type?: string
          risk_flag_rule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_items_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_results: {
        Row: {
          created_at: string
          flags_json: Json
          id: string
          instance_id: string
          interpretation_json: Json
          requires_review: boolean
          severity_band: string
          subscores_json: Json
          total_score: number
        }
        Insert: {
          created_at?: string
          flags_json?: Json
          id?: string
          instance_id: string
          interpretation_json?: Json
          requires_review?: boolean
          severity_band: string
          subscores_json?: Json
          total_score: number
        }
        Update: {
          created_at?: string
          flags_json?: Json
          id?: string
          instance_id?: string
          interpretation_json?: Json
          requires_review?: boolean
          severity_band?: string
          subscores_json?: Json
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_results_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "questionnaire_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_events: {
        Row: {
          acknowledged_at: string | null
          closed_at: string | null
          conversation_id: string | null
          created_at: string
          id: string
          payload_json: Json
          risk_type: Database["public"]["Enums"]["risk_type"]
          session_id: string | null
          severity: Database["public"]["Enums"]["risk_severity"]
          source_type: string
          status: Database["public"]["Enums"]["risk_status"]
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          closed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          payload_json?: Json
          risk_type: Database["public"]["Enums"]["risk_type"]
          session_id?: string | null
          severity: Database["public"]["Enums"]["risk_severity"]
          source_type: string
          status?: Database["public"]["Enums"]["risk_status"]
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          closed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          payload_json?: Json
          risk_type?: Database["public"]["Enums"]["risk_type"]
          session_id?: string | null
          severity?: Database["public"]["Enums"]["risk_severity"]
          source_type?: string
          status?: Database["public"]["Enums"]["risk_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "clinical_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_summaries: {
        Row: {
          created_at: string
          generated_by: Database["public"]["Enums"]["generated_by_source"]
          id: string
          session_id: string
          summary_json: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_by?: Database["public"]["Enums"]["generated_by_source"]
          id?: string
          session_id: string
          summary_json: Json
          user_id: string
        }
        Update: {
          created_at?: string
          generated_by?: Database["public"]["Enums"]["generated_by_source"]
          id?: string
          session_id?: string
          summary_json?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "clinical_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_clinician_assignments: {
        Row: {
          assigned_at: string
          clinician_id: string
          ended_at: string | null
          id: string
          is_primary: boolean
          user_id: string
        }
        Insert: {
          assigned_at?: string
          clinician_id: string
          ended_at?: string | null
          id?: string
          is_primary?: boolean
          user_id: string
        }
        Update: {
          assigned_at?: string
          clinician_id?: string
          ended_at?: string | null
          id?: string
          is_primary?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_clinician_assignments_clinician_id_fkey"
            columns: ["clinician_id"]
            isOneToOne: false
            referencedRelation: "clinicians"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          active_care_plan_id: string | null
          baseline_summary: string | null
          birth_date: string | null
          city: string | null
          consent_given_at: string | null
          consent_version: string | null
          country: string | null
          created_at: string
          current_focus: string[] | null
          current_medication: boolean | null
          display_name: string | null
          employment: string | null
          id: string
          last_known_risk_level: Database["public"]["Enums"]["risk_profile_status"]
          last_reviewed_assessment_id: string | null
          living_with: string | null
          locale: string
          onboarding_status: Database["public"]["Enums"]["onboarding_status"]
          prior_therapy: boolean | null
          reason_for_consulting: string | null
          relationship_status: string | null
          risk_profile_status: Database["public"]["Enums"]["risk_profile_status"]
          role: Database["public"]["Enums"]["user_role"]
          sex: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_care_plan_id?: string | null
          baseline_summary?: string | null
          birth_date?: string | null
          city?: string | null
          consent_given_at?: string | null
          consent_version?: string | null
          country?: string | null
          created_at?: string
          current_focus?: string[] | null
          current_medication?: boolean | null
          display_name?: string | null
          employment?: string | null
          id?: string
          last_known_risk_level?: Database["public"]["Enums"]["risk_profile_status"]
          last_reviewed_assessment_id?: string | null
          living_with?: string | null
          locale?: string
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          prior_therapy?: boolean | null
          reason_for_consulting?: string | null
          relationship_status?: string | null
          risk_profile_status?: Database["public"]["Enums"]["risk_profile_status"]
          role?: Database["public"]["Enums"]["user_role"]
          sex?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_care_plan_id?: string | null
          baseline_summary?: string | null
          birth_date?: string | null
          city?: string | null
          consent_given_at?: string | null
          consent_version?: string | null
          country?: string | null
          created_at?: string
          current_focus?: string[] | null
          current_medication?: boolean | null
          display_name?: string | null
          employment?: string | null
          id?: string
          last_known_risk_level?: Database["public"]["Enums"]["risk_profile_status"]
          last_reviewed_assessment_id?: string | null
          living_with?: string | null
          locale?: string
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          prior_therapy?: boolean | null
          reason_for_consulting?: string | null
          relationship_status?: string | null
          risk_profile_status?: Database["public"]["Enums"]["risk_profile_status"]
          role?: Database["public"]["Enums"]["user_role"]
          sex?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_profiles_care_plan"
            columns: ["active_care_plan_id"]
            isOneToOne: false
            referencedRelation: "care_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_profiles_last_assessment"
            columns: ["last_reviewed_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      close_stale_sessions: {
        Args: { threshold_minutes?: number }
        Returns: number
      }
      gdpr_erase_user: { Args: { target_user_id: string }; Returns: undefined }
      is_clinician: { Args: never; Returns: boolean }
    }
    Enums: {
      actor_type: "user" | "service" | "system"
      assessment_status:
        | "draft_ai"
        | "pending_clinician_review"
        | "reviewed_confirmed"
        | "reviewed_modified"
        | "rejected"
        | "superseded"
        | "requires_manual_review"
      assessment_type: "intake" | "follow_up" | "closure" | "review"
      conversation_status: "active" | "closed" | "archived"
      generated_by_source: "ai" | "clinician" | "system"
      message_role: "user" | "assistant" | "tool" | "system"
      onboarding_status:
        | "pending"
        | "consent"
        | "age_gate"
        | "baseline"
        | "complete"
      patient_task_status:
        | "pendiente"
        | "cumplida"
        | "parcial"
        | "no_realizada"
        | "no_abordada"
      questionnaire_instance_status:
        | "proposed"
        | "in_progress"
        | "submitted"
        | "scored"
        | "cancelled"
      review_status:
        | "pending"
        | "in_review"
        | "reviewed"
        | "rejected"
        | "needs_followup"
      risk_profile_status: "unknown" | "low" | "elevated" | "active_protocol"
      risk_severity: "low" | "moderate" | "high" | "critical"
      risk_status: "open" | "acknowledged" | "escalated" | "closed"
      risk_type:
        | "suicidal_ideation"
        | "self_harm"
        | "severe_distress"
        | "crisis_other"
      session_status: "open" | "paused" | "closed"
      trigger_source: "ai" | "clinician" | "schedule" | "user"
      user_role: "patient" | "clinician"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      actor_type: ["user", "service", "system"],
      assessment_status: [
        "draft_ai",
        "pending_clinician_review",
        "reviewed_confirmed",
        "reviewed_modified",
        "rejected",
        "superseded",
        "requires_manual_review",
      ],
      assessment_type: ["intake", "follow_up", "closure", "review"],
      conversation_status: ["active", "closed", "archived"],
      generated_by_source: ["ai", "clinician", "system"],
      message_role: ["user", "assistant", "tool", "system"],
      onboarding_status: [
        "pending",
        "consent",
        "age_gate",
        "baseline",
        "complete",
      ],
      patient_task_status: [
        "pendiente",
        "cumplida",
        "parcial",
        "no_realizada",
        "no_abordada",
      ],
      questionnaire_instance_status: [
        "proposed",
        "in_progress",
        "submitted",
        "scored",
        "cancelled",
      ],
      review_status: [
        "pending",
        "in_review",
        "reviewed",
        "rejected",
        "needs_followup",
      ],
      risk_profile_status: ["unknown", "low", "elevated", "active_protocol"],
      risk_severity: ["low", "moderate", "high", "critical"],
      risk_status: ["open", "acknowledged", "escalated", "closed"],
      risk_type: [
        "suicidal_ideation",
        "self_harm",
        "severe_distress",
        "crisis_other",
      ],
      session_status: ["open", "paused", "closed"],
      trigger_source: ["ai", "clinician", "schedule", "user"],
      user_role: ["patient", "clinician"],
    },
  },
} as const
