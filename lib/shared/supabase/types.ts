
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "assessment_jobs": {
                  Row: {
                    "attempts": number,"available_at": string,"context_json": Json | null,"last_error": string | null,"lease_until": string | null,"run_id": string | null,"session_id": string,"status": string,"token": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"available_at"?: string,"context_json"?: Json | null,"last_error"?: string | null,"lease_until"?: string | null,"run_id"?: string | null,"session_id": string,"status"?: string,"token"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"available_at"?: string,"context_json"?: Json | null,"last_error"?: string | null,"lease_until"?: string | null,"run_id"?: string | null,"session_id"?: string,"status"?: string,"token"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessment_jobs_session_id_fkey"
      columns: ["session_id"]
isOneToOne: true
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"assessments": {
                  Row: {
                    "assessment_type": Database["public"]['Enums']["assessment_type"],"clinical_notes": string | null,"created_at": string,"generated_by": Database["public"]['Enums']["generated_by_source"],"id": string,"regeneration_previous_status": Database["public"]['Enums']["assessment_status"] | null,"rejection_reason": string | null,"review_request_json": Json | null,"review_status": Database["public"]['Enums']["review_status"] | null,"reviewed_at": string | null,"reviewed_by": string | null,"session_id": string | null,"status": Database["public"]['Enums']["assessment_status"],"summary_json": NonNullable<Json>,"supersedes_assessment_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assessment_type"?: Database["public"]['Enums']["assessment_type"],"clinical_notes"?: string | null,"created_at"?: string,"generated_by"?: Database["public"]['Enums']["generated_by_source"],"id"?: string,"regeneration_previous_status"?: Database["public"]['Enums']["assessment_status"] | null,"rejection_reason"?: string | null,"review_request_json"?: Json | null,"review_status"?: Database["public"]['Enums']["review_status"] | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"session_id"?: string | null,"status"?: Database["public"]['Enums']["assessment_status"],"summary_json": NonNullable<Json>,"supersedes_assessment_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "assessment_type"?: Database["public"]['Enums']["assessment_type"],"clinical_notes"?: string | null,"created_at"?: string,"generated_by"?: Database["public"]['Enums']["generated_by_source"],"id"?: string,"regeneration_previous_status"?: Database["public"]['Enums']["assessment_status"] | null,"rejection_reason"?: string | null,"review_request_json"?: Json | null,"review_status"?: Database["public"]['Enums']["review_status"] | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"session_id"?: string | null,"status"?: Database["public"]['Enums']["assessment_status"],"summary_json"?: NonNullable<Json>,"supersedes_assessment_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessments_previous_owner"
      columns: ["supersedes_assessment_id","user_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "assessments_previous_session"
      columns: ["supersedes_assessment_id","session_id","user_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id","session_id","user_id"]
    },{
      foreignKeyName: "assessments_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessments_session_owner"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "assessments_supersedes_assessment_id_fkey"
      columns: ["supersedes_assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_type": Database["public"]['Enums']["actor_type"],"created_at": string,"diff_json": NonNullable<Json>,"entity_id": string | null,"entity_type": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_type": Database["public"]['Enums']["actor_type"],"created_at"?: string,"diff_json"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type": string,"id"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_type"?: Database["public"]['Enums']["actor_type"],"created_at"?: string,"diff_json"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"care_plans": {
                  Row: {
                    "created_at": string,"created_by": string | null,"goals_json": NonNullable<Json>,"id": string,"next_check_in_at": string | null,"recommendations_json": NonNullable<Json>,"source_type": Database["public"]['Enums']["generated_by_source"],"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"goals_json"?: NonNullable<Json>,"id"?: string,"next_check_in_at"?: string | null,"recommendations_json"?: NonNullable<Json>,"source_type"?: Database["public"]['Enums']["generated_by_source"],"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"goals_json"?: NonNullable<Json>,"id"?: string,"next_check_in_at"?: string | null,"recommendations_json"?: NonNullable<Json>,"source_type"?: Database["public"]['Enums']["generated_by_source"],"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"chat_turns": {
                  Row: {
                    "attempts": number,"created_at": string,"error_code": string | null,"lease_until": string,"previous_request_id": string | null,"request_id": string,"response_chunks": Json | null,"response_parts": Json | null,"session_id": string,"status": string,"text": string,"token": string,"urgent_response": boolean,"user_id": string,"user_message_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"error_code"?: string | null,"lease_until": string,"previous_request_id"?: string | null,"request_id": string,"response_chunks"?: Json | null,"response_parts"?: Json | null,"session_id": string,"status": string,"text": string,"token"?: string,"urgent_response"?: boolean,"user_id": string,"user_message_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"error_code"?: string | null,"lease_until"?: string,"previous_request_id"?: string | null,"request_id"?: string,"response_chunks"?: Json | null,"response_parts"?: Json | null,"session_id"?: string,"status"?: string,"text"?: string,"token"?: string,"urgent_response"?: boolean,"user_id"?: string,"user_message_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_turns_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_turns_session_id_user_id_fkey"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "chat_turns_user_message_id_fkey"
      columns: ["user_message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    }
                  ]
                },"clinical_sessions": {
                  Row: {
                    "closed_at": string | null,"closure_reason": string | null,"conversation_id": string,"created_at": string,"id": string,"last_activity_at": string,"opened_at": string,"protocol_phase": number,"status": Database["public"]['Enums']["session_status"],"summary_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"closure_reason"?: string | null,"conversation_id": string,"created_at"?: string,"id"?: string,"last_activity_at"?: string,"opened_at"?: string,"protocol_phase"?: number,"status"?: Database["public"]['Enums']["session_status"],"summary_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "closed_at"?: string | null,"closure_reason"?: string | null,"conversation_id"?: string,"created_at"?: string,"id"?: string,"last_activity_at"?: string,"opened_at"?: string,"protocol_phase"?: number,"status"?: Database["public"]['Enums']["session_status"],"summary_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clinical_sessions_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fk_sessions_summary"
      columns: ["summary_id"]
isOneToOne: false
      referencedRelation: "session_summaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_conversation_owner"
      columns: ["conversation_id","user_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"clinician_reviews": {
                  Row: {
                    "assessment_id": string,"clinician_id": string,"created_at": string,"id": string,"notes": string | null,"reviewed_at": string | null,"status": Database["public"]['Enums']["review_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "assessment_id": string,"clinician_id": string,"created_at"?: string,"id"?: string,"notes"?: string | null,"reviewed_at"?: string | null,"status"?: Database["public"]['Enums']["review_status"]
                  }
                  Update: {
                    "assessment_id"?: string,"clinician_id"?: string,"created_at"?: string,"id"?: string,"notes"?: string | null,"reviewed_at"?: string | null,"status"?: Database["public"]['Enums']["review_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "clinician_reviews_assessment_id_fkey"
      columns: ["assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinician_reviews_clinician_id_fkey"
      columns: ["clinician_id"]
isOneToOne: false
      referencedRelation: "clinicians"
      referencedColumns: ["id"]
    }
                  ]
                },"clinicians": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"consents": {
                  Row: {
                    "accepted_at": string,"consent_version": string,"id": string,"payload_json": NonNullable<Json>,"server_recorded": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string,"consent_version": string,"id"?: string,"payload_json"?: NonNullable<Json>,"server_recorded"?: boolean,"user_id": string
                  }
                  Update: {
                    "accepted_at"?: string,"consent_version"?: string,"id"?: string,"payload_json"?: NonNullable<Json>,"server_recorded"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"ended_at": string | null,"id": string,"latest_session_summary_id": string | null,"started_at": string,"status": Database["public"]['Enums']["conversation_status"],"title": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"latest_session_summary_id"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["conversation_status"],"title"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"latest_session_summary_id"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["conversation_status"],"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fk_conversations_latest_summary"
      columns: ["latest_session_summary_id"]
isOneToOne: false
      referencedRelation: "session_summaries"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "conversation_id": string,"created_at": string,"id": string,"parts": NonNullable<Json>,"role": Database["public"]['Enums']["message_role"],"session_id": string | null,"visible_to_user": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"created_at"?: string,"id"?: string,"parts"?: NonNullable<Json>,"role": Database["public"]['Enums']["message_role"],"session_id"?: string | null,"visible_to_user"?: boolean
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: string,"id"?: string,"parts"?: NonNullable<Json>,"role"?: Database["public"]['Enums']["message_role"],"session_id"?: string | null,"visible_to_user"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_session_conversation"
      columns: ["session_id","conversation_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id","conversation_id"]
    },{
      foreignKeyName: "messages_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_context_injections": {
                  Row: {
                    "block_char_count": number,"created_at": string,"id": string,"last_validated_assessment_id": string | null,"pending_tasks_count": number,"risk_state": string,"risk_triggered": boolean,"session_id": string,"tier": string,"truncated_sections": (string)[],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "block_char_count": number,"created_at"?: string,"id"?: string,"last_validated_assessment_id"?: string | null,"pending_tasks_count": number,"risk_state": string,"risk_triggered": boolean,"session_id": string,"tier": string,"truncated_sections"?: (string)[],"user_id": string
                  }
                  Update: {
                    "block_char_count"?: number,"created_at"?: string,"id"?: string,"last_validated_assessment_id"?: string | null,"pending_tasks_count"?: number,"risk_state"?: string,"risk_triggered"?: boolean,"session_id"?: string,"tier"?: string,"truncated_sections"?: (string)[],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "injections_assessment_owner"
      columns: ["last_validated_assessment_id","user_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "injections_session_owner"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "patient_context_injections_last_validated_assessment_id_fkey"
      columns: ["last_validated_assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_context_injections_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_tasks": {
                  Row: {
                    "acordada_en_assessment_id": string,"acordada_en_session_id": string,"closed_at": string | null,"closed_by_assessment_id": string | null,"created_at": string,"descripcion": string,"estado": Database["public"]['Enums']["patient_task_status"],"id": string,"nota": string | null,"source_task_index": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acordada_en_assessment_id": string,"acordada_en_session_id": string,"closed_at"?: string | null,"closed_by_assessment_id"?: string | null,"created_at"?: string,"descripcion": string,"estado"?: Database["public"]['Enums']["patient_task_status"],"id"?: string,"nota"?: string | null,"source_task_index"?: number | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "acordada_en_assessment_id"?: string,"acordada_en_session_id"?: string,"closed_at"?: string | null,"closed_by_assessment_id"?: string | null,"created_at"?: string,"descripcion"?: string,"estado"?: Database["public"]['Enums']["patient_task_status"],"id"?: string,"nota"?: string | null,"source_task_index"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_tasks_acordada_en_assessment_id_fkey"
      columns: ["acordada_en_assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_tasks_acordada_en_session_id_fkey"
      columns: ["acordada_en_session_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_tasks_closed_by_assessment_id_fkey"
      columns: ["closed_by_assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_assessment_session_owner"
      columns: ["acordada_en_assessment_id","acordada_en_session_id","user_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id","session_id","user_id"]
    },{
      foreignKeyName: "tasks_closed_owner"
      columns: ["closed_by_assessment_id","user_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"questionnaire_answers": {
                  Row: {
                    "answer_numeric": number | null,"answer_raw": string,"answered_at": string,"id": string,"instance_id": string,"item_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer_numeric"?: number | null,"answer_raw": string,"answered_at"?: string,"id"?: string,"instance_id": string,"item_id": string
                  }
                  Update: {
                    "answer_numeric"?: number | null,"answer_raw"?: string,"answered_at"?: string,"id"?: string,"instance_id"?: string,"item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "questionnaire_answers_instance_id_fkey"
      columns: ["instance_id"]
isOneToOne: false
      referencedRelation: "questionnaire_instances"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questionnaire_answers_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "questionnaire_items"
      referencedColumns: ["id"]
    }
                  ]
                },"questionnaire_definitions": {
                  Row: {
                    "code": string,"created_at": string,"domain": string,"id": string,"instructions_json": NonNullable<Json>,"is_active": boolean,"is_clinician_rated": boolean,"language": string,"name": string,"scoring_strategy": string,"source_reference": string | null,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"domain": string,"id"?: string,"instructions_json"?: NonNullable<Json>,"is_active"?: boolean,"is_clinician_rated"?: boolean,"language"?: string,"name": string,"scoring_strategy": string,"source_reference"?: string | null,"version"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"domain"?: string,"id"?: string,"instructions_json"?: NonNullable<Json>,"is_active"?: boolean,"is_clinician_rated"?: boolean,"language"?: string,"name"?: string,"scoring_strategy"?: string,"source_reference"?: string | null,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"questionnaire_instances": {
                  Row: {
                    "chat_request_id": string | null,"conversation_id": string | null,"created_at": string,"id": string,"questionnaire_id": string,"scored_at": string | null,"session_id": string | null,"started_at": string | null,"status": Database["public"]['Enums']["questionnaire_instance_status"],"submission_json": Json | null,"submitted_at": string | null,"trigger_reason": string | null,"triggered_by": Database["public"]['Enums']["trigger_source"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chat_request_id"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"id"?: string,"questionnaire_id": string,"scored_at"?: string | null,"session_id"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["questionnaire_instance_status"],"submission_json"?: Json | null,"submitted_at"?: string | null,"trigger_reason"?: string | null,"triggered_by"?: Database["public"]['Enums']["trigger_source"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "chat_request_id"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"id"?: string,"questionnaire_id"?: string,"scored_at"?: string | null,"session_id"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["questionnaire_instance_status"],"submission_json"?: Json | null,"submitted_at"?: string | null,"trigger_reason"?: string | null,"triggered_by"?: Database["public"]['Enums']["trigger_source"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "instances_conversation_owner"
      columns: ["conversation_id","user_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "instances_session_conversation"
      columns: ["session_id","conversation_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id","conversation_id"]
    },{
      foreignKeyName: "instances_session_owner"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "questionnaire_instances_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questionnaire_instances_questionnaire_id_fkey"
      columns: ["questionnaire_id"]
isOneToOne: false
      referencedRelation: "questionnaire_definitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questionnaire_instances_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"questionnaire_items": {
                  Row: {
                    "created_at": string,"id": string,"is_required": boolean,"numeric_value_map_json": NonNullable<Json>,"options_json": NonNullable<Json>,"order_index": number,"prompt": string,"questionnaire_id": string,"response_type": string,"risk_flag_rule": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_required"?: boolean,"numeric_value_map_json"?: NonNullable<Json>,"options_json"?: NonNullable<Json>,"order_index": number,"prompt": string,"questionnaire_id": string,"response_type"?: string,"risk_flag_rule"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_required"?: boolean,"numeric_value_map_json"?: NonNullable<Json>,"options_json"?: NonNullable<Json>,"order_index"?: number,"prompt"?: string,"questionnaire_id"?: string,"response_type"?: string,"risk_flag_rule"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "questionnaire_items_questionnaire_id_fkey"
      columns: ["questionnaire_id"]
isOneToOne: false
      referencedRelation: "questionnaire_definitions"
      referencedColumns: ["id"]
    }
                  ]
                },"questionnaire_results": {
                  Row: {
                    "created_at": string,"flags_json": NonNullable<Json>,"id": string,"instance_id": string,"interpretation_json": NonNullable<Json>,"requires_review": boolean,"severity_band": string,"subscores_json": NonNullable<Json>,"total_score": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"flags_json"?: NonNullable<Json>,"id"?: string,"instance_id": string,"interpretation_json"?: NonNullable<Json>,"requires_review"?: boolean,"severity_band": string,"subscores_json"?: NonNullable<Json>,"total_score": number
                  }
                  Update: {
                    "created_at"?: string,"flags_json"?: NonNullable<Json>,"id"?: string,"instance_id"?: string,"interpretation_json"?: NonNullable<Json>,"requires_review"?: boolean,"severity_band"?: string,"subscores_json"?: NonNullable<Json>,"total_score"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "questionnaire_results_instance_id_fkey"
      columns: ["instance_id"]
isOneToOne: true
      referencedRelation: "questionnaire_instances"
      referencedColumns: ["id"]
    }
                  ]
                },"risk_events": {
                  Row: {
                    "acknowledged_at": string | null,"closed_at": string | null,"conversation_id": string | null,"created_at": string,"id": string,"payload_json": NonNullable<Json>,"risk_type": Database["public"]['Enums']["risk_type"],"session_id": string | null,"severity": Database["public"]['Enums']["risk_severity"],"source_type": string,"status": Database["public"]['Enums']["risk_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string | null,"closed_at"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"id"?: string,"payload_json"?: NonNullable<Json>,"risk_type": Database["public"]['Enums']["risk_type"],"session_id"?: string | null,"severity": Database["public"]['Enums']["risk_severity"],"source_type": string,"status"?: Database["public"]['Enums']["risk_status"],"user_id": string
                  }
                  Update: {
                    "acknowledged_at"?: string | null,"closed_at"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"id"?: string,"payload_json"?: NonNullable<Json>,"risk_type"?: Database["public"]['Enums']["risk_type"],"session_id"?: string | null,"severity"?: Database["public"]['Enums']["risk_severity"],"source_type"?: string,"status"?: Database["public"]['Enums']["risk_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "risk_conversation_owner"
      columns: ["conversation_id","user_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "risk_events_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "risk_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "risk_session_conversation"
      columns: ["session_id","conversation_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id","conversation_id"]
    },{
      foreignKeyName: "risk_session_owner"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"session_close_proposals": {
                  Row: {
                    "reason": string,"request_id": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "reason": string,"request_id": string,"session_id": string
                  }
                  Update: {
                    "reason"?: string,"request_id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_close_proposals_session_id_fkey"
      columns: ["session_id"]
isOneToOne: true
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_close_proposals_session_id_request_id_fkey"
      columns: ["session_id","request_id"]
isOneToOne: false
      referencedRelation: "chat_turns"
      referencedColumns: ["session_id","request_id"]
    }
                  ]
                },"session_summaries": {
                  Row: {
                    "created_at": string,"generated_by": Database["public"]['Enums']["generated_by_source"],"id": string,"session_id": string,"summary_json": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"generated_by"?: Database["public"]['Enums']["generated_by_source"],"id"?: string,"session_id": string,"summary_json": NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"generated_by"?: Database["public"]['Enums']["generated_by_source"],"id"?: string,"session_id"?: string,"summary_json"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_summaries_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "summaries_session_owner"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "clinical_sessions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"user_clinician_assignments": {
                  Row: {
                    "assigned_at": string,"clinician_id": string,"ended_at": string | null,"id": string,"is_primary": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"clinician_id": string,"ended_at"?: string | null,"id"?: string,"is_primary"?: boolean,"user_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"clinician_id"?: string,"ended_at"?: string | null,"id"?: string,"is_primary"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_clinician_assignments_clinician_id_fkey"
      columns: ["clinician_id"]
isOneToOne: false
      referencedRelation: "clinicians"
      referencedColumns: ["id"]
    }
                  ]
                },"user_profiles": {
                  Row: {
                    "active_care_plan_id": string | null,"baseline_summary": string | null,"birth_date": string | null,"city": string | null,"consent_given_at": string | null,"consent_version": string | null,"country": string | null,"created_at": string,"current_focus": (string)[] | null,"current_medication": boolean | null,"display_name": string | null,"employment": string | null,"id": string,"informal_name": string,"last_known_risk_level": Database["public"]['Enums']["risk_profile_status"],"last_reviewed_assessment_id": string | null,"living_with": string | null,"locale": string,"onboarding_status": Database["public"]['Enums']["onboarding_status"],"prior_therapy": boolean | null,"pronouns": string | null,"reason_for_consulting": string | null,"relationship_status": string | null,"risk_profile_status": Database["public"]['Enums']["risk_profile_status"],"role": Database["public"]['Enums']["user_role"],"sex": string | null,"timezone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active_care_plan_id"?: string | null,"baseline_summary"?: string | null,"birth_date"?: string | null,"city"?: string | null,"consent_given_at"?: string | null,"consent_version"?: string | null,"country"?: string | null,"created_at"?: string,"current_focus"?: (string)[] | null,"current_medication"?: boolean | null,"display_name"?: string | null,"employment"?: string | null,"id"?: string,"informal_name"?: string,"last_known_risk_level"?: Database["public"]['Enums']["risk_profile_status"],"last_reviewed_assessment_id"?: string | null,"living_with"?: string | null,"locale"?: string,"onboarding_status"?: Database["public"]['Enums']["onboarding_status"],"prior_therapy"?: boolean | null,"pronouns"?: string | null,"reason_for_consulting"?: string | null,"relationship_status"?: string | null,"risk_profile_status"?: Database["public"]['Enums']["risk_profile_status"],"role"?: Database["public"]['Enums']["user_role"],"sex"?: string | null,"timezone"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active_care_plan_id"?: string | null,"baseline_summary"?: string | null,"birth_date"?: string | null,"city"?: string | null,"consent_given_at"?: string | null,"consent_version"?: string | null,"country"?: string | null,"created_at"?: string,"current_focus"?: (string)[] | null,"current_medication"?: boolean | null,"display_name"?: string | null,"employment"?: string | null,"id"?: string,"informal_name"?: string,"last_known_risk_level"?: Database["public"]['Enums']["risk_profile_status"],"last_reviewed_assessment_id"?: string | null,"living_with"?: string | null,"locale"?: string,"onboarding_status"?: Database["public"]['Enums']["onboarding_status"],"prior_therapy"?: boolean | null,"pronouns"?: string | null,"reason_for_consulting"?: string | null,"relationship_status"?: string | null,"risk_profile_status"?: Database["public"]['Enums']["risk_profile_status"],"role"?: Database["public"]['Enums']["user_role"],"sex"?: string | null,"timezone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fk_user_profiles_care_plan"
      columns: ["active_care_plan_id"]
isOneToOne: false
      referencedRelation: "care_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fk_user_profiles_last_assessment"
      columns: ["last_reviewed_assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assessment_summary_valid_for_risk":
{ Args: { "doc": Json }; Returns: boolean
                           },
"begin_chat_turn":
{ Args: { "p_crisis"?: boolean,"p_request_id": string,"p_session_id": string,"p_text": string,"p_urgent"?: boolean,"p_user_id": string }; Returns: Json
                           },
"begin_chat_turn_after_onboarding":
{ Args: { "p_crisis"?: boolean,"p_request_id": string,"p_session_id": string,"p_text": string,"p_urgent"?: boolean,"p_user_id": string }; Returns: Json
                           },
"claim_assessment_jobs":
{ Args: { "p_limit"?: number,"p_session_id"?: string }; Returns: {
              "attempts": number,
"available_at": string,
"context_json": Json | null,
"last_error": string | null,
"lease_until": string | null,
"run_id": string | null,
"session_id": string,
"status": string,
"token": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "assessment_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"close_chat_turn":
{ Args: { "p_reason": string,"p_request_id": string,"p_session_id": string,"p_token": string }; Returns: boolean
                           },
"close_session_atomic":
{ Args: { "p_reason": string,"p_session_id": string,"p_user_id": string }; Returns: undefined
                           },
"close_stale_sessions":
{ Args: { "threshold_minutes"?: number }; Returns: number
                           },
"complete_patient_onboarding":
{ Args: { "p_accepted": boolean,"p_birth_date": string,"p_informal_name": string,"p_pronouns": string,"p_reason": string,"p_version": string }; Returns: undefined
                           },
"create_questionnaire_atomic":
{ Args: { "p_code": string,"p_conversation_id": string,"p_reason": string,"p_request_id"?: string,"p_session_id": string,"p_token"?: string,"p_user_id": string }; Returns: {
              "chat_request_id": string | null,
"conversation_id": string | null,
"created_at": string,
"id": string,
"questionnaire_id": string,
"scored_at": string | null,
"session_id": string | null,
"started_at": string | null,
"status": Database["public"]['Enums']["questionnaire_instance_status"],
"submission_json": Json | null,
"submitted_at": string | null,
"trigger_reason": string | null,
"triggered_by": Database["public"]['Enums']["trigger_source"],
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "questionnaire_instances"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_session_after_onboarding":
{ Args: { "p_user_id": string }; Returns: {
              "closed_at": string | null,
"closure_reason": string | null,
"conversation_id": string,
"created_at": string,
"id": string,
"last_activity_at": string,
"opened_at": string,
"protocol_phase": number,
"status": Database["public"]['Enums']["session_status"],
"summary_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "clinical_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_session_atomic":
{ Args: { "p_user_id": string }; Returns: {
              "closed_at": string | null,
"closure_reason": string | null,
"conversation_id": string,
"created_at": string,
"id": string,
"last_activity_at": string,
"opened_at": string,
"protocol_phase": number,
"status": Database["public"]['Enums']["session_status"],
"summary_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "clinical_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"derive_patient_risk_state_sql":
{ Args: { "p_critical": boolean,"p_latest_high": string,"p_latest_open": string,"p_now": string,"p_previous_at": string,"p_previous_reason": string,"p_reviewed_at": string,"p_suicidality": string }; Returns: string
                           },
"fail_chat_turn":
{ Args: { "p_error": string,"p_request_id": string,"p_session_id": string,"p_token": string }; Returns: undefined
                           },
"finish_assessment_job":
{ Args: { "p_session_id": string,"p_status": string,"p_summary": Json,"p_token": string }; Returns: boolean
                           },
"finish_chat_turn":
{ Args: { "p_chunks": Json,"p_close_reason"?: string,"p_parts": Json,"p_proposal"?: string,"p_request_id": string,"p_session_id": string,"p_token": string }; Returns: undefined
                           },
"gdpr_erase_user":
{ Args: { "target_user_id": string }; Returns: undefined
                           },
"get_chat_turn_recovery":
{ Args: { "p_session_id": string }; Returns: Json
                           },
"get_clinician_inbox_page":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_pending_only"?: boolean }; Returns: Json
                           },
"get_onboarding_ready":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"get_patient_session_reports":
{ Args: { "p_session_ids": (string)[] }; Returns: Json
                           },
"is_clinician":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"patient_onboarding_ready":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"recover_assessment_jobs":
{ Args: { "p_limit"?: number }; Returns: number
                           },
"regenerate_assessment_atomic":
{ Args: { "p_assessment_id": string,"p_expected_status": string,"p_restore"?: boolean }; Returns: boolean
                           },
"review_assessment_atomic":
{ Args: { "p_action": string,"p_assessment_id": string,"p_inherited_updates"?: Json,"p_notes"?: string,"p_reason"?: string,"p_session_id": string,"p_summary"?: Json }; Returns: string
                           },
"start_questionnaire_atomic":
{ Args: { "p_instance_id": string,"p_user_id": string }; Returns: undefined
                           },
"submit_questionnaire_atomic":
{ Args: { "p_answers": Json,"p_instance_id": string,"p_result": Json,"p_risk_severity"?: string,"p_user_id": string }; Returns: Json
                           },
"touch_session_atomic":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"update_assessment_job":
{ Args: { "p_action": string,"p_run_id"?: string,"p_session_id": string,"p_token": string }; Returns: boolean
                           }
          }
          Enums: {
            "actor_type": "user"|"service"|"system","assessment_status": "draft_ai"|"pending_clinician_review"|"reviewed_confirmed"|"reviewed_modified"|"rejected"|"superseded"|"requires_manual_review","assessment_type": "intake"|"follow_up"|"closure"|"review","conversation_status": "active"|"closed"|"archived","generated_by_source": "ai"|"clinician"|"system","message_role": "user"|"assistant"|"tool"|"system","onboarding_status": "pending"|"consent"|"age_gate"|"baseline"|"complete","patient_task_status": "pendiente"|"cumplida"|"parcial"|"no_realizada"|"no_abordada","questionnaire_instance_status": "proposed"|"in_progress"|"submitted"|"scored"|"cancelled","review_status": "pending"|"in_review"|"reviewed"|"rejected"|"needs_followup","risk_profile_status": "unknown"|"low"|"elevated"|"active_protocol","risk_severity": "low"|"moderate"|"high"|"critical","risk_status": "open"|"acknowledged"|"escalated"|"closed","risk_type": "suicidal_ideation"|"self_harm"|"severe_distress"|"crisis_other","session_status": "open"|"paused"|"closed","trigger_source": "ai"|"clinician"|"schedule"|"user","user_role": "patient"|"clinician"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "actor_type": ["user", "service", "system"],"assessment_status": ["draft_ai", "pending_clinician_review", "reviewed_confirmed", "reviewed_modified", "rejected", "superseded", "requires_manual_review"],"assessment_type": ["intake", "follow_up", "closure", "review"],"conversation_status": ["active", "closed", "archived"],"generated_by_source": ["ai", "clinician", "system"],"message_role": ["user", "assistant", "tool", "system"],"onboarding_status": ["pending", "consent", "age_gate", "baseline", "complete"],"patient_task_status": ["pendiente", "cumplida", "parcial", "no_realizada", "no_abordada"],"questionnaire_instance_status": ["proposed", "in_progress", "submitted", "scored", "cancelled"],"review_status": ["pending", "in_review", "reviewed", "rejected", "needs_followup"],"risk_profile_status": ["unknown", "low", "elevated", "active_protocol"],"risk_severity": ["low", "moderate", "high", "critical"],"risk_status": ["open", "acknowledged", "escalated", "closed"],"risk_type": ["suicidal_ideation", "self_harm", "severe_distress", "crisis_other"],"session_status": ["open", "paused", "closed"],"trigger_source": ["ai", "clinician", "schedule", "user"],"user_role": ["patient", "clinician"]
          }
        }
} as const
